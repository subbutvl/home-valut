import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { Card, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Member } from '@/lib/types'
import { newId, saveItem, updateSettings, useVault } from '@/lib/vault'

const RELATION_GROUPS: [string, string[]][] = [
  ['Close family', ['Self', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister']],
  ['In-laws', ['Father-in-law', 'Mother-in-law', 'Brother-in-law', 'Sister-in-law', 'Son-in-law', 'Daughter-in-law']],
  ['Extended family', ['Grandfather', 'Grandmother', 'Grandson', 'Granddaughter', 'Nephew', 'Niece', 'Uncle', 'Aunt', 'Cousin']],
]
const RELATIONS = RELATION_GROUPS.flatMap(([, r]) => r)
const OTHER = '__other__'

/** Pick a relation, or choose "Other" and type your own. */
function RelationPicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [typing, setTyping] = useState(!!value && !RELATIONS.includes(value))
  const [draft, setDraft] = useState(value)
  if (typing)
    return (
      <Input
        aria-label="Relationship"
        autoFocus={!value}
        placeholder="e.g. Godson"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft.trim()
          if (!v) setTyping(false)
          if (v !== value) onChange(v)
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={className}
      />
    )
  return (
    <select
      aria-label="Relationship"
      value={value}
      onChange={(e) => {
        if (e.target.value === OTHER) {
          setDraft('')
          setTyping(true)
        } else onChange(e.target.value)
      }}
      className={`rounded-xl border border-input bg-card px-3 text-base ${className ?? ''}`}
    >
      <option value="">Relation</option>
      {RELATION_GROUPS.map(([label, rels]) => (
        <optgroup key={label} label={label}>
          {rels.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </optgroup>
      ))}
      <option value={OTHER}>Other (type your own)…</option>
    </select>
  )
}

export default function Members() {
  const { settings, items } = useVault()
  // null = closed, 'new' = adding, a member = editing
  const [editing, setEditing] = useState<Member | 'new' | null>(null)

  const usage = (n: string) =>
    items.filter((i) => !i.deletedAt && (i.belongsTo.includes(n) || i.nominees.some((x) => x.name === n))).length

  return (
    <Page>
      <PageHeader
        title="Family members"
        back="/settings"
        subtitle="Used for “Belongs to” and nominees. Family don't get a login."
      />
      <Card className="overflow-hidden">
        {settings.members.map((m) => {
          const n = usage(m.name)
          return (
            <Link
              key={m.id}
              to={`/person/${m.id}`}
              className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-b-0 hover:bg-muted/50"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-accent-foreground"
              >
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{m.name}</span>
                <span className="truncate text-[13px] text-muted-foreground">{m.relationship || 'No relation set'}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {n} {n === 1 ? 'item' : 'items'}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          )
        })}
      </Card>
      <Button size="lg" variant="outline" onClick={() => setEditing('new')}>
        <Plus /> Add person
      </Button>
      <MemberDialog
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        member={editing}
        usage={editing && editing !== 'new' ? usage(editing.name) : 0}
        onClose={() => setEditing(null)}
      />
    </Page>
  )
}

export function MemberDialog({ member, usage, onClose }: { member: Member | 'new' | null; usage: number; onClose: () => void }) {
  const { settings, items } = useVault()
  const isNew = member === 'new'
  const current = member && member !== 'new' ? member : null
  const [name, setName] = useState(current?.name ?? '')
  const [rel, setRel] = useState(current?.relationship ?? '')
  const [dob, setDob] = useState(current?.dob ?? '')
  const [mobile, setMobile] = useState(current?.mobile ?? '')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const taken = (n: string) => settings.members.some((x) => x.id !== current?.id && x.name.toLowerCase() === n.toLowerCase())

  const save = async () => {
    const n = name.trim()
    if (!n) return
    if (taken(n)) return toast.error('That name is already there')
    setBusy(true)
    if (isNew) {
      await updateSettings({ members: [...settings.members, { id: newId(), name: n, relationship: rel, dob: dob || undefined, mobile: mobile || undefined }] })
    } else if (current) {
      // Renaming updates "Belongs to" and nominees on every item.
      if (n !== current.name)
        for (const i of items)
          if (i.belongsTo.includes(current.name) || i.nominees.some((x) => x.name === current.name))
            await saveItem({
              ...i,
              belongsTo: i.belongsTo.map((x) => (x === current.name ? n : x)),
              nominees: i.nominees.map((x) => (x.name === current.name ? { ...x, name: n } : x)),
            })
      await updateSettings({
        members: settings.members.map((x) => (x.id === current.id ? { ...x, name: n, relationship: rel, dob: dob || undefined, mobile: mobile || undefined } : x)),
      })
    }
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!current) return
    if (usage) return toast.error(`${current.name} is on ${usage} ${usage === 1 ? 'item' : 'items'}. Change those first.`)
    if (!confirm(`Remove ${current.name} from family members?`)) return
    await updateSettings({ members: settings.members.filter((x) => x.id !== current.id) })
    onClose()
    navigate('/settings/members')
  }

  return (
    <Dialog open={member !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add person' : 'Edit person'}</DialogTitle>
          {!isNew && usage > 0 && (
            <DialogDescription>
              On {usage} {usage === 1 ? 'item' : 'items'}. A new name is updated on those items too.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="mname" className="text-sm font-semibold">
            Name
          </Label>
          <Input id="mname" value={name} autoFocus={isNew} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ravi" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Relation</span>
          <RelationPicker value={rel} onChange={setRel} className="h-12 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mdob" className="text-sm font-semibold">
              Date of birth
            </Label>
            <Input id="mdob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="block" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mmob" className="text-sm font-semibold">
              Mobile
            </Label>
            <Input id="mmob" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
        </div>
        <Button size="lg" disabled={!name.trim() || busy} onClick={save}>
          {isNew ? 'Add' : 'Save'}
        </Button>
        {!isNew && current?.id !== 'self' && (
          <Button variant="ghost" className="text-destructive" onClick={remove}>
            Remove {current?.name}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
