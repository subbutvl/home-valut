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
}

export interface Lockout {
  id: 'lockout'
  fails: number
  until: number
}

export type MetaRow = VaultHeader | Lockout

/** Every user record is stored encrypted. `kind` and timestamps stay in clear for sync. */
export interface EncRecord extends Sealed {
  id: string
  kind: 'item' | 'settings'
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
