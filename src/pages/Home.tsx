import { Lock, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { FavStar, TileMark } from '@/components/common'
import { SyncStatus } from '@/components/SyncStatus'
import { CATEGORIES, getCategory, itemPath } from '@/lib/categories'
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
  const recent = settings.recentlyViewed.map((id) => byId.get(id)).filter((i): i is Item => !!i)

  return (
    <Page>
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[26px] font-bold">HomeVault</h1>
          <SyncStatus />
        </div>
        <button
          type="button"
          onClick={lock}
          aria-label="Lock now"
          className="flex size-11 items-center justify-center rounded-full border bg-card lg:hidden"
        >
          <Lock className="size-5" />
        </button>
      </header>

      <Link
        to="/search"
        className="flex h-13 items-center gap-2.5 rounded-[14px] border bg-card px-4 text-base text-muted-foreground"
      >
        <Search className="size-5" /> Search policy, account, vehicle…
      </Link>

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

      {favs.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-bold">Favourites</h2>
          <div className="flex flex-wrap gap-2">
            {favs.map((i) => (
              <Link
                key={i.id}
                to={itemPath(i)}
                className="flex h-10 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium"
              >
                <FavStar on className="size-3.5" />
                {i.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-bold">Recently viewed</h2>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {recent.map((i) => (
              <Link
                key={i.id}
                to={itemPath(i)}
                className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
              >
                <TileMark mark={getCategory(i.category).mark} className="size-8 text-xs" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-semibold">{i.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{getCategory(i.category).name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[17px] font-bold">Categories</h2>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to={`/c/${c.id}`}
              className="flex min-h-[92px] flex-col gap-2 rounded-[14px] border bg-card p-3 hover:border-primary/40"
            >
              <TileMark mark={c.mark} />
              <span className="text-[13px] leading-tight font-semibold">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {counts[c.id] ?? 0} {counts[c.id] === 1 ? 'item' : 'items'}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  )
}
