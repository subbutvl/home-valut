import { Bell, CalendarClock, FileUp, Home, Lock, Plus, Printer, Search, Settings, ShieldCheck } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CATEGORY_ICONS } from '@/components/CategoryIcon'
import { CATEGORY_BY_ID, CATEGORY_GROUPS } from '@/lib/categories'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { healthReport } from '@/lib/checks'
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
  const healthCount = healthReport(items, settings).count
  const { pathname } = useLocation()
  const counts: Record<string, number> = {}
  for (const i of items) if (!i.deletedAt) counts[i.category] = (counts[i.category] ?? 0) + 1
  const hideBar = pathname.startsWith('/add/') || pathname.startsWith('/edit/')

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r bg-card/60 px-3 py-5 backdrop-blur-xl lg:flex [&_a]:shrink-0 [&>*]:shrink-0">
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
        <NavLink
          to="/print"
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium',
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )
          }
        >
          <Printer className="size-[18px]" /> Print
        </NavLink>
        <NavLink
          to="/import"
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium',
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )
          }
        >
          <FileUp className="size-[18px]" /> Import
        </NavLink>
        <NavLink
          to="/health"
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium',
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )
          }
        >
          <ShieldCheck className="size-[18px]" /> <span className="flex-1">Health check</span>
          {healthCount > 0 && <span className="text-xs font-semibold text-due">{healthCount}</span>}
        </NavLink>
        {CATEGORY_GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5">
            <p className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</p>
            {g.ids.map((id) => CATEGORY_BY_ID[id]).map((c) => (
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
            <span className="flex min-w-0 items-center gap-2.5">
              <CategoryIconPlain id={c.id} />
              <span className="truncate">{c.name}</span>
            </span>
            <span className="text-xs text-muted-foreground">{counts[c.id] ?? ''}</span>
          </NavLink>
            ))}
          </div>
        ))}
      </aside>

      <div className={cn('min-w-0 flex-1', !hideBar && 'pb-28 lg:pb-0')}>
        <Outlet />
      </div>

      {!hideBar && (
        <nav
          aria-label="Main"
          className="fixed inset-x-4 z-20 flex h-[68px] items-center justify-around rounded-[24px] border bg-nav px-1 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:hidden"
          style={{ bottom: 'calc(14px + env(safe-area-inset-bottom))' }}
        >
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              aria-label={t.label}
              className={({ isActive }) =>
                cn(
                  'flex h-[52px] w-[60px] flex-col items-center justify-center gap-0.5 rounded-[18px] text-[10px] font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-ink text-brand dark:bg-brand dark:text-brand-ink'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <t.icon className="size-[22px]" strokeWidth={1.8} />
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

function CategoryIconPlain({ id }: { id: string }) {
  const Icon = CATEGORY_ICONS[id]
  return <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
}
