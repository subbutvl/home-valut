// Health check (spec section 6): missing nominees, the ₹5 lakh bank limit and
// password health. Everything is worked out on this device only.

import { CATEGORY_BY_ID, getCategory } from './categories'
import type { Item, Settings } from './types'

const num = (v?: string) => Number(String(v ?? '').replace(/[,₹\s]/g, '')) || 0

export interface NomineeIssue {
  person: string
  items: Item[]
}

/** Bank accounts, deposits, investments and insurance with no nominee, grouped by person. */
export function missingNominees(items: Item[]): NomineeIssue[] {
  const groups = new Map<string, Item[]>()
  for (const i of items) {
    if (i.deletedAt || !CATEGORY_BY_ID[i.category]?.hasNominee || i.nominees.length) continue
    if (i.category === 'locker') continue
    const person = i.belongsTo.join(' & ') || 'Not set'
    groups.set(person, [...(groups.get(person) ?? []), i])
  }
  return [...groups.entries()].map(([person, items]) => ({ person, items }))
}

export interface BankLimitIssue {
  key: string
  person: string
  bank: string
  total: number
  items: Item[]
}

/** Savings balance (if typed) plus FDs per person per bank, above the DICGC limit. */
export function bankLimitIssues(items: Item[], limit: number): BankLimitIssue[] {
  const groups = new Map<string, BankLimitIssue>()
  for (const i of items) {
    if (i.deletedAt || (i.category !== 'bank' && i.category !== 'deposit')) continue
    const bank = (i.fields.bank ?? '').trim()
    if (!bank) continue
    const amount = i.category === 'bank' ? num(i.fields.balance) : num(i.fields.amount)
    if (!amount) continue
    const person = i.belongsTo.join(' & ') || 'Self'
    const key = `${person.toLowerCase()}|${bank.toLowerCase().replace(/\s+/g, ' ')}`
    const g = groups.get(key) ?? { key, person, bank, total: 0, items: [] }
    g.total += amount
    g.items.push(i)
    groups.set(key, g)
  }
  return [...groups.values()].filter((g) => g.total > limit).sort((a, b) => b.total - a.total)
}

const COMMON = new Set([
  'password', 'password1', 'password123', '123456', '1234567', '12345678', '123456789', '1234567890', 'qwerty',
  'qwerty123', 'iloveyou', 'admin', 'admin123', 'welcome', 'welcome1', 'letmein', 'abc123', 'monkey', 'dragon',
  'sunshine', 'princess', 'india123', 'india@123', 'password@123', 'pass@123', 'test123', '111111', '000000',
])

export type PasswordProblem = 'short' | 'common' | 'reused'

export interface PasswordIssue {
  item: Item
  label: string
  problems: PasswordProblem[]
}

/** Every password-like secret on an item: fields named password, and custom secrets labelled password. */
function passwords(i: Item): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const f of getCategory(i.category).fields)
    if (f.secret && /password/i.test(f.key) && i.fields[f.key]) out.push({ label: f.label, value: i.fields[f.key] })
  for (const c of i.custom) if (c.secret && /password|passcode/i.test(c.label) && c.value) out.push({ label: c.label, value: c.value })
  return out
}

/** Shorter than 10, a common one, or the same password on more than one item. */
export function passwordIssues(items: Item[]): PasswordIssue[] {
  const live = items.filter((i) => !i.deletedAt)
  const usedOn = new Map<string, Set<string>>()
  for (const i of live) for (const p of passwords(i)) usedOn.set(p.value, (usedOn.get(p.value) ?? new Set()).add(i.id))
  const out: PasswordIssue[] = []
  for (const i of live)
    for (const p of passwords(i)) {
      const problems: PasswordProblem[] = []
      if (p.value.length < 10) problems.push('short')
      if (COMMON.has(p.value.toLowerCase())) problems.push('common')
      if ((usedOn.get(p.value)?.size ?? 0) > 1) problems.push('reused')
      if (problems.length) out.push({ item: i, label: p.label, problems })
    }
  return out
}

export const PROBLEM_TEXT: Record<PasswordProblem, string> = {
  short: 'shorter than 10 characters',
  common: 'a very common password',
  reused: 'also used on another item',
}

export interface HealthReport {
  nominees: NomineeIssue[]
  bankLimit: BankLimitIssue[]
  passwords: PasswordIssue[]
  count: number
}

export function healthReport(items: Item[], s: Pick<Settings, 'bankLimit' | 'dismissedChecks'>): HealthReport {
  const dismissed = new Set(s.dismissedChecks)
  const nominees = missingNominees(items)
  const bankLimit = bankLimitIssues(items, s.bankLimit).filter((b) => !dismissed.has(`limit:${b.key}`))
  const pw = passwordIssues(items)
  const count = nominees.reduce((n, g) => n + g.items.length, 0) + bankLimit.length + pw.length
  return { nominees, bankLimit, passwords: pw, count }
}
