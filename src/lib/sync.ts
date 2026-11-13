import { useSyncExternalStore } from 'react'
import { db, getHeader, getSyncMeta, type EncRecord, type SyncMeta, type VaultHeader } from './db'
import {
  DriveAuthError,
  SNAPSHOT_PREFIX,
  VAULT_FILE,
  copyFile,
  deleteFile,
  download,
  findFile,
  findLegacyFile,
  folders,
  forgetFolders,
  forgetToken,
  getToken,
  listFiles,
  upload,
  type DriveFile,
} from './drive'
import { getState, localChanges, reloadFromDb, replaceLocalVault } from './vault'

/** What is stored in Drive and in backup files: the unlock header plus encrypted records. */
export interface VaultFile {
  format: 'homevault'
  version: 1
  savedAt: number
  header: VaultHeader
  records: EncRecord[]
}

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'signin' | 'offline' | 'error' | 'mismatch'

interface SyncState {
  status: SyncStatus
  lastSync?: number
  error?: string
}

let state: SyncState = { status: 'off' }
const listeners = new Set<() => void>()
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Callback for "kept the newer version" notices (wired to a toast). */
let onConflict: (names: string[]) => void = () => {}
export function setConflictHandler(fn: (names: string[]) => void) {
  onConflict = fn
}

async function saveMeta(patch: Partial<SyncMeta>) {
  const m = await getSyncMeta()
  await db.meta.put({ ...m, ...patch, id: 'sync' })
}

export async function loadSyncState() {
  const m = await getSyncMeta()
  set({ status: !m.connected ? 'off' : m.mismatch ? 'mismatch' : 'idle', lastSync: m.lastSync })
}

export async function buildVaultFile(): Promise<VaultFile> {
  const header = await getHeader()
  if (!header) throw new Error('No vault on this device')
  return { format: 'homevault', version: 1, savedAt: Date.now(), header, records: await db.records.toArray() }
}

export function isVaultFile(x: unknown): x is VaultFile {
  const v = x as VaultFile
  return !!v && v.format === 'homevault' && !!v.header?.wrappedPw && Array.isArray(v.records)
}

// ---------------------------------------------------------------------------
// Sync: pull from Drive, keep the newer copy of each record, push the result.

let running: Promise<void> | null = null
let again = false

export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = doSync().finally(() => {
    running = null
    if (again) {
      again = false
      void syncNow()
    }
  })
  return running
}

async function doSync() {
  const meta = await getSyncMeta()
  if (!meta.connected || meta.mismatch) return
  if (!navigator.onLine) return set({ status: 'offline' })
  if (!getToken()) return set({ status: 'signin' })
  set({ status: 'syncing', error: undefined })
  try {
    const local = await getHeader()
    if (!local) return
    const f = await folders()
    // Ignore a file id from before the vault moved into the HomeVault folder.
    let fileId = meta.store === 'folder' ? meta.fileId : undefined
    let remote: VaultFile | null = null
    let legacyId: string | undefined
    if (!fileId) fileId = (await findFile(VAULT_FILE, f.root))?.id
    if (!fileId) {
      // First sync after the move: bring the copy from the hidden app folder across.
      const legacy = await findLegacyFile(VAULT_FILE)
      if (legacy) {
        legacyId = legacy.id
        remote = await download<VaultFile>(legacy.id)
      }
    }
    if (fileId) {
      try {
        remote = await download<VaultFile>(fileId)
      } catch (e) {
        if (e instanceof DriveAuthError) throw e
        // File gone (deleted in Drive): look again by name, else create fresh.
        fileId = (await findFile(VAULT_FILE, f.root))?.id
        remote = fileId ? await download<VaultFile>(fileId) : null
      }
    }

    if (remote && isVaultFile(remote)) {
      if (remote.header.vaultId !== local.vaultId) {
        await saveMeta({ mismatch: true, fileId, store: legacyId ? undefined : 'folder' })
        return set({ status: 'mismatch' })
      }
      await mergeRemote(remote, meta.lastSync ?? 0)
    }

    const merged = await buildVaultFile()
    fileId = await upload(VAULT_FILE, merged, fileId, f.root)
    const now = Date.now()
    await saveMeta({ fileId, store: 'folder', lastSync: now })
    if (legacyId) await deleteFile(legacyId).catch(() => {})
    await maybeSnapshot(fileId, f.snaps)
    set({ status: 'idle', lastSync: now })
  } catch (e) {
    if (e instanceof DriveAuthError) set({ status: 'signin', error: e.message })
    else set({ status: navigator.onLine ? 'error' : 'offline', error: (e as Error).message })
  }
}

async function mergeRemote(remote: VaultFile, lastSync: number) {
  const local = await getHeader()
  let changedAny = false
  const conflicts: string[] = []
  await db.transaction('rw', db.records, db.meta, async () => {
    for (const r of remote.records) {
      const mine = await db.records.get(r.id)
      if (mine && mine.updatedAt >= r.updatedAt) continue
      // Both sides changed the same item since the last sync: the newer one wins; tell the user.
      if (mine && mine.updatedAt > lastSync && mine.kind === 'item') conflicts.push(r.id)
      await db.records.put(r)
      changedAny = true
    }
    if (local && (remote.header.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      // Password or recovery key was changed on another device.
      await db.meta.put({ ...remote.header, id: 'header' })
    }
  })
  if (changedAny) await reloadFromDb()
  if (conflicts.length) {
    const names = conflicts.map((id) => getState().items.find((i) => i.id === id)?.name).filter(Boolean) as string[]
    if (names.length) onConflict(names)
  }
}

// ---------------------------------------------------------------------------
// Daily snapshots: keep the last 30 days, plus one per month for 12 months.

const todayStr = () => new Date().toISOString().slice(0, 10)

async function maybeSnapshot(fileId: string, snapsFolder: string) {
  const meta = await getSyncMeta()
  const today = todayStr()
  if (meta.lastSnapshot === today) return
  const name = `${SNAPSHOT_PREFIX}${today}.json`
  // One per day across all devices: the first sync of the day makes it.
  if (!(await findFile(name, snapsFolder))) await copyFile(fileId, name, snapsFolder)
  await saveMeta({ lastSnapshot: today })
  await pruneSnapshots()
}

async function pruneSnapshots() {
  const snaps = await listSnapshots()
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  // Earliest snapshot of each month; keep those for the 12 most recent months.
  const firstOfMonth = new Map<string, Snapshot>()
  for (const s of snaps) {
    const m = s.date.slice(0, 7)
    const cur = firstOfMonth.get(m)
    if (!cur || s.date < cur.date) firstOfMonth.set(m, s)
  }
  const monthly = new Set(
    [...firstOfMonth.keys()]
      .sort()
      .slice(-12)
      .map((m) => firstOfMonth.get(m)!.file.id),
  )
  for (const s of snaps) {
    if (s.date >= cutoff || monthly.has(s.file.id)) continue
    await deleteFile(s.file.id).catch(() => {})
  }
}

export interface Snapshot {
  file: DriveFile
  date: string
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const files = await listFiles(SNAPSHOT_PREFIX, (await folders()).snaps)
  return files
    .map((file) => ({ file, date: file.name.slice(SNAPSHOT_PREFIX.length, SNAPSHOT_PREFIX.length + 10) }))
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Restore a snapshot: its records become the current ones on every device.
 * Records are re-stamped as new, and anything added since is removed.
 */
export async function restoreSnapshot(s: Snapshot) {
  const snap = await download<VaultFile>(s.file.id)
  const local = await getHeader()
  if (!isVaultFile(snap) || snap.header.vaultId !== local?.vaultId) throw new Error('This snapshot belongs to a different vault')
  const now = Date.now()
  const keepIds = new Set(snap.records.map((r) => r.id))
  const current = await db.records.toArray()
  await db.transaction('rw', db.records, async () => {
    for (const r of snap.records) await db.records.put({ ...r, updatedAt: now })
    for (const r of current) if (!keepIds.has(r.id)) await db.records.put({ id: r.id, kind: 'tombstone', updatedAt: now, iv: '', ct: '' })
  })
  await reloadFromDb()
  await syncNow()
}

// ---------------------------------------------------------------------------
// Connecting, first-time open from Drive, and resolving a different vault

export async function markConnected() {
  await saveMeta({ connected: true, mismatch: false })
  await loadSyncState()
}

export async function disconnect() {
  forgetToken()
  forgetFolders()
  await db.meta.put({ id: 'sync', connected: false })
  set({ status: 'off', lastSync: undefined })
}

/** First run on a new device: download the vault from Drive. Returns false if Drive has none. */
export async function openFromDrive(): Promise<boolean> {
  const f = await folders()
  const inFolder = await findFile(VAULT_FILE, f.root)
  const file = inFolder ?? (await findLegacyFile(VAULT_FILE))
  if (!file) return false
  const remote = await download<VaultFile>(file.id)
  if (!isVaultFile(remote)) throw new Error('The file in Drive is not a HomeVault vault')
  await replaceLocalVault(remote.header, remote.records)
  await db.meta.put({
    id: 'sync',
    connected: true,
    fileId: inFolder?.id,
    store: inFolder ? 'folder' : undefined,
    lastSync: Date.now(),
  })
  await loadSyncState()
  return true
}

/** Drive holds another vault: make this device use it (this device's vault is replaced). */
export async function adoptDriveVault() {
  const ok = await openFromDrive()
  if (!ok) throw new Error('No vault found in Drive')
}

/** Drive holds another vault: overwrite it with this device's vault (Drive's copy is replaced). */
export async function overwriteDriveVault() {
  const meta = await getSyncMeta()
  const f = await folders()
  let fileId = (meta.store === 'folder' ? meta.fileId : undefined) ?? (await findFile(VAULT_FILE, f.root))?.id
  const legacy = fileId ? null : await findLegacyFile(VAULT_FILE)
  // Keep a dated copy of what was in Drive, just in case.
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  if (fileId) await copyFile(fileId, `homevault-replaced-${stamp}.json`, f.snaps)
  if (legacy) {
    await upload(`homevault-replaced-${stamp}.json`, await download(legacy.id), undefined, f.snaps)
    await deleteFile(legacy.id).catch(() => {})
  }
  fileId = await upload(VAULT_FILE, await buildVaultFile(), fileId, f.root)
  await saveMeta({ fileId, store: 'folder', mismatch: false, lastSync: Date.now(), lastSnapshot: undefined })
  await loadSyncState()
  await syncNow()
}

// ---------------------------------------------------------------------------
// Automatic triggers: after each local save (debounced), on reconnect, every 5 minutes.

let timer: number | undefined
let started = false
export function startAutoSync() {
  if (started) return
  started = true
  localChanges.addEventListener('change', () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (getState().status === 'unlocked') void syncNow()
    }, 2_000)
  })
  window.addEventListener('online', () => getState().status === 'unlocked' && void syncNow())
  window.addEventListener('offline', () => state.status !== 'off' && set({ status: 'offline' }))
  window.setInterval(() => {
    if (getState().status === 'unlocked' && document.visibilityState === 'visible') void syncNow()
  }, 5 * 60_000)
}
