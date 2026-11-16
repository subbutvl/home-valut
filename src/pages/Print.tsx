import { Printer, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Card, PageHeader } from '@/components/common'
import { AccountGroup, PageStyle, PrintItem, SecretModePicker } from '@/components/PrintDoc'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CATEGORY_BY_ID, CATEGORY_GROUPS, formatDate, formatINR } from '@/lib/categories'
import { groupLinked, moneySummary, printedOn, type SecretMode } from '@/lib/printing'
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
  const [blanks, setBlanks] = useState(true)
  const [custom, setCustom] = useState(false)
  const [summary, setSummary] = useState(true)
  const tags = [...new Set(live.flatMap((i) => i.tags))].sort()

  const chosen = live
    .filter((i) => picked.includes(i.category))
    .filter((i) => !person || i.belongsTo.includes(person))
    .filter((i) => !tag || i.tags.includes(tag))
  // Money summary for the cover: only the ticked categories (bank, FD, bonds), matching the person/tag filter.
  const money = moneySummary(chosen)
  // Cards, FDs, lockers… linked to a printed bank account print inside its group.
  const { linkedTo, pulled } = groupLinked(chosen)
  const sections = usedCats
    .filter((id) => picked.includes(id))
    .map((id) => ({
      cat: CATEGORY_BY_ID[id],
      items: chosen.filter((i) => i.category === id && !pulled.has(i.id)).sort((a, b) => a.name.localeCompare(b.name)),
    }))
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
          <label className="flex items-center justify-between gap-3 text-[15px]">
            <span>
              Show empty fields
              <span className="block text-xs text-muted-foreground">As lines to fill in by hand, e.g. PINs</span>
            </span>
            <Switch checked={blanks} onCheckedChange={setBlanks} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[15px]">
            <span>
              Money summary on the first page
              <span className="block text-xs text-muted-foreground">Only for ticked bank accounts, FDs and bonds</span>
            </span>
            <Switch checked={summary} onCheckedChange={setSummary} />
          </label>
          <label className="flex items-center justify-between text-[15px]">
            Include custom fields
            <Switch checked={custom} onCheckedChange={setCustom} />
          </label>
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
              {pulled.size ? ` · ${pulled.size} linked ${pulled.size === 1 ? 'item' : 'items'} printed with their bank account` : ''}
              {person ? ` · only ${person}` : ''}
              {tag ? ` · tag “${tag}”` : ''}
            </p>
            {summary && money && (
              <div className="pd-summary">
                <h2 style={{ marginTop: '14pt' }}>Summary · approx.</h2>
                <table className="pd-sum">
                  <thead>
                    <tr>
                      <th scope="col">Holding</th>
                      <th scope="col">Items</th>
                      <th scope="col">Total ₹</th>
                      <th scope="col">Avg. rate</th>
                      <th scope="col">Interest / year ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {money.rows.map((r) => (
                      <tr key={r.label}>
                        <td>{r.label}</td>
                        <td>{r.count}</td>
                        <td>{formatINR(Math.round(r.total))}</td>
                        <td>{r.avgRate ? `${r.avgRate.toFixed(2)}%` : '—'}</td>
                        <td>{r.yearly ? formatINR(Math.round(r.yearly)) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="pd-sum-total">
                      <td>Total</td>
                      <td>{money.rows.reduce((s, r) => s + r.count, 0)}</td>
                      <td>{formatINR(Math.round(money.total))}</td>
                      <td>{money.avgRate ? `${money.avgRate.toFixed(2)}%` : '—'}</td>
                      <td>{money.yearly ? formatINR(Math.round(money.yearly)) : '—'}</td>
                    </tr>
                  </tbody>
                </table>
                {money.rows.map((r) => (
                  <div key={r.label} className="pd-overview">
                    <h3>{r.label}</h3>
                    <table className="pd-sum">
                      <thead>
                        <tr>
                          <th scope="col">Name</th>
                          <th scope="col">Bank / issuer · held by</th>
                          <th scope="col">{r.label.startsWith('Savings') ? 'Balance as of' : 'Matures'}</th>
                          <th scope="col">Amount ₹</th>
                          {r.label.startsWith('Savings') ? null : <th scope="col">Rate</th>}
                          {r.label.startsWith('Savings') ? null : <th scope="col">Interest / year ₹</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {r.lines.map((l, idx) => (
                          <tr key={idx}>
                            <td>{l.name}</td>
                            <td>{l.where || '—'}</td>
                            <td>{l.date ? formatDate(l.date) : '—'}</td>
                            <td>{l.amount ? formatINR(Math.round(l.amount)) : '—'}</td>
                            {r.label.startsWith('Savings') ? null : <td>{l.rate ? `${l.rate}%` : '—'}</td>}
                            {r.label.startsWith('Savings') ? null : <td>{l.yearly ? formatINR(Math.round(l.yearly)) : '—'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                <p className="pd-meta" style={{ marginTop: '5pt' }}>
                  Reference only, from the figures typed in the app: interest is amount × rate for a year (before tax),
                  about ₹{formatINR(Math.round(money.yearly / 12))} a month; the average rate is weighted by amount and
                  counts only items with a rate. Balances are as typed
                  {money.oldestBalance ? `, the oldest as of ${formatDate(money.oldestBalance)}` : ''}.
                </p>
              </div>
            )}
            <p className="pd-meta" style={{ marginTop: '6pt' }}>
              Secrets: {mode === 'hidden' ? 'hidden' : mode === 'shown' ? 'SHOWN. Keep this paper safe.' : 'left out'}
              . Amounts are as typed in the app (reference only).
            </p>
          </div>
          {sections.map((s, si) => (
            // Each bank account starts a new page; so does whatever follows them.
            <section key={s.cat.id} className={si > 0 && sections[si - 1].cat.id === 'bank' ? 'pd-newpage' : undefined}>
              <h2>
                {s.cat.name}
              </h2>
              {s.items.map((i, ii) => (
                <div key={i.id} className={s.cat.id === 'bank' && ii > 0 ? 'pd-newpage' : undefined}>
                <AccountGroup
                  account={i}
                  linked={linkedTo.get(i.id) ?? []}
                  render={(x, inGroup) => (
                    <PrintItem item={x} mode={mode} notes={notes} blanks={blanks} custom={custom} showCategory={inGroup} />
                  )}
                />
                </div>
              ))}
            </section>
          ))}
        </article>
      </div>
    </Page>
  )
}
