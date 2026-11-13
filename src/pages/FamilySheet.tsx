import { Printer } from 'lucide-react'
import { useState } from 'react'
import { Page } from '@/components/AppShell'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Card, PageHeader } from '@/components/common'
import { PageStyle, PrintItem } from '@/components/PrintDoc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CATEGORY_BY_ID } from '@/lib/categories'
import { printedOn } from '@/lib/printing'
import type { FamilySheetConfig, Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { updateSettings, useVault } from '@/lib/vault'
import { MEDICAL_FIELDS } from './Person'

/** The few fields family need for each kind of item. */
const SHEET_FIELDS: Record<string, string[]> = {
  bank: ['bank', 'branch', 'accountNumber', 'ifsc', 'customerId', 'nominee'],
  deposit: ['bank', 'number', 'amount', 'maturityDate', 'nominee'],
  investment: ['issuer', 'number', 'invested', 'maturityDate', 'nominee'],
  insurance: ['insurer', 'policyNumber', 'insured', 'sumAssured', 'agentName', 'agentPhone', 'claimsHelpline', 'nominee'],
  property: ['address', 'doorNumber', 'regNumber', 'docsKept'],
  gold: ['weight', 'purity', 'keptAt'],
  locker: ['bank', 'branch', 'lockerNumber', 'keyKept', 'nominee'],
  vehicle: ['registration', 'makeModel', 'owner'],
  loan: ['lender', 'accountNumber', 'emi', 'endDate'],
  card: ['bank', 'cardHolder', 'last4', 'customerCare'],
  id: ['person', 'number', 'expiry'],
}

const SECTIONS: { id: string; label: string }[] = [
  ...Object.keys(SHEET_FIELDS).map((id) => ({ id, label: CATEGORY_BY_ID[id].name })),
  { id: 'contacts', label: 'Key contacts (marked “Show on family sheet”)' },
  { id: 'medical', label: 'Emergency medical info' },
]

export default function FamilySheet() {
  const { items, settings } = useVault()
  const cfg = settings.familySheet
  const [keyLocation, setKeyLocation] = useState(cfg.keyLocation)
  const save = (patch: Partial<FamilySheetConfig>) => updateSettings({ familySheet: { ...cfg, ...patch } })
  const live = items.filter((i) => !i.deletedAt)
  const mode = cfg.showSecrets ? 'shown' : 'omit'

  const blocks = cfg.sections
    .filter((s) => SHEET_FIELDS[s])
    .map((id) => ({ id, items: live.filter((i) => i.category === id).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((b) => b.items.length)
  const contacts = cfg.sections.includes('contacts') ? live.filter((i) => i.category === 'contact' && i.fields.onFamilySheet === 'yes') : []
  const medical = cfg.sections.includes('medical')
    ? settings.members.filter((m) => m.medical && Object.values(m.medical).some(Boolean))
    : []

  const toggle = (id: string) => save({ sections: cfg.sections.includes(id) ? cfg.sections.filter((x) => x !== id) : [...cfg.sections, id] })
  const only = (i: Item) => (cfg.showSecrets ? undefined : SHEET_FIELDS[i.category])

  return (
    <Page wide>
      <PageStyle />
      <PageHeader
        title="Emergency family sheet"
        back="/print"
        subtitle={cfg.printedAt ? `Last printed ${new Date(cfg.printedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'For family to use if something happens to you.'}
      />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="flex h-fit flex-col gap-4 p-4">
          <span className="text-[15px] font-semibold">What goes on it</span>
          <div className="flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <label key={s.id} className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2', cfg.sections.includes(s.id) && 'bg-accent/60')}>
                <input type="checkbox" checked={cfg.sections.includes(s.id)} onChange={() => toggle(s.id)} className="size-5 accent-[var(--primary)]" />
                {CATEGORY_BY_ID[s.id] && <CategoryIcon id={s.id} size="sm" className="size-7 [&_svg]:size-4" />}
                <span className="flex-1 text-[15px]">{s.label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="keyloc" className="text-[13px] font-semibold text-foreground/80">
              Where the recovery key is kept
            </Label>
            <Input
              id="keyloc"
              placeholder="e.g. Steel almirah, top shelf, blue file"
              value={keyLocation}
              onChange={(e) => setKeyLocation(e.target.value)}
              onBlur={() => keyLocation !== cfg.keyLocation && save({ keyLocation })}
            />
            <span className="text-xs text-muted-foreground">Only the place is printed, never the key itself.</span>
          </div>
          <label className="flex items-center justify-between gap-3 text-[15px]">
            <span>
              Include passwords and PINs
              <span className="block text-xs text-muted-foreground">Off is safer. Turn on only if family will need them.</span>
            </span>
            <Switch checked={cfg.showSecrets} onCheckedChange={(v) => save({ showSecrets: v })} />
          </label>
          <Button
            size="lg"
            onClick={async () => {
              await save({ printedAt: Date.now(), keyLocation })
              window.print()
            }}
          >
            <Printer /> Print or save as PDF
          </Button>
          <p className="text-xs text-muted-foreground">You'll be reminded every 6 months to reprint it if anything on it has changed.</p>
        </Card>

        <article className="print-doc" aria-label="Family sheet preview">
          <h1>Family information sheet</h1>
          <p className="pd-meta">Printed on {printedOn()}. Amounts are as typed in HomeVault, for reference.</p>

          <h2>How to open HomeVault</h2>
          <p>
            Everything is in the HomeVault app (https://subbutvl.github.io/home-valut/) and in the HomeVault folder of the Google
            Drive account. It opens with the master password, or with the printed recovery key.
          </p>
          <p style={{ marginTop: '3pt' }}>
            <strong>Recovery key is kept at:</strong> {keyLocation || '____________________________'}
          </p>

          {blocks.map((b) => (
            <section key={b.id}>
              <h2>{CATEGORY_BY_ID[b.id].name}</h2>
              {b.items.map((i) =>
                cfg.showSecrets ? (
                  <PrintItem key={i.id} item={i} mode={mode} notes={false} />
                ) : (
                  <PrintItem key={i.id} item={i} mode="omit" notes={false} only={[...(only(i) ?? []), 'belongsTo']} />
                ),
              )}
            </section>
          ))}

          {contacts.length > 0 && (
            <section>
              <h2>Key contacts</h2>
              {contacts.map((c) => (
                <PrintItem key={c.id} item={c} mode="omit" notes={false} only={['role', 'phone', 'phone2', 'organisation', 'email']} />
              ))}
            </section>
          )}

          {medical.length > 0 && (
            <section>
              <h2>Emergency medical information</h2>
              {medical.map((m) => (
                <div key={m.id} className="pd-item">
                  <div className="pd-head">
                    <div className="pd-name">
                      {m.name}
                      {m.relationship ? ` (${m.relationship})` : ''}
                    </div>
                  </div>
                  <div className="pd-sections">
                    <section className="pd-section wide">
                      <table className="pd-rows">
                        <tbody>
                          {MEDICAL_FIELDS.filter((f) => m.medical?.[f.key]).map((f) => (
                            <tr key={f.key}>
                              <th scope="row">{f.label}</th>
                              <td>{m.medical?.[f.key]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  </div>
                </div>
              ))}
            </section>
          )}
        </article>
      </div>
    </Page>
  )
}

