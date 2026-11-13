import { Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRecoveryKey } from '@/lib/crypto'
import { LockedOutError, eraseDevice, lockoutRemaining, unlock } from '@/lib/vault'

export default function Unlock() {
  const [mode, setMode] = useState<'password' | 'recovery'>('password')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    lockoutRemaining().then((ms) => ms > 0 && setWaitUntil(Date.now() + ms))
  }, [])
  useEffect(() => {
    if (waitUntil <= now) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [waitUntil, now])

  const waiting = waitUntil > now
  const secondsLeft = Math.ceil((waitUntil - now) / 1000)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!secret || busy || waiting) return
    setBusy(true)
    setError('')
    try {
      const ok = await unlock(secret, mode)
      if (!ok) setError(mode === 'password' ? 'That password is not right.' : 'That recovery key is not right.')
    } catch (err) {
      if (err instanceof LockedOutError) {
        setWaitUntil(err.until)
        setNow(Date.now())
        setError('Too many wrong tries.')
      } else setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
      setSecret('')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center gap-7 px-7 pt-24 pb-12">
      <div className="flex size-18 items-center justify-center rounded-[20px] bg-primary text-primary-foreground">
        <Lock className="size-9" strokeWidth={1.8} />
      </div>
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-[26px] font-bold">HomeVault</h1>
        <p className="text-[15px] text-muted-foreground">Locked. Your data stays encrypted on this device.</p>
      </div>

      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        <Label htmlFor="secret" className="text-sm font-semibold">
          {mode === 'password' ? 'Master password' : 'Recovery key'}
        </Label>
        <Input
          id="secret"
          type={mode === 'password' ? 'password' : 'text'}
          autoComplete={mode === 'password' ? 'current-password' : 'off'}
          autoCapitalize={mode === 'password' ? 'none' : 'characters'}
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={mode === 'recovery' ? formatRecoveryKey(secret) : secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={mode === 'recovery' ? 'XXXX-XXXX-…' : undefined}
          className={mode === 'recovery' ? 'font-mono tracking-wider' : undefined}
          disabled={waiting}
        />
        <Button type="submit" size="lg" disabled={busy || waiting || !secret}>
          {busy ? 'Unlocking…' : waiting ? `Wait ${secondsLeft}s` : 'Unlock'}
        </Button>
        {error && (
          <p role="alert" className="text-center text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </form>

      <div className="flex-1" />
      <button
        type="button"
        className="text-sm font-medium text-primary"
        onClick={() => {
          setMode(mode === 'password' ? 'recovery' : 'password')
          setSecret('')
          setError('')
        }}
      >
        {mode === 'password' ? 'Forgot password? Use recovery key' : 'Use master password instead'}
      </button>
      {mode === 'recovery' && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={async () => {
            if (
              confirm(
                'Lost both the master password and the recovery key?\n\nThis erases the vault on this device. It cannot be undone.',
              )
            )
              await eraseDevice()
          }}
        >
          Lost both? Erase this device and start over
        </button>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Auto-locks after 1 minute idle. 5 wrong tries means a 1 minute wait.
      </p>
    </main>
  )
}
