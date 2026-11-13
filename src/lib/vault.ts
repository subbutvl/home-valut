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
  set({ status: header ? 'locked' : 'new' })
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
  await loadAll()
  set({ status: 'unlocked', recovered: using === 'recovery' })
  void requestPersistence()
  void purgeOldBin()
  return true
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
  await db.meta.put({ ...header, saltPw: toB64(saltPw), wrappedPw, iterations: PBKDF2_ITERATIONS })
  return true
}

/** After unlocking with the recovery key: set a new master password. */
export async function resetPassword(next: string) {
  const header = await getHeader()
  if (!header || !dek || !state.recovered) throw new Error("Not allowed")
  const saltPw = randomBytes(16)
  const wrappedPw = await wrapDek(dek, await deriveKek(next, saltPw))
  await db.meta.put({ ...header, saltPw: toB64(saltPw), wrappedPw, iterations: PBKDF2_ITERATIONS })
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
  await db.meta.put({ ...header, saltRk: toB64(saltRk), wrappedRk })
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
    if (r.kind === 'settings') settings = { ...DEFAULT_SETTINGS, ...(await decryptJson<Settings>(key, r)) }
    else items.push(await decryptJson<Item>(key, r))
  }
  set({ items, settings })
}

async function putRecord(id: string, kind: EncRecord['kind'], value: unknown, updatedAt: number) {
  const sealed = await encryptJson(requireKey(), value)
  await db.records.put({ id, kind, updatedAt, ...sealed })
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

export async function deleteForever(id: string) {
  await db.records.delete(id)
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
  location.reload()
}
