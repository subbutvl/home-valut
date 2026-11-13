import { Download, RotateCcw, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { Card, PageHeader } from '@/components/common'
import { SyncStatus, ago } from '@/components/SyncStatus'
import { Button } from '@/components/ui/button'
import { exportBackupFile, readBackupFile, restoreBackupFile } from '@/lib/backup-file'
import { formatDate } from '@/lib/categories'
import { driveConfigured, getToken, startSignIn } from '@/lib/drive'
import {
  adoptDriveVault,
  disconnect,
  listSnapshots,
  overwriteDriveVault,
  restoreSnapshot,
  syncNow,
  useSync,
  type Snapshot,
} from '@/lib/sync'

export default function Backup() {
  const sync = useSync()
  const connected = sync.status !== 'off'
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (connected && sync.status !== 'mismatch' && getToken())
      listSnapshots()
        .then(setSnaps)
        .catch(() => setSnaps([]))
  }, [connected, sync.status, sync.lastSync])

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true)
    try {
      await fn()
      if (done) toast.success(done)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader title="Backup and sync" back="/settings" />

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold">Google Drive</span>
          <SyncStatus />
        </div>
        {!driveConfigured() ? (
          <p className="text-sm text-muted-foreground">Google Drive is not set up in this version of the app yet.</p>
        ) : !connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Keeps one encrypted copy of your vault in your Google Drive. It backs up every change and lets your phone
              and laptop open the same vault. The app can only see its own hidden folder, and Google sees only scrambled
              data.
            </p>
            <p className="text-sm text-muted-foreground">You will be asked to unlock again after signing in to Google.</p>
            <Button size="lg" onClick={() => startSignIn('connect')}>
              Connect Google Drive
            </Button>
          </>
        ) : sync.status === 'mismatch' ? (
          <>
            <p className="rounded-xl bg-warn-bg px-3.5 py-3 text-sm leading-snug text-warn-fg">
              Your Google Drive already holds a <strong>different</strong> HomeVault, made on another device. Choose
              which one to keep. This happens when a vault was created separately on each device.
            </p>
            <Button
              size="lg"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Use the vault from Google Drive on this device?\n\nThis device's vault is replaced. You then unlock with the Drive vault's master password.",
                  )
                )
                  void run(adoptDriveVault)
              }}
            >
              Use the vault from Drive here
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Replace the vault in Google Drive with this device's vault?\n\nOther devices using the Drive vault will need to open this one instead. A copy of the old Drive vault is kept.",
                  )
                )
                  void run(overwriteDriveVault, 'Drive now holds this vault')
              }}
            >
              Keep this device's vault instead
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {sync.lastSync ? `Last synced ${ago(sync.lastSync)}.` : 'Not synced yet.'} Changes upload as you save, and
              the app fetches changes each time you open it.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                disabled={busy || sync.status === 'syncing'}
                onClick={() => (getToken() ? run(syncNow) : startSignIn('refresh'))}
              >
                Sync now
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  if (confirm('Disconnect Google Drive on this device?\n\nNothing is deleted from Drive or from this device.'))
                    void disconnect()
                }}
              >
                Disconnect
              </Button>
            </div>
          </>
        )}
      </Card>

      {connected && sync.status !== 'mismatch' && (
        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[15px] font-semibold">Daily snapshots</span>
          <p className="text-sm text-muted-foreground">
            One copy per day for the last 30 days, plus one per month for a year. Restoring brings every device back to
            that day.
          </p>
          {!getToken() ? (
            <Button variant="outline" onClick={() => startSignIn('refresh')}>
              Sign in to Google to see snapshots
            </Button>
          ) : snaps === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : snaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots yet. The first one is made at the next sync.</p>
          ) : (
            <div className="-mx-4 border-t">
              {snaps.map((s) => (
                <div key={s.file.id} className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 last:border-b-0">
                  <span className="flex-1 text-[15px]">{formatDate(s.date)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Restore the vault as it was on ${formatDate(s.date)}?\n\nChanges made after that day are undone on every device. Today's state is still kept in today's snapshot.`,
                        )
                      )
                        void run(() => restoreSnapshot(s), 'Snapshot restored')
                    }}
                  >
                    <RotateCcw /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <span className="text-[15px] font-semibold">Backup file</span>
        <p className="text-sm text-muted-foreground">
          Save an encrypted copy to your computer or a USB drive, for an offline backup. It opens with the master
          password that was in use when you saved it.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={() => run(exportBackupFile)}>
            <Download /> Export
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> Import
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              const data = await readBackupFile(f)
              if (
                confirm(
                  `Replace the vault on this device with the backup from ${new Date(data.savedAt).toLocaleDateString('en-IN')}?\n\nYou will unlock with that backup's master password.`,
                )
              )
                await restoreBackupFile(data)
            } catch (err) {
              toast.error((err as Error).message)
            }
          }}
        />
      </Card>
    </Page>
  )
}
