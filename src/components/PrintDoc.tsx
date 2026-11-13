import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getCategory } from '@/lib/categories'
import { itemSections, pageCss, type SecretMode } from '@/lib/printing'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useVault, verifyPassword } from '@/lib/vault'
import { accountLabel } from '@/components/BankLink'

/** One item on paper: a header with its name, then its details in labelled groups. */
export function PrintItem({
  item,
  mode,
  notes = true,
  showCategory,
  only,
}: {
  item: Item
  mode: SecretMode
  notes?: boolean
  showCategory?: boolean
  only?: string[]
}) {
  const { items } = useVault()
  const acc = item.linkedAccountId ? items.find((i) => i.id === item.linkedAccountId && !i.deletedAt) : undefined
  const sections = itemSections(item, mode, { notes, only, accountName: acc ? accountLabel(acc) : undefined })
  const meta = [showCategory ? getCategory(item.category).name : '', item.subcategory].filter(Boolean).join(' · ')
  const contents = item.lockerContents?.filter((e) => e.item.trim()) ?? []
  return (
    <div className="pd-item">
      <div className="pd-head">
        <div className="pd-name">{item.name}</div>
        {meta && <div className="pd-meta">{meta}</div>}
      </div>
      {(sections.length > 0 || contents.length > 0) && (
        <div className="pd-sections">
          {sections.map((s) => (
            <section key={s.title} className={cn('pd-section', s.title === 'Notes' && 'wide')}>
              <h3>{s.title}</h3>
              <table className="pd-rows">
                <tbody>
                  {s.lines.map((l, i) => (
                    <tr key={i}>
                      {l.label && <th scope="row">{l.label}</th>}
                      <td colSpan={l.label ? 1 : 2}>{l.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
          {contents.length > 0 && (
            <section className="pd-section wide">
              <h3>Contents of the locker</h3>
              <table className="pd-rows">
                <tbody>
                  {contents.map((e) => (
                    <tr key={e.id}>
                      <th scope="row">{e.item}</th>
                      <td>{[e.description, e.owner].filter(Boolean).join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

/** The @page rules (A4, footer with date and page numbers). */
export function PageStyle() {
  return <style>{pageCss()}</style>
}

/** Hidden / Shown / Left out. "Shown" asks for the master password first. */
export function SecretModePicker({ value, onChange }: { value: SecretMode; onChange: (m: SecretMode) => void }) {
  const [asking, setAsking] = useState(false)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const opts: [SecretMode, string][] = [
    ['hidden', 'Hidden ••••'],
    ['shown', 'Shown'],
    ['omit', 'Left out'],
  ]
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-foreground/80">Passwords, PINs and other secrets</span>
      <div role="radiogroup" aria-label="Secrets" className="flex rounded-full bg-muted p-1">
        {opts.map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            onClick={() => (m === 'shown' && value !== 'shown' ? setAsking(true) : onChange(m))}
            className={cn(
              'h-9 flex-1 rounded-full text-[13px] font-semibold',
              value === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Dialog open={asking} onOpenChange={(o) => !o && setAsking(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Show secrets?</DialogTitle>
            <DialogDescription>Anyone holding the printout or message can read them. Enter your master password.</DialogDescription>
          </DialogHeader>
          <Input type="password" aria-label="Master password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button
            size="lg"
            disabled={!pw || busy}
            onClick={async () => {
              setBusy(true)
              const ok = await verifyPassword(pw)
              setBusy(false)
              setPw('')
              if (!ok) return toast.error('That password is not right')
              setAsking(false)
              onChange('shown')
            }}
          >
            Show secrets
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
