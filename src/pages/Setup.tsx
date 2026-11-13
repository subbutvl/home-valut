import { ChevronLeft, Lock } from 'lucide-react'
import { useRef, useState } from 'react'
import { NewPassword, isAcceptable } from '@/components/NewPassword'
import { RecoveryKeyCard } from '@/components/RecoveryKeyCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { readBackupFile, restoreBackupFile } from '@/lib/backup-file'
import { normalizeRecoveryKey } from '@/lib/crypto'
import { driveConfigured, startSignIn } from '@/lib/drive'
import { cn } from '@/lib/utils'
import { finishSetup, prepareSetup, type PendingSetup } from '@/lib/vault'

export default function Setup({ notice }: { notice?: string }) {
  const [creating, setCreating] = useState(false)
  if (!creating) return <Choose notice={notice} onCreate={() => setCreating(true)} />
  return <Create onBack={() => setCreating(false)} />
}

function Choose({ notice, onCreate }: { notice?: string; onCreate: () => void }) {
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 pt-20 pb-8">
      <div className="flex size-16 items-center justify-center rounded-[18px] bg-primary text-primary-foreground">
        <Lock className="size-8" strokeWidth={1.8} />
      </div>
      <h1 className="text-[26px] font-bold">Welcome to HomeVault</h1>
      <p className="text-[15px] leading-relaxed text-foreground/80">
        A private, encrypted place for your accounts, policies, IDs and renewals. Use one vault on all your devices, with
        one master password and one recovery key.
      </p>
      {(notice || error) && (
        <p role="alert" className="rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-fg">
          {error || notice}
        </p>
      )}
      <div className="flex flex-col gap-3 pt-2">
        <button type="button" onClick={onCreate} className={choiceClass}>
          <span className="text-base font-semibold">Create a new vault</span>
          <span className="text-sm text-muted-foreground">First time using HomeVault. Do this on one device only.</span>
        </button>
        <button
          type="button"
          disabled={!driveConfigured()}
          onClick={() => startSignIn('open')}
          className={choiceClass}
        >
          <span className="text-base font-semibold">Open my vault from Google Drive</span>
          <span className="text-sm text-muted-foreground">
            {driveConfigured()
              ? 'Already using HomeVault on another device? Sign in to Google, then unlock with your usual master password.'
              : 'Google Drive is not set up in this version yet.'}
          </span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={choiceClass}>
          <span className="text-base font-semibold">Restore from a backup file</span>
          <span className="text-sm text-muted-foreground">A homevault-backup file you exported earlier.</span>
        </button>
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
              await restoreBackupFile(await readBackupFile(f))
            } catch (err) {
              setError((err as Error).message)
            }
          }}
        />
      </div>
    </main>
  )
}

const choiceClass =
  'flex flex-col items-start gap-1 rounded-2xl border bg-card px-4 py-4 text-left hover:border-primary/50 disabled:opacity-50'

function Create({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingSetup | null>(null)
  const [last4, setLast4] = useState('')

  const keyTail = pending ? normalizeRecoveryKey(pending.recoveryKey).slice(-4) : ''
  const last4ok = normalizeRecoveryKey(last4) === keyTail

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 pt-8 pb-8">
      {step === 0 && (
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-3 flex size-11 items-center justify-center">
          <ChevronLeft className="size-6" />
        </button>
      )}
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-input')} />
        ))}
      </div>
      <p className="text-[13px] font-semibold text-muted-foreground">STEP {step + 1} OF 3</p>

      {step === 0 && (
        <>
          <h1 className="text-2xl font-bold">Choose a master password</h1>
          <p className="text-[15px] leading-relaxed text-foreground/80">
            Everything in your vault is encrypted with it. It is never stored or sent anywhere, so choose one you will
            remember. You will use the same password on all your devices.
          </p>
          <NewPassword value={pw} confirm={pw2} onChange={setPw} onConfirm={setPw2} />
          <div className="flex-1" />
          <Button
            size="lg"
            disabled={!isAcceptable(pw, pw2) || busy}
            onClick={async () => {
              setBusy(true)
              setPending(await prepareSetup(pw))
              setBusy(false)
              setStep(1)
            }}
          >
            {busy ? 'Creating keys…' : 'Next'}
          </Button>
        </>
      )}

      {step === 1 && pending && (
        <>
          <h1 className="text-2xl font-bold">Save your recovery key</h1>
          <p className="text-[15px] leading-relaxed text-foreground/80">
            If you ever forget your master password, this key is the only way back in. Print it and keep it with your
            important papers.
          </p>
          <RecoveryKeyCard recoveryKey={pending.recoveryKey} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="last4" className="text-sm font-semibold">
              Type the last 4 characters to confirm
            </Label>
            <Input
              id="last4"
              value={last4}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setLast4(e.target.value)}
              className="font-mono tracking-widest uppercase"
            />
          </div>
          <div className="rounded-xl bg-warn-bg px-4 py-3.5 text-sm leading-snug text-warn-fg">
            Lose both the master password and this key, and nobody can open the vault. Not even us.
          </div>
          <div className="flex-1" />
          <Button size="lg" disabled={!last4ok} onClick={() => setStep(2)}>
            Next
          </Button>
        </>
      )}

      {step === 2 && pending && (
        <>
          <h1 className="text-2xl font-bold">You're all set</h1>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-foreground/80">
            <li>Your vault lives on this device, encrypted.</li>
            <li>It locks itself after 1 minute without use, and straight away when you leave the app on a phone.</li>
            <li>Next, connect Google Drive in Settings. That backs up your vault and lets your other devices open the same one.</li>
            <li>
              On iPhone, open this page in Safari, tap Share, then <strong>Add to Home Screen</strong>.
            </li>
          </ul>
          <div className="flex-1" />
          <Button
            size="lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await finishSetup(pending)
            }}
          >
            Open my vault
          </Button>
        </>
      )}
    </main>
  )
}
