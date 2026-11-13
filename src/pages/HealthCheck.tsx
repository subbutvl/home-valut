import { ChevronRight, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Card, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatINR, itemPath } from '@/lib/categories'
import { PROBLEM_TEXT, healthReport } from '@/lib/checks'
import type { Item } from '@/lib/types'
import { updateSettings, useVault } from '@/lib/vault'

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <p className="px-1 text-[13px] text-muted-foreground">{hint}</p>
      {children}
    </section>
  )
}

function ItemRow({ item, sub }: { item: Item; sub: string }) {
  return (
    <Link to={itemPath(item)} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/50">
      <CategoryIcon id={item.category} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{item.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export default function HealthCheck() {
  const { items, settings } = useVault()
  const h = healthReport(items, settings)
  return (
    <Page>
      <PageHeader title="Health check" back="/" subtitle="Checked on this device only. Nothing is sent anywhere." />

      {h.count === 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-ok/10 px-4 py-4 text-ok">
          <ShieldCheck className="size-6" />
          <span className="text-[15px] font-semibold">All good. Nothing needs a look right now.</span>
        </div>
      )}

      {h.nominees.length > 0 && (
        <Section title="Missing nominee" hint="Bank accounts, deposits, investments and insurance with no nominee.">
          {h.nominees.map((g) => (
            <div key={g.person} className="flex flex-col gap-1.5">
              <p className="px-1 text-sm font-semibold">{g.person}</p>
              <Card className="overflow-hidden">
                {g.items.map((i) => (
                  <ItemRow key={i.id} item={i} sub="No nominee" />
                ))}
              </Card>
            </div>
          ))}
        </Section>
      )}

      {h.bankLimit.length > 0 && (
        <Section
          title={`Above ₹${formatINR(settings.bankLimit)} at one bank`}
          hint="DICGC insures deposits up to this amount per person per bank. Totals add your typed savings balance and FD amounts (reference only)."
        >
          {h.bankLimit.map((b) => (
            <Card key={b.key} className="overflow-hidden">
              <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold">
                    {b.bank} · {b.person}
                  </span>
                  <span className="text-[13px] text-destructive">approx. ₹{formatINR(b.total)} in total</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateSettings({ dismissedChecks: [...settings.dismissedChecks, `limit:${b.key}`] })}
                >
                  Dismiss
                </Button>
              </div>
              {b.items.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  sub={`₹${formatINR((i.category === 'bank' ? i.fields.balance : i.fields.amount) ?? '0')}`}
                />
              ))}
            </Card>
          ))}
        </Section>
      )}

      {h.passwords.length > 0 && (
        <Section title="Password health" hint="Shorter than 10 characters, very common, or the same password on more than one item.">
          <Card className="overflow-hidden">
            {h.passwords.map((p) => (
              <ItemRow
                key={`${p.item.id}:${p.label}`}
                item={p.item}
                sub={`${p.label}: ${p.problems.map((x) => PROBLEM_TEXT[x]).join(', ')}`}
              />
            ))}
          </Card>
        </Section>
      )}

      <label className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
        <span className="text-sm">Insured limit per person per bank</span>
        <select
          value={settings.bankLimit}
          onChange={(e) => updateSettings({ bankLimit: Number(e.target.value) })}
          className="bg-transparent text-right text-sm font-semibold"
        >
          {[500000, 1000000, 1500000, 2000000].map((v) => (
            <option key={v} value={v}>
              ₹{formatINR(v)}
            </option>
          ))}
        </select>
      </label>
    </Page>
  )
}
