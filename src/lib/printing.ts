// What goes on paper or into a shared message. Secrets follow the chosen mode:
// hidden (••••, the default), shown (needs the master password) or left out.

import { BANK_LINK_LABEL, formatDate, formatINR, getCategory, type FieldDef } from './categories'
import type { Item } from './types'

export type SecretMode = 'hidden' | 'shown' | 'omit'

export interface Line {
  label: string
  value: string
  /** Empty field, printed as a line to fill in by hand */
  blank?: boolean
}

function show(fd: FieldDef, v: string): string {
  if (fd.type === 'amount') return `₹${formatINR(v)}`
  if (fd.type === 'date') return formatDate(v)
  if (fd.type === 'bool') return v === 'yes' ? 'Yes' : 'No'
  if (fd.key === 'rate') return `${v}%`
  return v
}

/** Every filled field of an item as label/value lines, secrets per mode. */
export function itemLines(item: Item, mode: SecretMode, opts: { notes?: boolean; only?: string[] } = {}): Line[] {
  const cat = getCategory(item.category)
  const out: Line[] = []
  for (const fd of cat.fields) {
    if (opts.only && !opts.only.includes(fd.key)) continue
    const v = item.fields[fd.key]
    if (!v) continue
    if (fd.secret) {
      if (mode === 'omit') continue
      out.push({ label: fd.label, value: mode === 'shown' ? v : '••••••' })
    } else out.push({ label: fd.label, value: show(fd, v) })
  }
  if (!opts.only || opts.only.includes('nominee'))
    if (item.nominees.length)
      out.push({
        label: item.nominees.length > 1 ? 'Nominees' : 'Nominee',
        value: item.nominees.map((n) => `${n.name}${n.share ? ` ${n.share}%` : ''}`).join(', '),
      })
  if (!opts.only)
    for (const c of item.custom) {
      if (!c.value) continue
      if (c.secret && mode === 'omit') continue
      out.push({ label: c.label || 'Field', value: c.secret && mode === 'hidden' ? '••••••' : c.value })
    }
  if (opts.notes && item.notes) out.push({ label: 'Notes', value: item.notes })
  return out
}

export function itemMeta(item: Item): string {
  return [item.subcategory, item.belongsTo.join(', ')].filter(Boolean).join(' · ')
}

/** A neat plain-text summary for WhatsApp or any app. */
export function itemAsText(item: Item, mode: SecretMode, accountName?: string): string {
  const cat = getCategory(item.category)
  const lines = [`*${item.name}*`, [cat.name, itemMeta(item)].filter(Boolean).join(' · ')]
  for (const l of itemLines(item, mode, { notes: true })) lines.push(`${l.label}: ${l.value}`)
  if (accountName) lines.push(`${BANK_LINK_LABEL[item.category] ?? 'Bank account'}: ${accountName}`)
  if (item.lockerContents?.length) {
    lines.push('Contents:')
    for (const e of item.lockerContents) lines.push(`- ${e.item}${e.description ? ` (${e.description})` : ''}`)
  }
  lines.push('', 'Shared from HomeVault')
  return lines.join('\n')
}

export function printedOn(): string {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Page size, margins and the footer on every printed page. */
export function pageCss(): string {
  const d = printedOn()
  return `@page { size: A4; margin: 14mm 14mm 16mm; @bottom-left { content: "Printed on ${d}"; font-size: 8pt; color: #555; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #555; } }
@media print { html, body { background: #fff !important; } }`
}

export interface Section {
  title: string
  lines: Line[]
}

const LOGIN_KEYS = /login|user|netbanking|registered|customerCare|helpline|servicePhone|branchPhone|agent/i
const PEOPLE_KEYS = /^(holders|owners|owner|insured|borrowers|cardHolder|person|sharedWith)$/

/**
 * An item's details in readable groups: key details, people, dates and money,
 * contact and login, other details, passwords and PINs, extra fields, notes.
 */
export function itemSections(
  item: Item,
  mode: SecretMode,
  opts: { notes?: boolean; only?: string[]; accountName?: string; blanks?: boolean; custom?: boolean } = {},
): Section[] {
  const cat = getCategory(item.category)
  const groups: Record<string, Line[]> = {
    key: [],
    people: [],
    money: [],
    contact: [],
    other: [],
    secret: [],
    extra: [],
  }
  const allow = (k: string) => !opts.only || opts.only.includes(k)
  for (const fd of cat.fields) {
    const v = item.fields[fd.key]
    // App-only switches are not printed.
    if (!allow(fd.key) || fd.key === 'onFamilySheet') continue
    // With blanks on, empty fields print as a line to write on (blank: true).
    if (!v && !opts.blanks) continue
    if (fd.secret) {
      if (!v || mode === 'omit') {
        if (opts.blanks) groups.secret.push({ label: fd.label, value: '', blank: true })
      } else groups.secret.push({ label: fd.label, value: mode === 'shown' ? v : '••••••' })
      continue
    }
    const line: Line = v ? { label: fd.label, value: show(fd, v) } : { label: fd.label, value: '', blank: true }
    if (PEOPLE_KEYS.test(fd.key)) groups.people.push(line)
    else if (fd.main) groups.key.push(line)
    else if (['date', 'amount', 'expiry'].includes(fd.type) || fd.key === 'rate' || fd.key === 'payout' || fd.key === 'frequency') groups.money.push(line)
    else if (['phone', 'email', 'url'].includes(fd.type) || LOGIN_KEYS.test(fd.key)) groups.contact.push(line)
    else groups.other.push(line)
  }
  if (opts.accountName && allow('linkedAccount'))
    groups.key.push({ label: BANK_LINK_LABEL[item.category] ?? 'Bank account', value: opts.accountName })
  if (!opts.only || opts.only.includes('belongsTo'))
    if (item.belongsTo.length) groups.people.unshift({ label: item.belongsTo.length > 1 ? 'Belongs to (joint)' : 'Belongs to', value: item.belongsTo.join(', ') })
  if (opts.blanks && allow('nominee') && !item.nominees.length && getCategory(item.category).hasNominee)
    groups.people.push({ label: 'Nominee', value: '', blank: true })
  if (allow('nominee') && item.nominees.length)
    groups.people.push({
      label: item.nominees.length > 1 ? 'Nominees' : 'Nominee',
      value: item.nominees.map((n) => `${n.name}${n.share ? ` (${n.share}%)` : ''}`).join(', '),
    })
  if (!opts.only && opts.custom !== false)
    for (const c of item.custom) {
      if (!c.value) continue
      if (c.secret) {
        if (mode !== 'omit') groups.secret.push({ label: c.label || 'Field', value: mode === 'shown' ? c.value : '••••••' })
      } else groups.extra.push({ label: c.label || 'Field', value: c.value })
    }
  const titles: [keyof typeof groups, string][] = [
    ['key', 'Key details'],
    ['people', 'People'],
    ['money', 'Dates and amounts'],
    ['contact', 'Contact and login'],
    ['other', 'Other details'],
    ['extra', 'Extra fields'],
    ['secret', 'Passwords and PINs'],
  ]
  const out = titles.filter(([k]) => groups[k].length).map(([k, title]) => ({ title, lines: groups[k] }))
  if (opts.notes && item.notes) out.push({ title: 'Notes', lines: [{ label: '', value: item.notes }] })
  return out
}

/**
 * For printing, items linked to a bank account that is also being printed go
 * with that account (one group), and are taken out of their own category.
 */
export function groupLinked(items: Item[]): { linkedTo: Map<string, Item[]>; pulled: Set<string> } {
  const banks = new Set(items.filter((i) => i.category === 'bank').map((i) => i.id))
  const linkedTo = new Map<string, Item[]>()
  const pulled = new Set<string>()
  for (const i of items) {
    if (i.category === 'bank' || !i.linkedAccountId || !banks.has(i.linkedAccountId)) continue
    linkedTo.set(i.linkedAccountId, [...(linkedTo.get(i.linkedAccountId) ?? []), i])
    pulled.add(i.id)
  }
  const ORDER = ['card', 'deposit', 'locker', 'loan', 'investment', 'utility', 'subscription']
  for (const list of linkedTo.values())
    list.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.name.localeCompare(b.name))
  return { linkedTo, pulled }
}

const amt = (v?: string) => Number(String(v ?? '').replace(/[,₹\s]/g, '')) || 0

export interface MoneyRow {
  label: string
  count: number
  total: number
  /** amount-weighted average rate, % p.a. (only rows with a rate count) */
  avgRate?: number
  /** approx. interest a year from amount × rate */
  yearly?: number
}

export interface MoneySummary {
  rows: MoneyRow[]
  total: number
  yearly: number
  avgRate?: number
  oldestBalance?: string
}

/**
 * Reference totals for the first printed page: savings balances (as typed),
 * FDs/RDs and bonds/investments, with approx. yearly interest from amount × rate.
 * Nothing here is an account statement; the page labels it approx.
 */
export function moneySummary(items: Item[]): MoneySummary | null {
  const live = items.filter((i) => !i.deletedAt)
  const sum = (list: Item[], key: string, label: string): MoneyRow | null => {
    if (!list.length) return null
    let total = 0
    let rated = 0
    let yearly = 0
    for (const i of list) {
      const a = amt(i.fields[key])
      total += a
      const r = amt(i.fields.rate)
      if (a && r) {
        rated += a
        yearly += (a * r) / 100
      }
    }
    return { label, count: list.length, total, avgRate: rated ? (yearly / rated) * 100 : undefined, yearly: yearly || undefined }
  }
  const banks = live.filter((i) => i.category === 'bank')
  const rows = [
    sum(banks, 'balance', 'Savings and current accounts (balance as typed)'),
    sum(live.filter((i) => i.category === 'deposit'), 'amount', 'Fixed and recurring deposits'),
    sum(live.filter((i) => i.category === 'investment'), 'invested', 'Bonds and investments (amount invested)'),
  ].filter((r): r is MoneyRow => !!r)
  if (!rows.length) return null
  const total = rows.reduce((s, r) => s + r.total, 0)
  const yearly = rows.reduce((s, r) => s + (r.yearly ?? 0), 0)
  const rated = rows.reduce((s, r) => s + (r.avgRate ? r.total : 0), 0)
  const dates = banks.map((b) => b.fields.balanceAsOf).filter(Boolean).sort()
  return { rows, total, yearly, avgRate: rated && yearly ? (yearly / rated) * 100 : undefined, oldestBalance: dates[0] }
}
