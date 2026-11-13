import { Bell, CalendarClock, CloudAlert, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { Card, EmptyState, PageHeader } from '@/components/common'
import { ago } from '@/components/SyncStatus'
import { markDone } from '@/components/Reminders'
import { Button } from '@/components/ui/button'
import { getCategory, itemPath } from '@/lib/categories'
import { markAllRead, markRead, snooze, unreadCount, visibleNotifs } from '@/lib/notifications'
import { dueEntries } from '@/lib/reminders'
import { syncNow } from '@/lib/sync'
import type { Notif, NotifType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useVault } from '@/lib/vault'

export function NotificationBell() {
  const { settings } = useVault()
  const n = unreadCount(settings)
  return (
    <Link
      to="/notifications"
      aria-label={n ? `Notifications, ${n} unread` : 'Notifications'}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-full border bg-card"
    >
      <Bell className="size-5" />
      {n > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
          {n > 99 ? '99+' : n}
        </span>
      )}
    </Link>
  )
}

const ICON: Record<NotifType, typeof Bell> = {
  reminder: CalendarClock,
  overdue: TriangleAlert,
  sync: RefreshCw,
  backup: CloudAlert,
  app: Bell,
  check: ShieldAlert,
}

const TABS: { id: string; label: string; match: (n: Notif) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'unread', label: 'Unread', match: (n) => !n.read },
  { id: 'reminders', label: 'Reminders', match: (n) => n.type === 'reminder' || n.type === 'overdue' },
  { id: 'sync', label: 'Sync and backup', match: (n) => n.type === 'sync' || n.type === 'backup' },
]

export default function Notifications() {
  const { settings } = useVault()
  const [tab, setTab] = useState('all')
  const all = visibleNotifs(settings)
  const shown = all.filter(TABS.find((t) => t.id === tab)!.match)
  return (
    <Page>
      <PageHeader
        title="Notifications"
        back="/"
        right={
          all.some((n) => !n.read) ? (
            <button type="button" onClick={() => markAllRead()} className="text-sm font-semibold text-primary">
              Mark all read
            </button>
          ) : null
        }
      />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={cn(
              'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'border border-input bg-card',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No notifications">Reminders appear here before renewals, maturities and bills are due.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          {shown.map((n) => {
            const Icon = ICON[n.type]
            return (
              <Link
                key={n.id}
                to={`/notifications/${n.id}`}
                className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/50"
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                <Icon className={cn('mt-0.5 size-5 shrink-0', n.type === 'overdue' ? 'text-destructive' : 'text-muted-foreground')} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn('text-[15px]', !n.read && 'font-semibold')}>{n.title}</span>
                  {n.body && <span className="text-[13px] text-muted-foreground">{n.body}</span>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(n.createdAt)}</span>
              </Link>
            )
          })}
        </Card>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Shown inside the app only. Checked each time you open it and every hour while it is open.
      </p>
    </Page>
  )
}

export function NotificationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings, items } = useVault()
  const n = settings.notifications.find((x) => x.id === id)
  useEffect(() => {
    if (n && !n.read) void markRead(n.id)
  }, [n])
  if (!n) return <Navigate to="/notifications" replace />
  const item = n.itemId ? items.find((i) => i.id === n.itemId && !i.deletedAt) : undefined
  const entry = item ? dueEntries(item, settings).sort((a, b) => a.days - b.days)[0] : undefined
  const cat = item ? getCategory(item.category) : undefined
  const keyFields = item && cat ? cat.fields.filter((f) => f.main && !f.secret && item.fields[f.key]).slice(0, 4) : []

  return (
    <Page>
      <PageHeader title="" back="/notifications" />
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-muted-foreground">{new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        <h1 className="text-[22px] leading-tight font-bold">{n.title}</h1>
        {n.body && <p className="text-[15px] text-foreground/80">{n.body}</p>}
      </div>
      {item && cat && (
        <Card className="overflow-hidden">
          <Link to={itemPath(item)} className="flex flex-col gap-0.5 border-b px-4 py-3">
            <span className="text-xs text-muted-foreground">{cat.name}</span>
            <span className="text-[17px] font-semibold">{item.name}</span>
          </Link>
          {keyFields.map((f) => (
            <div key={f.key} className="flex justify-between gap-3 border-b border-border/60 px-4 py-2.5 text-sm last:border-b-0">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="text-right font-medium">{item.fields[f.key]}</span>
            </div>
          ))}
        </Card>
      )}
      <div className="flex flex-col gap-2.5">
        {item && (
          <Button size="lg" variant="outline" onClick={() => navigate(itemPath(item))}>
            Open item
          </Button>
        )}
        {entry && (n.type === 'reminder' || n.type === 'overdue') && (
          <Button
            size="lg"
            onClick={async () => {
              await markDone(entry)
              navigate('/notifications')
            }}
          >
            Mark done
          </Button>
        )}
        {n.type === 'reminder' && (
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={() => snooze(n.id, 1).then(() => navigate('/notifications'))}>
              Snooze 1 day
            </Button>
            <Button variant="outline" onClick={() => snooze(n.id, 7).then(() => navigate('/notifications'))}>
              Snooze 1 week
            </Button>
          </div>
        )}
        {n.key.startsWith('import:') && (
          <Button
            size="lg"
            variant="outline"
            className="text-destructive"
            onClick={async () => {
              if (!window.confirm('Undo this import? The items it added are removed.')) return
              const { undoImport } = await import('@/lib/importer')
              const count = await undoImport(n.key.slice(7))
              toast.success(`Import undone. ${count} items removed.`)
              navigate('/notifications')
            }}
          >
            Undo import
          </Button>
        )}
        {n.type === 'check' && (
          <Button size="lg" onClick={() => navigate('/health')}>
            Open health check
          </Button>
        )}
        {n.type === 'backup' && (
          <Button size="lg" onClick={() => syncNow().then(() => navigate('/settings/backup'))}>
            Sync now
          </Button>
        )}
      </div>
    </Page>
  )
}
