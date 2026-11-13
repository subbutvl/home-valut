import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatINR, type FieldDef } from '@/lib/categories'
import { cn } from '@/lib/utils'

const selectClass =
  'h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

export function SecretInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-12 font-mono"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide' : 'Show'}
        className="absolute top-0 right-0 flex size-12 items-center justify-center text-muted-foreground"
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}

function AmountInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-0 left-3.5 flex h-12 items-center text-muted-foreground">₹</span>
      <Input
        id={id}
        inputMode="decimal"
        value={focused || !value ? value : formatINR(value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        className="pl-8"
      />
    </div>
  )
}

function ExpiryInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder="MM/YY"
      maxLength={5}
      value={value}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '').slice(0, 4)
        onChange(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d)
      }}
    />
  )
}

/** One form field, rendered by its type. `suggestions` feed a datalist for remembered values. */
export function FieldInput({
  def,
  value,
  onChange,
  suggestions,
}: {
  def: FieldDef
  value: string
  onChange: (v: string) => void
  suggestions?: string[]
}) {
  const id = `f-${def.key}`
  const listId = suggestions?.length ? `${id}-list` : undefined

  let control: React.ReactNode
  if (def.secret) control = <SecretInput id={id} value={value} onChange={onChange} />
  else
    switch (def.type) {
      case 'amount':
        control = <AmountInput id={id} value={value} onChange={onChange} />
        break
      case 'date':
        control = (
          <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className="block" />
        )
        break
      case 'expiry':
        control = <ExpiryInput id={id} value={value} onChange={onChange} />
        break
      case 'select':
        control = (
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
            <option value="">Choose…</option>
            {def.options?.map((o) => (
              <option key={o}>{o}</option>
            ))}
            {value && !def.options?.includes(value) && <option>{value}</option>}
          </select>
        )
        break
      case 'bool':
        return (
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Label htmlFor={id} className="text-[13px] font-semibold text-foreground/80">
              {def.label}
            </Label>
            <Switch id={id} checked={value === 'yes'} onCheckedChange={(c) => onChange(c ? 'yes' : 'no')} />
          </div>
        )
      case 'textarea':
        control = <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
        break
      default:
        control = (
          <Input
            id={id}
            type={def.type === 'email' ? 'email' : def.type === 'url' ? 'url' : def.type === 'phone' ? 'tel' : 'text'}
            inputMode={def.type === 'number' ? 'decimal' : undefined}
            autoCapitalize={def.type === 'email' || def.type === 'url' ? 'none' : 'sentences'}
            autoComplete="off"
            list={listId}
            value={value}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )
    }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={cn('text-[13px] font-semibold text-foreground/80')}>
        {def.label}
        {def.reference === 'asOf' && <span className="font-normal text-muted-foreground"> · for reference</span>}
      </Label>
      {control}
      {listId && (
        <datalist id={listId}>
          {suggestions!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}
