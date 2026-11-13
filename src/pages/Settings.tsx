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
import { Switch } from '@/components/ui/switch'
import { setTheme, useTheme } from '@/lib/theme'
import { healthReport } from '@/lib/checks'
import { biometricName, biometricSupported, getBioMeta, PASSWORD_EVERY_DAYS } from '@/lib/biometric'
import {
  changePassword,
  disableBiometric,
  enableBiometric,
  eraseDevice,
  lock,
  newRecoveryKey,
  updateSettings,
  useVault,
} from '@/lib/vault'

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
  const [dialog, setDialog] = useState<'password' | 'recovery' | 'bio' | null>(null)
  const [bioSupported, setBioSupported] = useState(false)
  const [bioOn, setBioOn] = useState(false)
  useEffect(() => {
    biometricSupported().then(setBioSupported)
    getBioMeta().then((m) => setBioOn(!!m))
  }, [])
  const [usage, setUsage] = useState('')
  const binCount = items.filter((i) => i.deletedAt).length
  const theme = useTheme()
  const healthCount = healthReport(items, settings).count

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

      <Group title="APPEARANCE">
        <div className={rowClass}>
          <span className="flex-1 text-[15px] font-medium">Theme</span>
          <div role="radiogroup" aria-label="Theme" className="flex rounded-full bg-muted p-1">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme.choice === t}
                onClick={() => setTheme(t)}
                className={`h-8 rounded-full px-3 text-[13px] font-semibold capitalize ${theme.choice === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                {t === 'system' ? 'Auto' : t}
              </button>
            ))}
          </div>
        </div>
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
        {bioSupported && (
          <label className={rowClass}>
            <span className="flex-1 text-[15px] font-medium">{biometricName()} unlock</span>
            <Switch
              checked={bioOn}
              onCheckedChange={async (on) => {
                if (on) setDialog('bio')
                else {
                  await disableBiometric()
                  setBioOn(false)
                }
              }}
            />
          </label>
        )}
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
        <Row label="Health check" value={healthCount ? `${healthCount} to look at` : 'All good'} to="/health" />
        <Row label="Bin" value={binCount ? `${binCount} ${binCount === 1 ? 'item' : 'items'}` : 'Empty'} to="/settings/bin" />
      </Group>

      <Group title="REMINDERS">
        <label className={rowClass}>
          <span className="flex-1 text-[15px] font-medium">Maturities, policies, warranties, IDs</span>
          <select
            value={settings.leadLong}
            onChange={(e) => updateSettings({ leadLong: Number(e.target.value) })}
            className="bg-transparent text-right text-sm text-muted-foreground outline-none"
          >
            {[15, 30, 45, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days before
              </option>
            ))}
          </select>
        </label>
        <label className={rowClass}>
          <span className="flex-1 text-[15px] font-medium">Bills and subscriptions</span>
          <select
            value={settings.leadShort}
            onChange={(e) => updateSettings({ leadShort: Number(e.target.value) })}
            className="bg-transparent text-right text-sm text-muted-foreground outline-none"
          >
            {[1, 3, 5, 7, 10, 15].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? 'day' : 'days'} before
              </option>
            ))}
          </select>
        </label>
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
      <BiometricDialog
        open={dialog === 'bio'}
        onClose={(on) => {
          setDialog(null)
          if (on) setBioOn(true)
        }}
      />
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

function BiometricDialog({ open, onClose }: { open: boolean; onClose: (on: boolean) => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const close = (on: boolean) => {
    setPw('')
    onClose(on)
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turn on {biometricName()} unlock</DialogTitle>
          <DialogDescription>
            For this device only. You still need the master password after {PASSWORD_EVERY_DAYS} days, and your recovery
            key keeps working.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="biopw" className="text-sm font-semibold">
            Master password
          </Label>
          <Input id="biopw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <Button
          size="lg"
          disabled={!pw || busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await enableBiometric(pw)
              if (r === 'ok') {
                toast.success(`${biometricName()} unlock is on`)
                close(true)
              } else toast.error('That password is not right')
            } catch (e) {
              const msg = (e as Error).name === 'NotAllowedError' ? 'Cancelled' : (e as Error).message
              toast.error(msg)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Waiting…' : 'Turn on'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
