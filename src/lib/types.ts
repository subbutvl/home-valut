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
  /** Bank lockers: what is inside */
  lockerContents?: LockerEntry[]
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export interface Medical {
  bloodGroup?: string
  allergies?: string
  medicines?: string
  conditions?: string
  doctor?: string
  healthPolicy?: string
}

export interface Member {
  id: string
  name: string
  relationship: string
  dob?: string
  mobile?: string
  medical?: Medical
}

/** One thing kept in a bank locker. */
export interface LockerEntry {
  id: string
  item: string
  description?: string
  /** approx. value, reference only */
  value?: string
  owner?: string
  /** a Gold, Property or ID item this refers to */
  linkId?: string
}

export type NotifType = 'reminder' | 'overdue' | 'sync' | 'backup' | 'app' | 'check'

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
  /** DICGC deposit insurance limit per person per bank (₹) */
  bankLimit: number
  /** Health-check issues the user dismissed */
  dismissedChecks: string[]
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
  bankLimit: 500000,
  dismissedChecks: [],
}

export const BIN_DAYS = 30
