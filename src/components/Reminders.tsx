import { Check } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { formatINR, itemPath } from '@/lib/categories'
import { shortDate } from '@/lib/dates'
import { readForItem } from '@/lib/notifications'
import { afterDone, subscriptionTotal, type DueEntry } from '@/lib/reminders'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { saveItem } from '@/lib/vault'

export async function markDone(e: DueEntry) {
  const next = afterDone(e)
  await saveItem(next)
  await readForItem(e.item.id)
  const moved = next.fields[e.field.key] !== e.value
  toast.success(moved ? `Done. Next: ${shortDate(new Date(next.fields[e.field.key] + 'T00:00'))}` : 'Marked done')
}

const tone = (days: number) => (days < 0 ? 'text-destructive' : days <= 30 ? 'text-due' : 'text-muted-foreground')
const dot = (days: number) => (days < 0 ? 'bg-destructive' : days <= 30 ? 'bg-due' : 'bg-input')

export function DueRow({ e, compact }: { e: DueEntry; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const when = e.days < 0 ? 'Overdue' : e.days === 0 ? 'Today' : shortDate(e.date)
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <span className={cn('size-2.5 shrink-0 rounded-full', dot(e.days))} aria-hidden="true" />
      <Link to={itemPath(e.item)} className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{e.item.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {[e.label, e.amount, e.days < 0 ? shortDate(e.date) : null].filter(Boolean).join(' · ')}
        </span>
      </Link>
      <span className={cn('shrink-0 text-[13px] font-semibold', tone(e.days))}>{when}</span>
      {!compact && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await markDone(e)
            setBusy(false)
          }}
          aria-label={`Mark ${e.item.name} ${e.label.toLowerCase()} done`}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-input px-3 text-[13px] font-semibold"
        >
          <Check className="size-4" /> Done
        </button>
      )}
    </div>
  )
}

/** "Subscriptions: ₹X per month · ₹Y per year", tap for the breakdown. Reference only. */
export function SubscriptionTotal({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false)
  const t = subscriptionTotal(items)
  if (!t.rows.length) return null
  return (
    <div className="rounded-2xl border bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-col gap-0.5 px-4 py-3 text-left">
        <span className="text-[15px] font-semibold">
          Subscriptions: ₹{formatINR(t.perMonth)} per month · ₹{formatINR(t.perYear)} per year
        </span>
        <span className="text-xs text-muted-foreground">
          approx. · yearly and quarterly plans shown per month · {open ? 'hide' : 'tap for'} breakdown
        </span>
      </button>
      {open && (
        <div className="border-t">
          {t.rows.map((r) => (
            <Link key={r.item.id} to={itemPath(r.item)} className="flex justify-between border-b border-border/60 px-4 py-2.5 text-sm last:border-b-0">
              <span className="truncate">{r.item.name}</span>
              <span className="shrink-0 font-medium">₹{formatINR(Math.round(r.perMonth))} / month</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
