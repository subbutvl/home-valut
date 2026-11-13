import { CATEGORIES, getCategory } from './categories'
import type { Item } from './types'

export interface SearchHit {
  item: Item
  /** Short "where it matched" line, e.g. "Policy number: 11240098" */
  match: string
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
const compact = (s: string) => s.toLowerCase().replace(/[\s\-/.]/g, '')

/** Searchable, non-secret text of an item as (label, value) pairs. */
function searchable(item: Item): [string, string][] {
  const cat = getCategory(item.category)
  const out: [string, string][] = [
    ['Name', item.name],
    ['Category', cat.name],
  ]
  if (item.subcategory) out.push(['Type', item.subcategory])
  for (const fd of cat.fields) {
    const v = item.fields[fd.key]
    if (v && !fd.secret) out.push([fd.label, v])
  }
  for (const c of item.custom) if (!c.secret && c.value) out.push([c.label || 'Field', c.value])
  if (item.belongsTo.length) out.push(['Belongs to', item.belongsTo.join(', ')])
  if (item.nominees.length) out.push(['Nominee', item.nominees.map((n) => n.name).join(', ')])
  if (item.tags.length) out.push(['Tag', item.tags.join(', ')])
  if (item.notes) out.push(['Notes', item.notes])
  return out
}

function snippet(value: string, q: string): string {
  if (value.length <= 60) return value
  const i = value.toLowerCase().indexOf(q)
  const start = Math.max(0, i - 20)
  return `${start > 0 ? '…' : ''}${value.slice(start, start + 60)}…`
}

/**
 * Find items as you type. Every word must match somewhere in the item.
 * Secret fields are never searched. "TN 09" also matches "TN09".
 */
export function search(items: Item[], query: string): SearchHit[] {
  const q = norm(query)
  if (!q) return []
  const words = q.split(' ')
  const hits: { hit: SearchHit; score: number }[] = []
  for (const item of items) {
    if (item.deletedAt) continue
    const pairs = searchable(item)
    const hay = pairs.map(([, v]) => v.toLowerCase()).join('\n')
    const hayCompact = compact(hay)
    const ok = words.every((w) => hay.includes(w) || hayCompact.includes(compact(w)))
    if (!ok) continue
    // Best "match" line: first non-name field that contains the whole query, else the first word.
    const qc = compact(q)
    const found =
      pairs.find(([l, v]) => l !== 'Name' && (v.toLowerCase().includes(q) || compact(v).includes(qc))) ??
      pairs.find(([l, v]) => l !== 'Name' && v.toLowerCase().includes(words[0]))
    const nameHit = item.name.toLowerCase().includes(q)
    const score = (item.name.toLowerCase().startsWith(q) ? 3 : 0) + (nameHit ? 2 : 0) + (item.favourite ? 1 : 0)
    const detail = getCategory(item.category).rowDetail?.(item.fields) ?? ''
    hits.push({
      score,
      hit: { item, match: found && !nameHit ? `${found[0]}: ${snippet(found[1], q)}` : detail },
    })
  }
  return hits.sort((a, b) => b.score - a.score || a.hit.item.name.localeCompare(b.hit.item.name)).map((h) => h.hit)
}

/** Group hits by category in the standard category order. */
export function groupByCategory(hits: SearchHit[]) {
  return CATEGORIES.map((c) => ({ category: c, hits: hits.filter((h) => h.item.category === c.id) })).filter(
    (g) => g.hits.length,
  )
}
