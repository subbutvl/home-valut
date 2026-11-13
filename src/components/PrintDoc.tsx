import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getCategory } from '@/lib/categories'
import { itemLines, itemMeta, pageCss, type SecretMode } from '@/lib/printing'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { verifyPassword } from '@/lib/vault'

/** One item on paper: name, who it belongs to, and its fields in a grid. */
export function PrintItem({ item, mode, notes = true, showCategory }: { item: Item; mode: SecretMode; notes?: boolean; showCategory?: boolean }) {
  const lines = itemLines(item, mode, { notes })
  const meta = [showCategory ? getCategory(item.category).name : '', itemMeta(item)].filter(Boolean).join(' · ')
  return (
    <div className="pd-item">
      <div className="pd-name">{item.name}</div>
      {meta && <div className="pd-meta">{meta}</div>}
      {lines.length > 0 && (
        <dl className="pd-grid">
          {lines.map((l) => (
            <div key={l.label}>
              <dt>{l.label}</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{l.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.lockerContents && item.lockerContents.length > 0 && (
        <div style={{ marginTop: '3pt' }}>
          <dt className="pd-meta">Contents</dt>
          <ul style={{ margin: 0, paddingLeft: '14pt', listStyle: 'disc' }}>
            {item.lockerContents.map((e) => (
              <li key={e.id}>
                {e.item}
                {e.description ? ` (${e.description})` : ''}
                {e.owner ? ` · ${e.owner}` : ''}
              </li>
            ))}
          </ul>
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
