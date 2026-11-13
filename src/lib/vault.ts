import { useSyncExternalStore } from 'react'
import {
  PBKDF2_ITERATIONS,
  decryptJson,
  deriveKek,
  encryptJson,
  fromB64,
  generateDek,
  generateRecoveryKey,
  normalizeRecoveryKey,
  randomBytes,
  toB64,
  unwrapDek,
  wrapDek,
} from './crypto'
import { getBioMeta, passkeyKek, registerPasskey } from './biometric'
import { db, getHeader, getLockout, requestPersistence, type EncRecord, type VaultHeader } from './db'
import { BIN_DAYS, DEFAULT_SETTINGS, type Item, type Settings } from './types'

// ---------------------------------------------------------------------------
// In-memory state. The data key and decrypted data exist only while unlocked.

interface State {
  status: 'loading' | 'new' | 'locked' | 'unlocked'
  /** Unlocked with the recovery key: ask for a new master password. */
  recovered?: boolean
  items: Item[]
  settings: Settings
}

let dek: CryptoKey | null = null
let state: State = { status: 'loading', items: [], settings: DEFAULT_SETTINGS }
const listeners = new Set<() => void>()

/** Fires after anything is saved locally, so sync can upload it. */
export const localChanges = new EventTarget()
const changed = () => localChanges.dispatchEvent(new Event('change'))

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useVault(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function getState() {
  return state
}

export async function init() {
  const header = await getHeader()
  // Vaults made before sync existed get an id now.
  if (header && !header.vaultId) await db.meta.put({ ...header, vaultId: newId(), updatedAt: header.createdAt })
  set({ status: header ? 'locked' : 'new' })
}

/** Called by sync after it wrote newer records from Drive into the local database. */
export async function reloadFromDb() {
  if (dek) await loadAll()
}

/** Replace this device's vault (header + records) with another copy, then lock. */
export async function replaceLocalVault(header: VaultHeader, records: EncRecord[]) {
  dek = null
  await db.transaction('rw', db.meta, db.records, db.files, async () => {
    await db.files.clear()
    await db.records.clear()
    await db.records.bulkPut(records)
    await db.meta.put({ ...header, id: 'header' })
    await db.meta.put({ id: 'lockout', fails: 0, until: 0 })
    await db.meta.delete('bio')
  })
  set({ status: 'locked', items: [], settings: DEFAULT_SETTINGS, recovered: false })
}

// ---------------------------------------------------------------------------
// Setup, unlock, lock

/** Step 1 of setup: create keys in memory. Nothing is saved until `finishSetup`. */
export interface PendingSetup {
  header: VaultHeader
  dek: CryptoKey
  recoveryKey: string
}

export async function prepareSetup(password: string): Promise<PendingSetup> {
  const recoveryKey = generateRecoveryKey()
  const saltPw = randomBytes(16)
  const saltRk = randomBytes(16)
  const newDek = await generateDek()
  const [kekPw, kekRk] = await Promise.all([
    deriveKek(password, saltPw),
    deriveKek(normalizeRecoveryKey(recoveryKey), saltRk),
  ])
  const [wrappedPw, wrappedRk] = await Promise.all([wrapDek(newDek, kekPw), wrapDek(newDek, kekRk)])
  return {
    recoveryKey,
    dek: newDek,
    header: {
      id: 'header',
      version: 1,
      iterations: PBKDF2_ITERATIONS,
      saltPw: toB64(saltPw),
      saltRk: toB64(saltRk),
      wrappedPw,
      wrappedRk,
      createdAt: Date.now(),
      vaultId: newId(),
      updatedAt: Date.now(),
    },
  }
}

export async function finishSetup(p: PendingSetup) {
  await db.meta.put(p.header)
  dek = p.dek
  await saveSettings(DEFAULT_SETTINGS)
  await requestPersistence()
  set({ status: 'unlocked', items: [], settings: DEFAULT_SETTINGS })
}

export class LockedOutError extends Error {
  until: number
  constructor(until: number) {
    super('locked out')
    this.until = until
  }
}

export async function lockoutRemaining(): Promise<number> {
  const l = await getLockout()
  return Math.max(0, l.until - Date.now())
}

async function registerFailure() {
  const l = await getLockout()
  const fails = l.fails + 1
  // After 5 wrong tries: wait 1 minute, doubling with each further try.
  const until = fails >= 5 ? Date.now() + 60_000 * 2 ** (fails - 5) : 0
  await db.meta.put({ id: 'lockout', fails, until })
  return until
}

/** Unlock with the master password, or with the recovery key. Returns false if wrong. */
export async function unlock(secret: string, using: 'password' | 'recovery' = 'password'): Promise<boolean> {
  const wait = await lockoutRemaining()
  if (wait > 0) throw new LockedOutError(Date.now() + wait)
  const header = await getHeader()
  if (!header) throw new Error('No vault on this device')
  const salt = fromB64(using === 'password' ? header.saltPw : header.saltRk)
  const kek = await deriveKek(using === 'password' ? secret : normalizeRecoveryKey(secret), salt, header.iterations)
  try {
    dek = await unwrapDek(using === 'password' ? header.wrappedPw : header.wrappedRk, kek)
  } catch {
    const until = await registerFailure()
    if (until > Date.now()) throw new LockedOutError(until)
    return false
  }
  await db.meta.put({ id: 'lockout', fails: 0, until: 0 })
  if (using === 'password') {
    const bio = await getBioMeta()
    if (bio) await db.meta.put({ ...bio, lastPasswordAt: Date.now() })
  }
  await loadAll()
  set({ status: 'unlocked', recovered: using === 'recovery' })
  void requestPersistence()
  void purgeOldBin()
  return true
}

/** Unlock with Face ID / fingerprint. Returns false if it failed or was cancelled. */
export async function unlockWithBiometric(): Promise<boolean> {
  const bio = await getBioMeta()
  if (!bio) return false
  try {
    dek = await unwrapDek(bio.wrapped, await passkeyKek(bio))
  } catch {
    return false
  }
  await loadAll()
  set({ status: 'unlocked', recovered: false })
  void purgeOldBin()
  return true
}

/** Turn on Face ID / fingerprint unlock for this device. Needs the master password. */
export async function enableBiometric(password: string): Promise<'ok' | 'wrong-password'> {
  if (!dek || !(await verifyPassword(password))) return 'wrong-password'
  const { credentialId, salt, kek } = await registerPasskey()
  const wrapped = await wrapDek(dek, kek)
  await db.meta.put({ id: 'bio', credentialId, salt, wrapped, lastPasswordAt: Date.now() })
  return 'ok'
}

export async function disableBiometric() {
  await db.meta.delete('bio')
}

export function lock() {
  dek = null
  set({ status: 'locked', items: [], settings: DEFAULT_SETTINGS, recovered: false })
}

/** Re-wrap the data key under a new password. Verifies the current one first. */
export async function changePassword(current: string, next: string): Promise<boolean> {
  const header = await getHeader()
  if (!header) return false
  try {
    await unwrapDek(header.wrappedPw, await deriveKek(current, fromB64(header.saltPw), header.iterations))
  } catch {
    return false
  }
  if (!dek) return false
  const saltPw = randomBytes(16)
  const wrappedPw = await wrapDek(dek, await deriveKek(next, saltPw))
  await db.meta.put({ ...header, saltPw: toB64(saltPw), wrappedPw, iterations: PBKDF2_ITERATIONS, updatedAt: Date.now() })
  changed()
  return true
}

/** After unlocking with the recovery key: set a new master password. */
export async function resetPassword(next: string) {
  const header = await getHeader()
  if (!header || !dek || !state.recovered) throw new Error("Not allowed")
  const saltPw = randomBytes(16)
  const wrappedPw = await wrapDek(dek, await deriveKek(next, saltPw))
  await db.meta.put({ ...header, saltPw: toB64(saltPw), wrappedPw, iterations: PBKDF2_ITERATIONS, updatedAt: Date.now() })
  changed()
  set({ recovered: false })
}

/** Issue a new recovery key (the old one stops working). Needs the master password. */
export async function newRecoveryKey(password: string): Promise<string | null> {
  const header = await getHeader()
  if (!header || !dek) return null
  try {
    await unwrapDek(header.wrappedPw, await deriveKek(password, fromB64(header.saltPw), header.iterations))
  } catch {
    return null
  }
  const recoveryKey = generateRecoveryKey()
  const saltRk = randomBytes(16)
  const wrappedRk = await wrapDek(dek, await deriveKek(normalizeRecoveryKey(recoveryKey), saltRk))
  await db.meta.put({ ...header, saltRk: toB64(saltRk), wrappedRk, updatedAt: Date.now() })
  changed()
  return recoveryKey
}

/** Check the master password again (for showing secrets in print, etc.). */
export async function verifyPassword(password: string): Promise<boolean> {
  const header = await getHeader()
  if (!header) return false
  try {
    await unwrapDek(header.wrappedPw, await deriveKek(password, fromB64(header.saltPw), header.iterations))
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Records

function requireKey(): CryptoKey {
  if (!dek) throw new Error('Vault is locked')
  return dek
}

async function loadAll() {
  const key = requireKey()
  const rows = await db.records.toArray()
  const items: Item[] = []
  let settings = DEFAULT_SETTINGS
  for (const r of rows) {
    if (r.kind === 'tombstone') continue
    if (r.kind === 'settings') settings = { ...DEFAULT_SETTINGS, ...(await decryptJson<Settings>(key, r)) }
    else items.push(await decryptJson<Item>(key, r))
  }
  set({ items, settings })
}

async function putRecord(id: string, kind: EncRecord['kind'], value: unknown, updatedAt: number) {
  const sealed = await encryptJson(requireKey(), value)
  await db.records.put({ id, kind, updatedAt, ...sealed })
  changed()
}

export async function saveSettings(next: Settings) {
  await putRecord('settings', 'settings', next, Date.now())
  set({ settings: next })
}

export async function updateSettings(patch: Partial<Settings>) {
  await saveSettings({ ...state.settings, ...patch })
}

export function newId(): string {
  return toB64(randomBytes(12)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string)
}

export async function saveItem(item: Item): Promise<Item> {
  const now = Date.now()
  const next = { ...item, updatedAt: now, createdAt: item.createdAt || now }
  await putRecord(next.id, 'item', next, now)
  const others = state.items.filter((i) => i.id !== next.id)
  set({ items: [...others, next] })
  return next
}

export async function moveToBin(id: string) {
  const item = state.items.find((i) => i.id === id)
  if (item) await saveItem({ ...item, deletedAt: Date.now(), favourite: false })
}

export async function restoreFromBin(id: string) {
  const item = state.items.find((i) => i.id === id)
  if (item) await saveItem({ ...item, deletedAt: undefined })
}

// ---------------------------------------------------------------------------
// Attachments: bytes are encrypted with the same data key, stored apart from items.

export async function putAttachmentBytes(bytes: ArrayBuffer): Promise<string> {
  const iv = randomBytes(12)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, requireKey(), bytes)
  const id = newId()
  await db.files.put({ id, iv: toB64(iv), data, uploaded: false, createdAt: Date.now() })
  return id
}

export async function readAttachment(id: string, type: string): Promise<Blob | null> {
  const row = await db.files.get(id)
  if (!row) return null
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(row.iv) }, requireKey(), row.data)
  return new Blob([plain], { type })
}

export async function deleteAttachmentBytes(ids: string[]) {
  await db.files.bulkDelete(ids)
}

export async function deleteForever(id: string) {
  const gone = state.items.find((i) => i.id === id)
  if (gone?.attachments?.length) await deleteAttachmentBytes(gone.attachments.map((a) => a.id))
  // Keep a tombstone so the deletion reaches other devices.
  await db.records.put({ id, kind: 'tombstone', updatedAt: Date.now(), iv: '', ct: '' })
  changed()
  set({ items: state.items.filter((i) => i.id !== id) })
}

async function purgeOldBin() {
  const cutoff = Date.now() - BIN_DAYS * 86_400_000
  for (const i of state.items) if (i.deletedAt && i.deletedAt < cutoff) await deleteForever(i.id)
}

export async function toggleFavourite(id: string) {
  const item = state.items.find((i) => i.id === id)
  if (!item) return
  const favourite = !item.favourite
  await saveItem({ ...item, favourite })
  const order = state.settings.favouriteOrder.filter((x) => x !== id)
  await updateSettings({ favouriteOrder: favourite ? [...order, id] : order })
}

export async function markViewed(id: string) {
  const recent = [id, ...state.settings.recentlyViewed.filter((x) => x !== id)].slice(0, 5)
  if (recent.join() !== state.settings.recentlyViewed.join()) await updateSettings({ recentlyViewed: recent })
}

export function blankItem(category: string): Item {
  return {
    id: newId(),
    category,
    name: '',
    belongsTo: [],
    nominees: [],
    tags: [],
    notes: '',
    fields: {},
    custom: [],
    createdAt: 0,
    updatedAt: 0,
  }
}

/** Erase everything on this device (used by "Start over" when both secrets are lost). */
export async function eraseDevice() {
  dek = null
  await db.delete()
  localStorage.clear()
  sessionStorage.clear()
  location.reload()
}
