import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { Card, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
      className={`rounded-xl border border-input bg-card px-2 ${className ?? ''}`}
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
  const [name, setName] = useState('')
  const [rel, setRel] = useState('')
  const [addKey, setAddKey] = useState(0)

  const usage = (n: string) => items.filter((i) => !i.deletedAt && (i.belongsTo.includes(n) || i.nominees.some((x) => x.name === n))).length

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (settings.members.some((m) => m.name.toLowerCase() === n.toLowerCase())) return toast.error('That name is already there')
    await updateSettings({ members: [...settings.members, { id: newId(), name: n, relationship: rel }] })
    setName('')
    setRel('')
    setAddKey((k) => k + 1)
  }

  /** Renaming updates "Belongs to" and nominees on every item. */
  const rename = async (m: Member, next: string) => {
    const n = next.trim()
    if (!n || n === m.name) return
    if (settings.members.some((x) => x.id !== m.id && x.name.toLowerCase() === n.toLowerCase())) return toast.error('That name is already there')
    for (const i of items)
      if (i.belongsTo.includes(m.name) || i.nominees.some((x) => x.name === m.name))
        await saveItem({
          ...i,
          belongsTo: i.belongsTo.map((x) => (x === m.name ? n : x)),
          nominees: i.nominees.map((x) => (x.name === m.name ? { ...x, name: n } : x)),
        })
    await updateSettings({ members: settings.members.map((x) => (x.id === m.id ? { ...x, name: n } : x)) })
  }

  const remove = async (m: Member) => {
    const used = usage(m.name)
    if (used) return toast.error(`${m.name} is on ${used} ${used === 1 ? 'item' : 'items'}. Change those first.`)
    await updateSettings({ members: settings.members.filter((x) => x.id !== m.id) })
  }

  return (
    <Page>
      <PageHeader title="Family members" back="/settings" subtitle="Used for “Belongs to” and nominees. Family don't get a login." />
      <Card className="overflow-hidden">
        {settings.members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-3 last:border-b-0">
            <Input
              aria-label="Name"
              defaultValue={m.name}
              onBlur={(e) => rename(m, e.target.value)}
              className="h-11 min-w-0 basis-full sm:flex-1 sm:basis-0"
            />
            <RelationPicker
              value={m.relationship}
              onChange={(v) => updateSettings({ members: settings.members.map((x) => (x.id === m.id ? { ...x, relationship: v } : x)) })}
              className="h-11 min-w-0 flex-1 sm:w-44 sm:flex-none"
            />
            <span className="w-16 text-center text-xs text-muted-foreground">{usage(m.name)} {usage(m.name) === 1 ? 'item' : 'items'}</span>
            <button
              type="button"
              aria-label={`Remove ${m.name}`}
              onClick={() => remove(m)}
              className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <Trash2 className="size-[18px]" />
            </button>
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-2.5 p-4">
        <span className="text-[15px] font-semibold">Add a person</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="New person's name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <RelationPicker key={addKey} value={rel} onChange={setRel} className="h-12 w-full sm:w-44 sm:shrink-0" />
        </div>
        <Button onClick={add} disabled={!name.trim()}>
          Add
        </Button>
      </Card>
    </Page>
  )
}
