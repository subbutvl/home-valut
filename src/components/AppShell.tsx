import { Bell, CalendarClock, Home, Lock, Plus, Search, Settings } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CATEGORIES } from '@/lib/categories'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { unreadCount } from '@/lib/notifications'
import { lock, useVault } from '@/lib/vault'

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/coming-up', label: 'Coming up', icon: CalendarClock },
  { to: '/add', label: 'Add', icon: Plus },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** Bottom bar on phone, left sidebar on laptop. */
export function AppShell() {
  const { items, settings } = useVault()
  const unread = unreadCount(settings)
  const { pathname } = useLocation()
  const counts: Record<string, number> = {}
  for (const i of items) if (!i.deletedAt) counts[i.category] = (counts[i.category] ?? 0) + 1
  const hideBar = pathname.startsWith('/add/') || pathname.startsWith('/edit/')

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r bg-card px-3 py-5 lg:flex">
        <div className="flex items-center justify-between px-3 pb-3">
          <span className="flex-1 text-xl font-bold">HomeVault</span>
          <ThemeToggle className="size-9 border-0 bg-transparent hover:bg-muted [&_svg]:size-4" />
          <button
            type="button"
            onClick={lock}
            aria-label="Lock now"
            className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <Lock className="size-4" />
          </button>
        </div>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium',
                isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
              )
            }
          >
            <t.icon className="size-[18px]" /> {t.label === 'Add' ? 'Add item' : t.label}
          </NavLink>
        ))}
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium',
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )
          }
        >
          <Bell className="size-[18px]" /> <span className="flex-1">Notifications</span>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
              {unread}
            </span>
          )}
        </NavLink>
        <p className="px-3 pt-5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground">CATEGORIES</p>
        {CATEGORIES.map((c) => (
          <NavLink
            key={c.id}
            to={`/c/${c.id}`}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center justify-between rounded-lg px-3 text-sm',
                isActive || pathname.startsWith(`/c/${c.id}/`)
                  ? 'bg-accent font-semibold text-accent-foreground'
                  : 'hover:bg-muted',
              )
            }
          >
            <span className="truncate">{c.name}</span>
            <span className="text-xs text-muted-foreground">{counts[c.id] ?? ''}</span>
          </NavLink>
        ))}
      </aside>

      <div className={cn('min-w-0 flex-1', !hideBar && 'pb-24 lg:pb-0')}>
        <Outlet />
      </div>

      {!hideBar && (
        <nav
          aria-label="Main"
          className="pb-safe fixed inset-x-0 bottom-0 z-20 flex justify-around border-t bg-card/95 pt-2 backdrop-blur lg:hidden"
        >
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-14 w-[72px] flex-col items-center gap-1 pt-1 text-[11px] font-semibold',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <t.icon className="size-6" strokeWidth={1.8} />
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

/** Standard padded page column. */
export function Page({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={cn('mx-auto flex w-full flex-col gap-5 px-5 pt-8 pb-6 lg:px-8', wide ? 'max-w-6xl' : 'max-w-2xl')}>
      {children}
    </main>
  )
}
