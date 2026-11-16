import { useEffect, useLayoutEffect, useState } from 'react'
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
  blanks,
  custom,
}: {
  item: Item
  mode: SecretMode
  notes?: boolean
  showCategory?: boolean
  only?: string[]
  blanks?: boolean
  custom?: boolean
}) {
  const { items } = useVault()
  const acc = item.linkedAccountId ? items.find((i) => i.id === item.linkedAccountId && !i.deletedAt) : undefined
  const sections = itemSections(item, mode, { notes, only, blanks, custom, accountName: acc ? accountLabel(acc) : undefined })
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
                      <td colSpan={l.label ? 1 : 2} className={l.blank ? 'blank' : l.label ? 'fit' : undefined}>
                        {l.value}
                      </td>
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

/**
 * Keep each printed value on one line: shrink its text (down to 7pt) until it
 * fits its column. Runs on screen and again when the print layout is applied,
 * since the paper width differs from the preview. Notes still wrap.
 */
function fitValues() {
  document.querySelectorAll<HTMLElement>('.print-doc .pd-rows td.fit').forEach((td) => {
    td.style.whiteSpace = 'nowrap'
    td.style.fontSize = ''
    let pt = 10.5
    while (td.scrollWidth > td.clientWidth + 1 && pt > 7) {
      pt -= 0.5
      td.style.fontSize = `${pt}pt`
    }
    // Still too long at the smallest size (e.g. a full address): let it wrap.
    if (td.scrollWidth > td.clientWidth + 1) td.style.whiteSpace = 'normal'
  })
}

export function useFitPrintValues() {
  useLayoutEffect(() => {
    fitValues()
  })
  useEffect(() => {
    const mq = window.matchMedia('print')
    const onChange = () => requestAnimationFrame(fitValues)
    mq.addEventListener('change', onChange)
    window.addEventListener('beforeprint', fitValues)
    window.addEventListener('afterprint', fitValues)
    window.addEventListener('resize', fitValues)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('beforeprint', fitValues)
      window.removeEventListener('afterprint', fitValues)
      window.removeEventListener('resize', fitValues)
    }
  }, [])
}

/** The @page rules (A4, footer with date and page numbers). */
export function PageStyle() {
  useFitPrintValues()
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
