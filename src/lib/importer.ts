// Excel / CSV import (spec section 5). Files are read on this device only.

import { formatINR, getCategory, type CategoryDef, type FieldDef } from './categories'
import type { Item } from './types'
import { blankItem, newId } from './vault'

/** Where a spreadsheet column goes. */
export type Target =
  | { kind: 'skip' }
  | { kind: 'name' | 'type' | 'belongsTo' | 'nominee' | 'tags' | 'notes' }
  | { kind: 'field'; key: string }
  | { kind: 'custom'; label: string }

export const BASE_TARGETS: { kind: 'name' | 'type' | 'belongsTo' | 'nominee' | 'tags' | 'notes'; label: string }[] = [
  { kind: 'name', label: 'Name' },
  { kind: 'type', label: 'Type' },
  { kind: 'belongsTo', label: 'Belongs to' },
  { kind: 'nominee', label: 'Nominee' },
  { kind: 'tags', label: 'Tags' },
  { kind: 'notes', label: 'Notes' },
]

export function targetKey(t: Target): string {
  if (t.kind === 'field') return `field:${t.key}`
  if (t.kind === 'custom') return `custom:${t.label}`
  return t.kind
}

export function targetFromKey(key: string): Target {
  if (key.startsWith('field:')) return { kind: 'field', key: key.slice(6) }
  if (key.startsWith('custom:')) return { kind: 'custom', label: key.slice(7) }
  return { kind: key as 'name' }
}

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)|[^a-z0-9]/g, '')

/** Guess where each column goes by its heading. */
export function autoMap(headers: string[], cat: CategoryDef): Target[] {
  const used = new Set<string>()
  return headers.map((h) => {
    const n = norm(h)
    if (!n) return { kind: 'skip' }
    const base = BASE_TARGETS.find((b) => norm(b.label) === n || (b.kind === 'type' && n === 'subcategory'))
    let t: Target | null = base ? { kind: base.kind } : null
    if (!t) {
      const f = cat.fields.find((fd) => norm(fd.label) === n || norm(fd.key) === n) ??
        cat.fields.find((fd) => norm(fd.label).startsWith(n) || n.startsWith(norm(fd.label)))
      const words = (s: string) => s.toLowerCase().replace(/(.*?)/g, '').split(/[^a-z0-9]+/).filter(Boolean)
      const hw = words(h)
      // "FD number" matches "FD/RD number": every word of the heading is in the label.
      const byWords = f ?? (hw.length >= 2 ? cat.fields.find((fd) => hw.every((w) => words(fd.label).includes(w))) : undefined)
      if (byWords) t = { kind: 'field', key: byWords.key }
    }
    if (!t) return { kind: 'custom', label: h.trim() }
    const k = targetKey(t)
    if (used.has(k)) return { kind: 'skip' }
    used.add(k)
    return t
  })
}

// ---------------------------------------------------------------------------
// Reading files

export type Cell = string | number | boolean | Date | null

/** Simple CSV reader: quotes, escaped quotes, commas and new lines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',' || c === ';' || c === '\t') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export async function readFile(file: File): Promise<Cell[][]> {
  if (/\.csv$|\.txt$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text())
  const { readSheet } = await import('read-excel-file/browser')
  const data = (await readSheet(file)) as unknown as Cell[][]
  return data.filter((r) => r.some((c) => c !== null && String(c).trim() !== ''))
}

// ---------------------------------------------------------------------------
// Turning cells into values, with problems reported per cell

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Dates as DD/MM/YYYY, DD-MM-YY, YYYY-MM-DD, "12 Dec 2026" or Excel dates. */
export function parseDateCell(v: Cell): string | null {
  if (v === null || v === '') return ''
  if (v instanceof Date) return isNaN(v.getTime()) ? null : iso(new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()))
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000)
    return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime()) && /[a-z]/i.test(s)) return iso(parsed)
  return null
}

function valid(y: number, mo: number, d: number): string | null {
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? iso(dt) : null
}

function parseValue(fd: FieldDef, v: Cell): { value: string; problem?: string } {
  if (v === null || String(v).trim() === '') return { value: '' }
  const s = v instanceof Date ? '' : String(v).trim()
  switch (fd.type) {
    case 'date': {
      const d = parseDateCell(v)
      return d === null ? { value: s, problem: 'Not a date (use DD/MM/YYYY)' } : { value: d }
    }
    case 'expiry': {
      if (v instanceof Date) return { value: `${pad(v.getUTCMonth() + 1)}/${String(v.getUTCFullYear()).slice(2)}` }
      const m = s.match(/^(\d{1,2})\s*[/-]\s*(\d{2}|\d{4})$/)
      return m ? { value: `${pad(+m[1])}/${m[2].slice(-2)}` } : { value: s, problem: 'Expiry should be MM/YY' }
    }
    case 'amount':
    case 'number': {
      const n = typeof v === 'number' ? v : Number(s.replace(/[,₹\s%]|rs\.?|inr/gi, ''))
      return Number.isFinite(n) ? { value: String(n) } : { value: s, problem: 'Not a number' }
    }
    case 'bool':
      if (typeof v === 'boolean') return { value: v ? 'yes' : 'no' }
      if (/^(y|yes|true|1)$/i.test(s)) return { value: 'yes' }
      if (/^(n|no|false|0)$/i.test(s)) return { value: 'no' }
      return { value: '', problem: 'Use yes or no' }
    case 'select': {
      const o = fd.options?.find((x) => x.toLowerCase() === s.toLowerCase())
      return { value: o ?? s }
    }
    default:
      return { value: v instanceof Date ? iso(v) : s }
  }
}

const list = (v: Cell) =>
  String(v ?? '')
    .split(/[,;/&]| and /i)
    .map((x) => x.trim())
    .filter(Boolean)

export interface RowResult {
  index: number
  item: Item
  problems: Record<number, string>
  newPeople: string[]
}

/** Build an item from one spreadsheet row. Problems are keyed by column number. */
export function buildRow(
  cells: Cell[],
  map: Target[],
  cat: CategoryDef,
  members: string[],
  index: number,
): RowResult {
  const item = blankItem(cat.id)
  const problems: Record<number, string> = {}
  const newPeople = new Set<string>()
  const known = new Map(members.map((m) => [m.toLowerCase(), m]))
  const person = (n: string) => {
    const k = known.get(n.toLowerCase())
    if (k) return k
    newPeople.add(n)
    return n
  }
  map.forEach((t, col) => {
    const v = cells[col] ?? null
    const s = v === null ? '' : v instanceof Date ? iso(v) : String(v).trim()
    switch (t.kind) {
      case 'skip':
        return
      case 'name':
        item.name = s
        return
      case 'type':
        item.subcategory = s || undefined
        return
      case 'belongsTo':
        item.belongsTo = list(v).map(person)
        return
      case 'nominee':
        item.nominees = list(v).map((x) => {
          const m = x.match(/^(.*?)\s*(\d{1,3})\s*%$/)
          return m ? { name: person(m[1]), share: m[2] } : { name: person(x) }
        })
        return
      case 'tags':
        item.tags = list(v)
        return
      case 'notes':
        item.notes = s
        return
      case 'custom':
        if (s) item.custom.push({ id: newId(), label: t.label, value: s })
        return
      case 'field': {
        const fd = cat.fields.find((f) => f.key === t.key)
        if (!fd) return
        const r = parseValue(fd, v)
        // A value that could not be read is left out rather than saved wrong.
        if (r.problem) problems[col] = r.problem
        else if (r.value) item.fields[fd.key] = r.value
      }
    }
  })
  if (!item.name.trim()) {
    const nameCol = map.findIndex((t) => t.kind === 'name')
    problems[nameCol >= 0 ? nameCol : -1] = 'Name is missing'
  }
  return { index, item, problems, newPeople: [...newPeople] }
}

// ---------------------------------------------------------------------------
// Template: one column per field and an example row

const EXAMPLE: Record<string, string> = {
  amount: '200000',
  balance: '84320',
  premium: '24500',
  rate: '7.1',
  bank: 'SBI',
  insurer: 'Star Health',
}

export async function downloadTemplate(catId: string) {
  const cat = getCategory(catId)
  const fields = cat.fields
  const headers = ['Name', 'Type', 'Belongs to', 'Nominee', 'Tags', ...fields.map((f) => f.label), 'Notes']
  const sample = (fd: FieldDef) => {
    if (EXAMPLE[fd.key]) return EXAMPLE[fd.key]
    if (fd.type === 'date') return '12/12/2026'
    if (fd.type === 'expiry') return '08/29'
    if (fd.type === 'bool') return 'yes'
    if (fd.type === 'select') return fd.options?.[0] ?? ''
    if (fd.secret) return ''
    return ''
  }
  const example = [
    `Example ${cat.short.toLowerCase()} (delete this row)`,
    cat.subcategories[0] ?? '',
    'Self',
    cat.hasNominee ? 'Spouse 100%' : '',
    '',
    ...fields.map(sample),
    '',
  ]
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const data = [
    headers.map((h) => ({ value: h, fontWeight: 'bold' as const })),
    example.map((v) => ({ value: v })),
  ]
  await writeXlsxFile(data, {
    columns: headers.map((h) => ({ width: Math.max(14, Math.min(32, h.length + 4)) })),
  }).toFile(`homevault-${catId}-template.xlsx`)
}

export function describe(fd: FieldDef, value: string): string {
  if (fd.type === 'amount') return `₹${formatINR(value)}`
  return value
}

/** Undo a whole import: the items it added are deleted for good. */
export async function undoImport(importId: string): Promise<number> {
  const { getState, deleteForever } = await import('./vault')
  const added = getState().items.filter((x) => x.importId === importId)
  for (const x of added) await deleteForever(x.id)
  return added.length
}
