import { useState } from 'react'
import { NewPassword, isAcceptable } from '@/components/NewPassword'
import { RecoveryKeyCard } from '@/components/RecoveryKeyCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeRecoveryKey } from '@/lib/crypto'
import { cn } from '@/lib/utils'
import { finishSetup, prepareSetup, type PendingSetup } from '@/lib/vault'

export default function Setup() {
  const [step, setStep] = useState(0)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingSetup | null>(null)
  const [last4, setLast4] = useState('')

  const keyTail = pending ? normalizeRecoveryKey(pending.recoveryKey).slice(-4) : ''
  const last4ok = normalizeRecoveryKey(last4) === keyTail

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 pt-14 pb-8">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-input')} />
        ))}
      </div>
      <p className="text-[13px] font-semibold text-muted-foreground">STEP {step + 1} OF 3</p>

      {step === 0 && (
        <>
          <h1 className="text-2xl font-bold">Welcome to HomeVault</h1>
          <p className="text-[15px] leading-relaxed text-foreground/80">
            Everything you keep here is encrypted on this device with your master password. It is never stored or sent
            anywhere, so choose one you will remember.
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
            <li>Google Drive backup and phone/laptop sync come in the next update. Until then, keep using one device.</li>
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
