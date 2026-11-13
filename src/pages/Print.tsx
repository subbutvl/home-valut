import { Printer, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Card, PageHeader } from '@/components/common'
import { PageStyle, PrintItem, SecretModePicker } from '@/components/PrintDoc'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CATEGORY_BY_ID, CATEGORY_GROUPS } from '@/lib/categories'
import { printedOn, type SecretMode } from '@/lib/printing'
import { cn } from '@/lib/utils'
import { useVault } from '@/lib/vault'

const sel = 'h-11 rounded-xl border border-input bg-card px-3 text-[15px]'

export default function Print() {
  const { items, settings } = useVault()
  const live = items.filter((i) => !i.deletedAt)
  const usedCats = CATEGORY_GROUPS.flatMap((g) => g.ids).filter((id) => live.some((i) => i.category === id))
  const [picked, setPicked] = useState<string[]>(usedCats)
  const [person, setPerson] = useState('')
  const [tag, setTag] = useState('')
  const [mode, setMode] = useState<SecretMode>('hidden')
  const [notes, setNotes] = useState(true)
  const tags = [...new Set(live.flatMap((i) => i.tags))].sort()

  const chosen = live
    .filter((i) => picked.includes(i.category))
    .filter((i) => !person || i.belongsTo.includes(person))
    .filter((i) => !tag || i.tags.includes(tag))
  const sections = usedCats
    .filter((id) => picked.includes(id))
    .map((id) => ({ cat: CATEGORY_BY_ID[id], items: chosen.filter((i) => i.category === id).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((s) => s.items.length)

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const all = picked.length === usedCats.length

  return (
    <Page wide>
      <PageStyle />
      <PageHeader title="Print" back="/settings" subtitle="Tick categories, preview, then print or save as PDF. Works best on the laptop." />

      <Link to="/print/family" className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 hover:border-primary/40">
        <Users className="size-5 text-primary" />
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">Emergency family sheet</span>
          <span className="text-[13px] text-muted-foreground">One or two pages for the family: accounts, policies, contacts, medical info.</span>
        </span>
      </Link>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="flex h-fit flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Categories</span>
            <button type="button" className="text-sm font-semibold text-primary" onClick={() => setPicked(all ? [] : usedCats)}>
              {all ? 'Clear' : 'Select all'}
            </button>
          </div>
          {usedCats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add some items first.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {usedCats.map((id) => {
                const n = live.filter((i) => i.category === id).length
                return (
                  <label key={id} className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2', picked.includes(id) && 'bg-accent/60')}>
                    <input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(id)} className="size-5 accent-[var(--primary)]" />
                    <CategoryIcon id={id} size="sm" className="size-7 [&_svg]:size-4" />
                    <span className="flex-1 text-[15px]">{CATEGORY_BY_ID[id].name}</span>
                    <span className="text-xs text-muted-foreground">{n}</span>
                  </label>
                )
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)} className={sel}>
              <option value="">Everyone</option>
              {settings.members.map((m) => (
                <option key={m.id}>{m.name}</option>
              ))}
            </select>
            <select aria-label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} className={sel}>
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <SecretModePicker value={mode} onChange={setMode} />
          <label className="flex items-center justify-between text-[15px]">
            Include notes
            <Switch checked={notes} onCheckedChange={setNotes} />
          </label>
          <Button size="lg" disabled={!sections.length} onClick={() => window.print()}>
            <Printer /> Print or save as PDF
          </Button>
        </Card>

        <article className="print-doc" aria-label="Print preview">
          <div className="pd-cover">
            <h1>HomeVault</h1>
            <p style={{ marginTop: '4pt' }}>Printed on {printedOn()}</p>
            <p className="pd-meta" style={{ marginTop: '6pt' }}>
              {sections.map((s) => `${s.cat.name} (${s.items.length})`).join(' · ') || 'Nothing selected'}
              {person ? ` · only ${person}` : ''}
              {tag ? ` · tag “${tag}”` : ''}
            </p>
            <p className="pd-meta" style={{ marginTop: '6pt' }}>
              Secrets: {mode === 'hidden' ? 'hidden' : mode === 'shown' ? 'SHOWN. Keep this paper safe.' : 'left out'}
              . Amounts are as typed in the app (reference only).
            </p>
          </div>
          {sections.map((s) => (
            <section key={s.cat.id}>
              <h2>
                {s.cat.name} · {s.items.length}
              </h2>
              {s.items.map((i) => (
                <PrintItem key={i.id} item={i} mode={mode} notes={notes} />
              ))}
            </section>
          ))}
        </article>
      </div>
    </Page>
  )
}
