import { Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/common'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Input } from '@/components/ui/input'
import { formatINR, itemPath } from '@/lib/categories'
import type { LockerEntry } from '@/lib/types'
import { newId, useVault } from '@/lib/vault'

const sel = 'h-11 w-full rounded-xl border border-input bg-card px-3 text-base'
const num = (v?: string) => Number(String(v ?? '').replace(/[,₹\s]/g, '')) || 0

/** Edit the list of what is kept in a locker. */
export function LockerContentsEditor({ value, onChange }: { value: LockerEntry[]; onChange: (v: LockerEntry[]) => void }) {
  const { items, settings } = useVault()
  const linkable = items.filter((i) => !i.deletedAt && ['gold', 'property', 'id'].includes(i.category))
  const upd = (id: string, patch: Partial<LockerEntry>) => onChange(value.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-foreground/80">Contents of the locker</span>
      {value.map((e) => (
        <div key={e.id} className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <Input aria-label="Item" placeholder="Item, e.g. Gold necklace" value={e.item} onChange={(x) => upd(e.id, { item: x.target.value })} />
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onChange(value.filter((x) => x.id !== e.id))}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>
          </div>
          <Input aria-label="Description" placeholder="Description (optional)" value={e.description ?? ''} onChange={(x) => upd(e.id, { description: x.target.value })} className="h-11" />
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute top-0 left-3 flex h-11 items-center text-muted-foreground">₹</span>
              <Input
                aria-label="Approx. value"
                inputMode="decimal"
                placeholder="Approx. value"
                value={e.value ?? ''}
                onChange={(x) => upd(e.id, { value: x.target.value.replace(/[^\d.]/g, '') })}
                className="h-11 pl-7"
              />
            </div>
            <select aria-label="Owner" value={e.owner ?? ''} onChange={(x) => upd(e.id, { owner: x.target.value || undefined })} className={sel}>
              <option value="">Owner</option>
              {settings.members.map((m) => (
                <option key={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {linkable.length > 0 && (
            <select aria-label="Linked item" value={e.linkId ?? ''} onChange={(x) => upd(e.id, { linkId: x.target.value || undefined })} className={sel}>
              <option value="">Link to a Gold, Property or ID item (optional)</option>
              {linkable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { id: newId(), item: '' }])}
        className="flex items-center gap-1 self-start text-[13px] font-semibold text-primary"
      >
        <Plus className="size-4" /> Add something kept in the locker
      </button>
    </div>
  )
}

/** Show what is kept in a locker, with the approx. total for reference. */
export function LockerContentsView({ value }: { value: LockerEntry[] }) {
  const { items } = useVault()
  const list = value.filter((e) => e.item.trim())
  if (!list.length) return null
  const total = list.reduce((s, e) => s + num(e.value), 0)
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-[15px] font-semibold">Contents · {list.length}</span>
        {total > 0 && <span className="text-[13px] text-muted-foreground">approx. ₹{formatINR(total)} · reference only</span>}
      </div>
      {list.map((e) => {
        const linked = e.linkId ? items.find((i) => i.id === e.linkId && !i.deletedAt) : undefined
        return (
          <div key={e.id} className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-medium">{e.item}</span>
              <span className="text-[13px] text-muted-foreground">{[e.description, e.owner].filter(Boolean).join(' · ')}</span>
              {linked && (
                <Link to={itemPath(linked)} className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
                  <CategoryIcon id={linked.category} size="sm" className="size-5 rounded [&_svg]:size-3" />
                  {linked.name}
                </Link>
              )}
            </div>
            {e.value && <span className="shrink-0 text-sm font-medium">₹{formatINR(e.value)}</span>}
          </div>
        )
      })}
    </Card>
  )
}
