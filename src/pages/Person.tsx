import { HeartPulse, Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Card, EmptyState, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORY_GROUPS, formatDate, getCategory, itemPath } from '@/lib/categories'
import type { Item, Medical, Member } from '@/lib/types'
import { updateSettings, useVault } from '@/lib/vault'
import { MemberDialog } from './Members'

export const MEDICAL_FIELDS: { key: keyof Medical; label: string; long?: boolean; placeholder?: string }[] = [
  { key: 'bloodGroup', label: 'Blood group', placeholder: 'e.g. B+' },
  { key: 'allergies', label: 'Allergies', long: true },
  { key: 'medicines', label: 'Regular medicines', long: true },
  { key: 'conditions', label: 'Long-term conditions', long: true },
  { key: 'doctor', label: 'Family doctor', placeholder: 'Name and phone' },
  { key: 'healthPolicy', label: 'Health policy', placeholder: 'e.g. Star Health family floater' },
]

const ORDER = CATEGORY_GROUPS.flatMap((g) => g.ids)
const byCategory = (a: Item, b: Item) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.name.localeCompare(b.name)

function ItemList({ items, sub }: { items: Item[]; sub: (i: Item) => string }) {
  return (
    <Card className="overflow-hidden">
      {items.map((i) => (
        <Link
          key={i.id}
          to={itemPath(i)}
          className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/50"
        >
          <CategoryIcon id={i.category} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">{i.name}</span>
            <span className="truncate text-[13px] text-muted-foreground">{sub(i)}</span>
          </span>
        </Link>
      ))}
    </Card>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

export default function Person() {
  const { id } = useParams()
  const { settings, items } = useVault()
  const [editing, setEditing] = useState(false)
  const [medOpen, setMedOpen] = useState(false)
  const m = settings.members.find((x) => x.id === id)
  if (!m) return <Navigate to="/settings/members" replace />

  const live = items.filter((i) => !i.deletedAt)
  const owns = live.filter((i) => i.belongsTo.includes(m.name)).sort(byCategory)
  const nomineeFor = live.filter((i) => i.nominees.some((n) => n.name === m.name)).sort(byCategory)
  const med = m.medical ?? {}
  const medFilled = MEDICAL_FIELDS.filter((f) => med[f.key])

  return (
    <Page>
      <PageHeader
        title={m.name}
        back="/settings/members"
        subtitle={[m.relationship, m.dob && `Born ${formatDate(m.dob)}`, m.mobile].filter(Boolean).join(' · ')}
        right={
          <Button variant="outline" className="rounded-full" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
        }
      />

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            <HeartPulse className="size-5 text-destructive" /> Emergency medical
          </span>
          <button type="button" onClick={() => setMedOpen(true)} className="text-sm font-semibold text-primary">
            {medFilled.length ? 'Edit' : 'Add'}
          </button>
        </div>
        {medFilled.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {medFilled.map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="font-medium whitespace-pre-wrap">{med[f.key]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Blood group, allergies, medicines and doctor. Goes on the family sheet.
          </p>
        )}
      </Card>

      <Section title={`Belongs to ${m.name} · ${owns.length}`}>
        {owns.length ? (
          <ItemList
            items={owns}
            sub={(i) => [getCategory(i.category).name, i.belongsTo.length > 1 ? 'Joint' : ''].filter(Boolean).join(' · ')}
          />
        ) : (
          <EmptyState title="Nothing yet">Items that belong to {m.name} show here.</EmptyState>
        )}
      </Section>

      {nomineeFor.length > 0 && (
        <Section title={`${m.name} is nominee for · ${nomineeFor.length}`}>
          <ItemList
            items={nomineeFor}
            sub={(i) => {
              const share = i.nominees.find((n) => n.name === m.name)?.share
              return [
                getCategory(i.category).name,
                i.belongsTo.length ? `of ${i.belongsTo.join(', ')}` : '',
                share ? `${share}%` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            }}
          />
        </Section>
      )}

      <MemberDialog
        key={editing ? 'open' : 'closed'}
        member={editing ? m : null}
        usage={owns.length + nomineeFor.length}
        onClose={() => setEditing(false)}
      />
      <MedicalDialog key={medOpen ? 'm-open' : 'm-closed'} member={m} open={medOpen} onClose={() => setMedOpen(false)} />
    </Page>
  )
}

function MedicalDialog({ member, open, onClose }: { member: Member; open: boolean; onClose: () => void }) {
  const { settings } = useVault()
  const [med, setMed] = useState<Medical>(member.medical ?? {})
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emergency medical · {member.name}</DialogTitle>
          <DialogDescription>Fill only what helps in an emergency.</DialogDescription>
        </DialogHeader>
        {MEDICAL_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`med-${f.key}`} className="text-[13px] font-semibold text-foreground/80">
              {f.label}
            </Label>
            {f.long ? (
              <Textarea
                id={`med-${f.key}`}
                rows={2}
                value={med[f.key] ?? ''}
                onChange={(e) => setMed({ ...med, [f.key]: e.target.value })}
              />
            ) : (
              <Input
                id={`med-${f.key}`}
                placeholder={f.placeholder}
                value={med[f.key] ?? ''}
                onChange={(e) => setMed({ ...med, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}
        <Button
          size="lg"
          onClick={async () => {
            await updateSettings({ members: settings.members.map((x) => (x.id === member.id ? { ...x, medical: med } : x)) })
            onClose()
          }}
        >
          Save
        </Button>
      </DialogContent>
    </Dialog>
  )
}
