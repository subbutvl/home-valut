import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Sealed } from './crypto'

/** Unencrypted header: only what is needed to unlock. No user data. */
export interface VaultHeader {
  id: 'header'
  version: 1
  iterations: number
  saltPw: string
  saltRk: string
  wrappedPw: Sealed
  wrappedRk: Sealed
  createdAt: number
  /** Same on every device that shares this vault. */
  vaultId?: string
  /** Last time the password or recovery key changed (newest header wins in sync). */
  updatedAt?: number
}

export interface Lockout {
  id: 'lockout'
  fails: number
  until: number
}

/** Google Drive sync bookkeeping for this device. */
export interface SyncMeta {
  id: 'sync'
  connected: boolean
  fileId?: string
  lastSync?: number
  lastSnapshot?: string // YYYY-MM-DD
  /** Drive holds a different vault than this device */
  mismatch?: boolean
}

export type MetaRow = VaultHeader | Lockout | SyncMeta

/** Every user record is stored encrypted. `kind` and timestamps stay in clear for sync. */
export interface EncRecord extends Sealed {
  id: string
  /** 'tombstone' marks a permanently deleted item so the deletion syncs */
  kind: 'item' | 'settings' | 'tombstone'
  updatedAt: number
}

export const db = new Dexie('homevault') as Dexie & {
  meta: Table<MetaRow, string>
  records: EntityTable<EncRecord, 'id'>
}

db.version(1).stores({
  meta: 'id',
  records: 'id, kind, updatedAt',
})

export async function getHeader(): Promise<VaultHeader | undefined> {
  return (await db.meta.get('header')) as VaultHeader | undefined
}

export async function getSyncMeta(): Promise<SyncMeta> {
  return ((await db.meta.get('sync')) as SyncMeta | undefined) ?? { id: 'sync', connected: false }
}

export async function getLockout(): Promise<Lockout> {
  return ((await db.meta.get('lockout')) as Lockout | undefined) ?? { id: 'lockout', fails: 0, until: 0 }
}

/** Ask the browser not to evict our data (helps on iPhone once installed). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* not supported */
  }
}
