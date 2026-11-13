import { CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { startSignIn } from '@/lib/drive'
import { syncNow, useSync } from '@/lib/sync'
import { cn } from '@/lib/utils'

export function ago(t?: number): string {
  if (!t) return 'never'
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} ${d === 1 ? 'day' : 'days'} ago`
}

/** One short line: "Synced 2 min ago", "Not synced yet", etc. */
export function SyncStatus({ className }: { className?: string }) {
  const { status, lastSync } = useSync()
  const base = cn('flex items-center gap-1 text-[13px]', className)
  const icon = 'size-4 shrink-0'
  switch (status) {
    case 'off':
      return (
        <Link to="/settings" className={cn(base, 'text-due')}>
          <CloudOff className={icon} /> Not backed up · connect Drive
        </Link>
      )
    case 'syncing':
      return (
        <span className={cn(base, 'text-muted-foreground')}>
          <RefreshCw className={cn(icon, 'animate-spin')} /> Syncing…
        </span>
      )
    case 'idle':
      return (
        <button type="button" onClick={() => syncNow()} className={cn(base, 'text-ok')}>
          <CloudCheck className={icon} /> Synced {ago(lastSync)}
        </button>
      )
    case 'offline':
      return (
        <span className={cn(base, 'text-muted-foreground')}>
          <CloudOff className={icon} /> Offline · not synced yet
        </span>
      )
    case 'signin':
      return (
        <button type="button" onClick={() => startSignIn('refresh')} className={cn(base, 'text-due')}>
          <CloudAlert className={icon} /> Sign in to Google to sync
        </button>
      )
    case 'mismatch':
      return (
        <Link to="/settings/backup" className={cn(base, 'text-destructive')}>
          <CloudAlert className={icon} /> Drive has a different vault
        </Link>
      )
    case 'error':
      return (
        <button type="button" onClick={() => syncNow()} className={cn(base, 'text-destructive')}>
          <CloudAlert className={icon} /> Sync problem · tap to retry
        </button>
      )
  }
}
