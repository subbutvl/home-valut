import { useState } from 'react'
import { toast } from 'sonner'
import { NewPassword, isAcceptable } from '@/components/NewPassword'
import { Button } from '@/components/ui/button'
import { resetPassword } from '@/lib/vault'

/** Shown right after unlocking with the recovery key. */
export default function ResetPassword() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 pt-14 pb-8">
      <h1 className="text-2xl font-bold">Choose a new master password</h1>
      <p className="text-[15px] leading-relaxed text-foreground/80">
        You opened the vault with your recovery key. Set a new master password for everyday use. Your recovery key keeps
        working.
      </p>
      <NewPassword value={pw} confirm={pw2} onChange={setPw} onConfirm={setPw2} label="New master password" />
      <div className="flex-1" />
      <Button
        size="lg"
        disabled={!isAcceptable(pw, pw2) || busy}
        onClick={async () => {
          setBusy(true)
          await resetPassword(pw)
          toast.success('New master password set')
        }}
      >
        {busy ? 'Saving…' : 'Save and continue'}
      </Button>
    </main>
  )
}
