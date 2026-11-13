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
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export interface Member {
  id: string
  name: string
  relationship: string
}

export interface Settings {
  members: Member[]
  autoLockMinutes: number
  recentlyViewed: string[]
  favouriteOrder: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  members: [{ id: 'self', name: 'Self', relationship: 'Self' }],
  autoLockMinutes: 1,
  recentlyViewed: [],
  favouriteOrder: [],
}

export const BIN_DAYS = 30
