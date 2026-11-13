import { ChevronRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { NewPassword, isAcceptable } from '@/components/NewPassword'
import { RecoveryKeyCard } from '@/components/RecoveryKeyCard'
import { Card, PageHeader } from '@/components/common'
import { SyncStatus } from '@/components/SyncStatus'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePassword, eraseDevice, lock, newRecoveryKey, updateSettings, useVault } from '@/lib/vault'

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">{title}</h2>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  )
}

const rowClass = 'flex min-h-13 w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-b-0 hover:bg-muted/50'

function Row({ label, value, to, onClick }: { label: string; value?: ReactNode; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {value !== undefined && <span className="text-sm text-muted-foreground">{value}</span>}
      {(to || onClick) && <ChevronRight className="size-4 text-muted-foreground" />}
    </>
  )
  if (to)
    return (
      <Link to={to} className={rowClass}>
        {inner}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {inner}
      </button>
    )
  return <div className={rowClass}>{inner}</div>
}

export default function Settings() {
  const { settings, items } = useVault()
  const [dialog, setDialog] = useState<'password' | 'recovery' | null>(null)
  const [usage, setUsage] = useState('')
  const binCount = items.filter((i) => i.deletedAt).length

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`))
      .catch(() => {})
  }, [])

  return (
    <Page>
      <PageHeader title="Settings" />

      <Group title="GOOGLE DRIVE">
        <Link to="/settings/backup" className={rowClass}>
          <span className="flex-1 text-[15px] font-medium">Backup and sync</span>
          <SyncStatus />
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </Group>

      <Group title="SECURITY">
        <label className={rowClass}>
          <span className="flex-1 text-[15px] font-medium">Auto-lock after</span>
          <select
            value={settings.autoLockMinutes}
            onChange={(e) => updateSettings({ autoLockMinutes: Number(e.target.value) })}
            className="bg-transparent text-right text-sm text-muted-foreground outline-none"
          >
            {[1, 2, 5, 10].map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? 'minute' : 'minutes'}
              </option>
            ))}
          </select>
        </label>
        <Row label="Change master password" onClick={() => setDialog('password')} />
        <Row label="New recovery key" onClick={() => setDialog('recovery')} />
        <Row label="Lock now" onClick={lock} />
      </Group>

      <Group title="MY DATA">
        <Row
          label="Family members"
          value={`${settings.members.length} ${settings.members.length === 1 ? 'person' : 'people'}`}
          to="/settings/members"
        />
        <Row label="Bin" value={binCount ? `${binCount} ${binCount === 1 ? 'item' : 'items'}` : 'Empty'} to="/settings/bin" />
      </Group>

      <Group title="ABOUT">
        <Row label="App version" value={__APP_VERSION__} />
        {usage && <Row label="Storage on this device" value={usage} />}
      </Group>

      <Group title="START OVER">
        <button
          type="button"
          className={`${rowClass} text-destructive`}
          onClick={async () => {
            if (
              confirm('Erase the vault from this device?\n\nEverything stored on this device is deleted. Your Google Drive copy, if connected, is not touched.') &&
              prompt('Type ERASE to confirm') === 'ERASE'
            )
              await eraseDevice()
          }}
        >
          <span className="flex-1 text-[15px] font-medium">Erase this device</span>
        </button>
      </Group>

      <ChangePasswordDialog open={dialog === 'password'} onClose={() => setDialog(null)} />
      <NewRecoveryKeyDialog open={dialog === 'recovery'} onClose={() => setDialog(null)} />
    </Page>
  )
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const reset = () => {
    setCurrent('')
    setPw('')
    setPw2('')
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && reset()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change master password</DialogTitle>
          <DialogDescription>Your recovery key keeps working.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cur" className="text-sm font-semibold">
            Current password
          </Label>
          <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <NewPassword value={pw} confirm={pw2} onChange={setPw} onConfirm={setPw2} label="New master password" />
        <Button
          size="lg"
          disabled={!current || !isAcceptable(pw, pw2) || busy}
          onClick={async () => {
            setBusy(true)
            const ok = await changePassword(current, pw)
            setBusy(false)
            if (ok) {
              toast.success('Master password changed')
              reset()
            } else toast.error('The current password is not right')
          }}
        >
          {busy ? 'Changing…' : 'Change password'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function NewRecoveryKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [key, setKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const close = () => {
    setPw('')
    setKey(null)
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{key ? 'Your new recovery key' : 'New recovery key'}</DialogTitle>
          <DialogDescription>
            {key
              ? 'The old key no longer works. Print this one and keep it with your important papers.'
              : 'Use this if the old key was lost or seen by someone. The old key stops working.'}
          </DialogDescription>
        </DialogHeader>
        {key ? (
          <>
            <RecoveryKeyCard recoveryKey={key} />
            <Button size="lg" onClick={close}>
              I've saved it
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rkpw" className="text-sm font-semibold">
                Master password
              </Label>
              <Input id="rkpw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <Button
              size="lg"
              disabled={!pw || busy}
              onClick={async () => {
                setBusy(true)
                const k = await newRecoveryKey(pw)
                setBusy(false)
                if (k) setKey(k)
                else toast.error('That password is not right')
              }}
            >
              {busy ? 'Creating…' : 'Create new key'}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
