import { Link } from 'react-router-dom'
import { itemPath } from '@/lib/categories'
import { shortDate } from '@/lib/dates'
import type { DueEntry } from '@/lib/reminders'
import { cn } from '@/lib/utils'

function when(e: DueEntry) {
  if (e.days < 0) return 'overdue'
  if (e.days === 0) return 'today'
  if (e.days === 1) return 'tomorrow'
  if (e.days < 45) return `in ${e.days} days`
  return shortDate(e.date)
}

/** Home's hero: the very next date, big, with the following two below. */
export function NextUp({ first, rest, total }: { first: DueEntry; rest: DueEntry[]; total: number }) {
  const overdue = first.days < 0
  return (
    <section
      className="flex flex-col gap-3.5 rounded-[24px] border p-[18px] shadow-soft"
      style={{
        borderColor: 'color-mix(in srgb, var(--brand) 40%, transparent)',
        backgroundImage: 'linear-gradient(160deg, color-mix(in srgb, var(--brand) 26%, transparent), transparent 60%)',
        backgroundColor: 'var(--card)',
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-xs font-semibold tracking-[0.14em] text-primary uppercase">Next up</h2>
        <Link to="/coming-up" className="text-[13px] font-semibold text-primary">
          All {total}
        </Link>
      </div>
      <Link to={itemPath(first.item)} className="flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[15px] text-muted-foreground">
            {first.item.name} · {first.label.toLowerCase()}
          </span>
          <span className={cn('num text-[38px] leading-none font-bold', overdue && 'text-destructive')}>{when(first)}</span>
        </span>
        {first.amount && <span className="num shrink-0 text-[22px] font-bold">{first.amount}</span>}
      </Link>
      {rest.length > 0 && <div className="h-px bg-border" />}
      {rest.map((e) => (
        <Link key={`${e.item.id}:${e.field.key}`} to={itemPath(e.item)} className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-[12px] border bg-card leading-none">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase">
              {e.date.toLocaleDateString('en-IN', { month: 'short' })}
            </span>
            <span className="num text-[14px] font-bold">{e.date.getDate()}</span>
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {e.item.name} · {e.label.toLowerCase()}
          </span>
          {e.amount && <span className="text-sm text-muted-foreground">{e.amount}</span>}
        </Link>
      ))}
    </section>
  )
}
