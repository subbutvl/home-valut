import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { passwordStrength, suggestPassphrase } from '@/lib/crypto'
import { cn } from '@/lib/utils'

const COLORS = { weak: 'bg-destructive', good: 'bg-due', strong: 'bg-ok' } as const

/** Choose + confirm a master password, with a strength meter and a passphrase suggestion. */
export function NewPassword({
  value,
  confirm,
  onChange,
  onConfirm,
  label = 'Master password',
}: {
  value: string
  confirm: string
  onChange: (v: string) => void
  onConfirm: (v: string) => void
  label?: string
}) {
  const [show, setShow] = useState(false)
  const strength = value ? passwordStrength(value) : null
  const mismatch = confirm.length > 0 && confirm !== value
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="np" className="text-sm font-semibold">
          {label}
        </Label>
        <div className="relative">
          <Input
            id="np"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute top-0 right-0 flex size-12 items-center justify-center text-muted-foreground"
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {(['weak', 'good', 'strong'] as const).map((lvl, i) => (
              <div
                key={lvl}
                className={cn(
                  'h-1.5 flex-1 rounded-full bg-muted',
                  strength && i <= ['weak', 'good', 'strong'].indexOf(strength) && COLORS[strength],
                )}
              />
            ))}
          </div>
          <span className="w-14 text-right text-xs font-semibold capitalize text-muted-foreground">
            {strength ?? ''}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">At least 12 characters. Four random words are easy to remember.</p>
        <button
          type="button"
          onClick={() => {
            const p = suggestPassphrase()
            onChange(p)
            onConfirm('')
            setShow(true)
          }}
          className="flex items-center gap-1.5 self-start text-sm font-semibold text-primary"
        >
          <Sparkles className="size-4" /> Suggest a passphrase
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="np2" className="text-sm font-semibold">
          Type it again
        </Label>
        <Input
          id="np2"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          aria-invalid={mismatch}
        />
        {mismatch && <p className="text-xs font-medium text-destructive">The two don't match yet.</p>}
      </div>
    </div>
  )
}

export function isAcceptable(pw: string, confirm: string) {
  return pw.length >= 12 && pw === confirm && passwordStrength(pw) !== 'weak'
}
