export interface Nominee {
  name: string
  share?: string
}

export interface CustomField {
  id: string
  label: string
  value: string
  secret?: boolean
}

export interface Item {
  id: string
  category: string
  name: string
  subcategory?: string
  /** Family member names; several = joint */
  belongsTo: string[]
  nominees: Nominee[]
  tags: string[]
  notes: string
  fields: Record<string, string>
  custom: CustomField[]
  favourite?: boolean
  /** Reminder dates marked done: field key → the date value that was done */
  done?: Record<string, string>
  /** Days before a date to start reminding; empty = the default for its kind */
  leadDays?: number
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export interface Member {
  id: string
  name: string
  relationship: string
}

export type NotifType = 'reminder' | 'overdue' | 'sync' | 'backup' | 'app'

export interface Notif {
  id: string
  /** Stops the same alert being created twice */
  key: string
  type: NotifType
  title: string
  body?: string
  itemId?: string
  createdAt: number
  read?: boolean
  snoozeUntil?: number
}

export interface Settings {
  members: Member[]
  autoLockMinutes: number
  recentlyViewed: string[]
  favouriteOrder: string[]
  /** Default reminder lead times, in days */
  leadLong: number
  leadShort: number
  notifications: Notif[]
  /** Keys of alerts already created (kept 180 days) */
  notifKeys: Record<string, number>
}

export const DEFAULT_SETTINGS: Settings = {
  members: [{ id: 'self', name: 'Self', relationship: 'Self' }],
  autoLockMinutes: 1,
  recentlyViewed: [],
  favouriteOrder: [],
  leadLong: 30,
  leadShort: 7,
  notifications: [],
  notifKeys: {},
}

export const BIN_DAYS = 30
