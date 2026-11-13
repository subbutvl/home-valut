// What goes on paper or into a shared message. Secrets follow the chosen mode:
// hidden (••••, the default), shown (needs the master password) or left out.

import { formatDate, formatINR, getCategory, type FieldDef } from './categories'
import type { Item } from './types'

export type SecretMode = 'hidden' | 'shown' | 'omit'

export interface Line {
  label: string
  value: string
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
export function itemAsText(item: Item, mode: SecretMode): string {
  const cat = getCategory(item.category)
  const lines = [`*${item.name}*`, [cat.name, itemMeta(item)].filter(Boolean).join(' · ')]
  for (const l of itemLines(item, mode, { notes: true })) lines.push(`${l.label}: ${l.value}`)
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
