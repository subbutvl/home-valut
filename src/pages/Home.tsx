import { ChevronRight, Lock, Search, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { CategoryGrid, ItemLogo } from '@/components/CategoryIcon'
import { ScrollRow } from '@/components/Ticker'
import { StickyBar } from '@/components/common'
import { NextUp } from '@/components/NextUp'
import { SyncStatus } from '@/components/SyncStatus'
import { ThemeToggle } from '@/components/ThemeToggle'
import { healthReport } from '@/lib/checks'
import { allDue } from '@/lib/reminders'
import { NotificationBell } from '@/pages/Notifications'
import { getCategory, itemPath } from '@/lib/categories'
import { glowFor, gradientFor } from '@/lib/palette'
import type { Item } from '@/lib/types'
import { lock, useVault } from '@/lib/vault'

export default function Home() {
  const { items, settings } = useVault()
  const live = items.filter((i) => !i.deletedAt)
  const byId = new Map(live.map((i) => [i.id, i]))
  const counts: Record<string, number> = {}
  for (const i of live) counts[i.category] = (counts[i.category] ?? 0) + 1

  const favs = [
    ...settings.favouriteOrder.map((id) => byId.get(id)).filter((i): i is Item => !!i?.favourite),
    ...live.filter((i) => i.favourite && !settings.favouriteOrder.includes(i.id)),
  ]
  const due = allDue(live, settings).filter((e) => e.days <= 90)
  const upcoming = due.slice(0, 3)
  const dueCount = due.length
  const health = healthReport(live, settings)
  const recent = settings.recentlyViewed.map((id) => byId.get(id)).filter((i): i is Item => !!i)

  return (
    <Page>
      <StickyBar className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-[14px] text-brand-ink shadow-[0_8px_20px_rgba(61,107,55,0.3)]"
            style={{ background: 'linear-gradient(145deg, var(--brand), var(--brand-deep))' }}
          >
            <Lock className="size-[22px]" strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <h1 className="text-[22px] leading-tight font-bold">HomeVault</h1>
            <SyncStatus className="text-xs" />
          </div>
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          <NotificationBell />
          <button
            type="button"
            onClick={lock}
            aria-label="Lock now"
            className="flex size-11 items-center justify-center rounded-[14px] border bg-card lg:hidden"
          >
            <Lock className="size-5" />
          </button>
        </div>
      </header>

      <Link
        to="/search"
        className="flex h-13 items-center gap-2.5 rounded-[16px] border bg-card px-4 text-base text-muted-foreground shadow-soft"
      >
        <Search className="size-5" /> Search the vault
      </Link>
      </StickyBar>

      {health.count > 0 && (
        <Link to="/health" className="flex items-center gap-3 rounded-[14px] bg-warn-bg px-4 py-3.5 text-warn-fg">
          <ShieldAlert className="size-[22px] shrink-0" />
          <span className="flex-1 text-[15px] font-semibold">
            Health check: {health.count} {health.count === 1 ? 'thing needs' : 'things need'} a look
          </span>
          <ChevronRight className="size-[18px]" />
        </Link>
      )}

      {live.length === 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-accent px-4 py-4 text-accent-foreground">
          <p className="text-[15px] font-semibold">Start with what you look up most</p>
          <p className="text-sm">
            A bank account, an insurance policy or your car. Tap a category below, or{' '}
            <Link to="/add" className="font-semibold underline">
              add an item
            </Link>
            . Only the name is required.
          </p>
        </div>
      )}

      {upcoming.length > 0 && <NextUp first={upcoming[0]} rest={upcoming.slice(1)} total={dueCount} />}

      {favs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Favourites</h2>
          <ScrollRow label="Favourites">
            {favs.map((i) => (
              <Link
                key={i.id}
                role="listitem"
                to={itemPath(i)}
                className="flex h-[104px] w-32 shrink-0 flex-col justify-between rounded-[20px] p-3 text-white"
                style={{ backgroundImage: gradientFor(i.category), boxShadow: `${glowFor(i.category)}, inset 0 1px 0 rgba(255,255,255,0.2)` }}
              >
                <ItemLogo item={i} size="sm" className="size-8 rounded-[10px] border-0 bg-white/90 text-[#1B3C7A]" />
                <span className="line-clamp-2 text-[13px] leading-tight font-semibold">{i.name}</span>
              </Link>
            ))}
          </ScrollRow>
        </section>
      )}

      {recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Recently viewed</h2>
          <ScrollRow label="Recently viewed" auto>
            {recent.map((i) => (
              <Link
                key={i.id}
                role="listitem"
                to={itemPath(i)}
                className="flex w-56 shrink-0 items-center gap-2.5 rounded-[16px] border bg-card px-3 py-2.5"
              >
                <ItemLogo item={i} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{i.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{getCategory(i.category).name}</span>
                </span>
              </Link>
            ))}
          </ScrollRow>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="sr-only">Categories</h2>
        <CategoryGrid hrefFor={(id) => `/c/${id}`} counts={counts} />
      </section>
    </Page>
  )
}
