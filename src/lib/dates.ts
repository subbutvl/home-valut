import { getCategory } from './categories'
import type { Item } from './types'

const DAY = 86_400_000

/** Parse a stored date: ISO (YYYY-MM-DD) or card expiry MM/YY (→ last day of that month). */
export function parseDate(v: string | undefined, type: 'date' | 'expiry' | string = 'date'): Date | null {
  if (!v) return null
  if (type === 'expiry') {
    const m = v.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/)
    if (!m) return null
    const yr = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])
    return new Date(yr, Number(m[1]), 0)
  }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

export function today(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function daysUntil(d: Date): number {
  return Math.round((d.getTime() - today().getTime()) / DAY)
}

export interface Due {
  date: Date
  label: string
  days: number
}

/** The soonest reminder date on an item (including overdue ones). */
export function nextDue(item: Item): Due | null {
  let best: Due | null = null
  for (const fd of getCategory(item.category).fields) {
    if (!fd.reminder) continue
    const date = parseDate(item.fields[fd.key], fd.type)
    if (!date) continue
    const due = { date, label: fd.reminder.label, days: daysUntil(date) }
    // Prefer overdue/upcoming over long-past dates on non-repeating fields
    if (!best || due.date < best.date) best = due
  }
  return best
}

export type Urgency = 'overdue' | 'soon' | 'later' | 'none'

export function urgency(due: Due | null, leadDays = 30): Urgency {
  if (!due) return 'none'
  if (due.days < 0) return 'overdue'
  if (due.days <= leadDays) return 'soon'
  return due.days <= 90 ? 'later' : 'none'
}

export function shortDate(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function dueText(due: Due): string {
  if (due.days < 0) return `${due.label} · overdue`
  if (due.days === 0) return `${due.label} today`
  return `${due.label} ${shortDate(due.date)}`
}

export function isStale(iso: string | undefined, days = 90): boolean {
  const d = parseDate(iso)
  return !!d && daysUntil(d) < -days
}
