import { Copy, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { Chip, EmptyState, FavStar, PageHeader } from '@/components/common'
import { CATEGORY_BY_ID, formatINR, itemPath } from '@/lib/categories'
import { nextDue, shortDate, urgency, type Urgency } from '@/lib/dates'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useIsWide } from '@/lib/use-media'
import { markViewed, useVault } from '@/lib/vault'
import { CategoryIcon } from '@/components/CategoryIcon'
import { SubscriptionTotal } from '@/components/Reminders'
import { ItemDetail } from './ItemDetail'

const DOT: Record<Urgency, string> = {
  overdue: 'bg-destructive',
  soon: 'bg-due',
  later: 'bg-input',
  none: 'bg-transparent',
}
const WHEN: Record<Urgency, string> = {
  overdue: 'text-destructive',
  soon: 'text-due',
  later: 'text-muted-foreground',
  none: 'text-muted-foreground',
}

function Row({ item, active }: { item: Item; active: boolean }) {
  const cat = CATEGORY_BY_ID[item.category]
  const due = nextDue(item)
  const urg = urgency(due)
  const detail = cat.rowDetail?.(item.fields) || item.subcategory || ''
  const people = item.belongsTo.join(', ')
  return (
    <div className={cn('flex items-center border-b border-border/60 last:border-b-0', active ? 'bg-accent' : 'hover:bg-muted/60')}>
    <Link
      to={itemPath(item)}
      aria-current={active ? 'page' : undefined}
      className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4"
    >
      <span className={cn('size-2.5 shrink-0 rounded-full', DOT[urg])} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
          {item.name}
          {item.favourite && <FavStar on className="size-3.5 shrink-0" />}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {[detail, people].filter(Boolean).join(' · ')}
        </span>
      </div>
      {due && urg !== 'none' && (
        <span className={cn('shrink-0 text-xs font-semibold', WHEN[urg])}>
          {urg === 'overdue' ? 'Overdue' : shortDate(due.date)}
        </span>
      )}
    </Link>
      <Link
        to={`/add/${item.category}?from=${item.id}`}
        aria-label={`Duplicate ${item.name}`}
        title="Duplicate"
        className="flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Copy className="size-[18px]" />
      </Link>
    </div>
  )
}

export default function CategoryPage() {
  const { cat: catId = '', id } = useParams()
  const { items, settings } = useVault()
  const [sort, setSort] = useState<'name' | 'due'>('name')
  const [person, setPerson] = useState<string>('')
  const cat = CATEGORY_BY_ID[catId]
  const wide = useIsWide()

  const selected = id ? items.find((i) => i.id === id && !i.deletedAt) : undefined
  useEffect(() => {
    if (selected) void markViewed(selected.id)
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cat) return <Navigate to="/" replace />
  if (id && !selected) return <Navigate to={`/c/${catId}`} replace />

  const all = items.filter((i) => i.category === catId && !i.deletedAt)
  const peopleInUse = settings.members.map((m) => m.name).filter((n) => all.some((i) => i.belongsTo.includes(n)))
  const shown = all
    .filter((i) => !person || i.belongsTo.includes(person))
    .sort((a, b) => {
      if (sort === 'due') {
        const da = nextDue(a)?.date.getTime() ?? Infinity
        const dbb = nextDue(b)?.date.getTime() ?? Infinity
        if (da !== dbb) return da - dbb
      }
      return a.name.localeCompare(b.name)
    })

  const hasDates = cat.fields.some((f) => f.reminder)
  const subtitle = (() => {
    const n = `${all.length} ${all.length === 1 ? 'item' : 'items'}`
    if (catId === 'deposit') {
      const total = all.reduce((s, i) => s + (Number(i.fields.amount?.replace(/,/g, '')) || 0), 0)
      return total ? `${n} · approx. ₹${formatINR(total)} in total (reference only)` : n
    }
    return n
  })()

  const list = (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <CategoryIcon id={cat.id} size="sm" />
            {cat.name}
          </span>
        }
        back="/"
        subtitle={subtitle}
        right={
          hasDates && all.length > 1 ? (
            <label className="flex items-center gap-1 text-[13px] text-muted-foreground">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'name' | 'due')}
                className="rounded-md bg-transparent py-1 text-[13px] font-semibold text-foreground"
                style={{ fontSize: 13 }}
              >
                <option value="name">name</option>
                <option value="due">due date</option>
              </select>
            </label>
          ) : null
        }
      />
      {catId === 'subscription' && <SubscriptionTotal items={all} />}
      {peopleInUse.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={!person} onClick={() => setPerson('')}>
            Everyone
          </Chip>
          {peopleInUse.map((p) => (
            <Chip key={p} active={person === p} onClick={() => setPerson(p)}>
              {p}
            </Chip>
          ))}
        </div>
      )}
      {shown.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {shown.map((i) => (
            <Row key={i.id} item={i} active={i.id === id} />
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${cat.name.toLowerCase()} yet`}>
          <Link to={`/add/${catId}`} className="font-semibold text-primary">
            Add the first one
          </Link>
        </EmptyState>
      )}
    </div>
  )

  return (
    <>
      {/* Phone: list OR details. Laptop: list AND details side by side. */}
      {!wide ? (
        <Page>
          {selected ? (
            <>
              <PageHeader title="" stuckTitle={selected.name} back={`/c/${catId}`} />
              <ItemDetail item={selected} backTo={`/c/${catId}`} />
            </>
          ) : (
            list
          )}
        </Page>
      ) : (
        <Page wide>
          <div className="grid grid-cols-[minmax(320px,400px)_1fr] gap-6">
            <div>{list}</div>
            <div className="pt-2">
              {selected ? (
                <ItemDetail item={selected} backTo={`/c/${catId}`} />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                  Select an item to see its details
                </div>
              )}
            </div>
          </div>
        </Page>
      )}

      {!selected && (
        <Link
          to={`/add/${catId}`}
          aria-label={`Add ${cat.short.toLowerCase()}`}
          className="fixed right-5 bottom-28 z-10 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 lg:bottom-8 lg:right-8"
        >
          <Plus className="size-7" strokeWidth={2.2} />
        </Link>
      )}
    </>
  )
}
