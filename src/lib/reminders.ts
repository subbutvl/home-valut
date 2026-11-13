// Coming up, Mark done and the subscription total (spec section 6).
// Nothing here records payments: "Done" only moves a date to its next cycle.

import { formatINR, getCategory, type FieldDef } from './categories'
import { daysUntil, parseDate } from './dates'
import type { Item, Settings } from './types'

const FREQ_MONTHS: Record<string, number> = {
  Monthly: 1,
  'Bi-monthly': 2,
  Quarterly: 3,
  'Half-yearly': 6,
  Yearly: 12,
}

/** Which field holds "how often" for items whose dates repeat by their own cycle. */
const CYCLE_FIELD: Record<string, { key: string; fallback: string }> = {
  insurance: { key: 'frequency', fallback: 'Yearly' },
  subscription: { key: 'frequency', fallback: 'Monthly' },
  utility: { key: 'cycle', fallback: 'Monthly' },
  property: { key: '', fallback: 'Yearly' },
}

/** The amount shown next to a due date, if the item has one. */
const AMOUNT_FIELD: Record<string, string[]> = {
  deposit: ['maturityAmount', 'amount'],
  insurance: ['premium'],
  subscription: ['amount'],
  loan: ['emi'],
  utility: ['usualAmount'],
  locker: ['rent'],
  card: [],
}

export interface DueEntry {
  item: Item
  field: FieldDef
  /** The stored value, e.g. 2026-12-12 */
  value: string
  date: Date
  days: number
  label: string
  /** Months to move forward on "Done"; 0 = one-off */
  repeatMonths: number
  amount?: string
  lead: number
}

function repeatMonths(item: Item, fd: FieldDef): number {
  const r = fd.reminder?.repeat
  if (r === 'monthly') return 1
  if (r === 'yearly') return 12
  if (r === 'cycle') {
    const c = CYCLE_FIELD[item.category]
    const freq = (c?.key && item.fields[c.key]) || c?.fallback || 'Yearly'
    return FREQ_MONTHS[freq] ?? 0
  }
  return 0
}

/** Bills and subscriptions remind a week ahead; maturities, policies, warranties and IDs a month ahead. */
export function leadFor(item: Item, months: number, s: Pick<Settings, 'leadLong' | 'leadShort'>): number {
  if (item.leadDays !== undefined) return item.leadDays
  const short = months === 1 || months === 2 || ['subscription', 'utility', 'card'].includes(item.category)
  return short ? s.leadShort : s.leadLong
}

export function dueEntries(item: Item, s: Pick<Settings, 'leadLong' | 'leadShort'>): DueEntry[] {
  if (item.deletedAt) return []
  const out: DueEntry[] = []
  for (const fd of getCategory(item.category).fields) {
    if (!fd.reminder) continue
    const value = item.fields[fd.key]
    if (!value || item.done?.[fd.key] === value) continue
    const date = parseDate(value, fd.type)
    if (!date) continue
    const months = repeatMonths(item, fd)
    const amountKey = AMOUNT_FIELD[item.category]?.find((k) => item.fields[k])
    out.push({
      item,
      field: fd,
      value,
      date,
      days: daysUntil(date),
      label: fd.reminder.label,
      repeatMonths: months,
      amount: amountKey ? `₹${formatINR(item.fields[amountKey])}` : undefined,
      lead: leadFor(item, months, s),
    })
  }
  return out
}

export function allDue(items: Item[], s: Pick<Settings, 'leadLong' | 'leadShort'>): DueEntry[] {
  return items.flatMap((i) => dueEntries(i, s)).sort((a, b) => a.date.getTime() - b.date.getTime())
}

export interface ComingUpGroups {
  overdue: DueEntry[]
  soon: DueEntry[]
  later: DueEntry[]
}

/** Overdue (red), next 30 days (orange), 31–90 days (grey). */
export function groupComingUp(entries: DueEntry[]): ComingUpGroups {
  return {
    overdue: entries.filter((e) => e.days < 0),
    soon: entries.filter((e) => e.days >= 0 && e.days <= 30),
    later: entries.filter((e) => e.days > 30 && e.days <= 90),
  }
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function addMonths(d: Date, n: number): Date {
  const day = d.getDate()
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, last))
  return r
}

/** The item after "Done": repeating dates move one cycle on; one-off dates are marked done. */
export function afterDone(e: DueEntry): Item {
  if (e.repeatMonths > 0 && e.field.type === 'date') {
    return { ...e.item, fields: { ...e.item.fields, [e.field.key]: iso(addMonths(e.date, e.repeatMonths)) } }
  }
  return { ...e.item, done: { ...e.item.done, [e.field.key]: e.value } }
}

export function dueLine(e: DueEntry): string {
  return [e.item.name, e.label.toLowerCase(), e.amount].filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------------------
// Subscription total: a reference figure, yearly and quarterly plans as per month.

export interface SubTotal {
  perMonth: number
  perYear: number
  rows: { item: Item; perMonth: number }[]
}

export function subscriptionTotal(items: Item[]): SubTotal {
  const rows = items
    .filter((i) => i.category === 'subscription' && !i.deletedAt)
    .map((item) => {
      const amt = Number(String(item.fields.amount ?? '').replace(/[,₹\s]/g, '')) || 0
      const months = FREQ_MONTHS[item.fields.frequency || 'Monthly'] ?? 1
      return { item, perMonth: amt / months }
    })
    .filter((r) => r.perMonth > 0)
    .sort((a, b) => b.perMonth - a.perMonth)
  const perMonth = rows.reduce((s, r) => s + r.perMonth, 0)
  return { perMonth: Math.round(perMonth), perYear: Math.round(perMonth * 12), rows }
}
