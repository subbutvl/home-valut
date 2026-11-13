import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { Card, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Member } from '@/lib/types'
import { newId, saveItem, updateSettings, useVault } from '@/lib/vault'

const RELATIONS = ['Self', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other']

export default function Members() {
  const { settings, items } = useVault()
  const [name, setName] = useState('')
  const [rel, setRel] = useState('')

  const usage = (n: string) => items.filter((i) => !i.deletedAt && (i.belongsTo.includes(n) || i.nominees.some((x) => x.name === n))).length

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (settings.members.some((m) => m.name.toLowerCase() === n.toLowerCase())) return toast.error('That name is already there')
    await updateSettings({ members: [...settings.members, { id: newId(), name: n, relationship: rel }] })
    setName('')
    setRel('')
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
          <div key={m.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 last:border-b-0">
            <Input
              aria-label="Name"
              defaultValue={m.name}
              onBlur={(e) => rename(m, e.target.value)}
              className="h-11 flex-1"
            />
            <select
              aria-label="Relationship"
              value={m.relationship}
              onChange={(e) => updateSettings({ members: settings.members.map((x) => (x.id === m.id ? { ...x, relationship: e.target.value } : x)) })}
              className="h-11 w-28 rounded-xl border border-input bg-card px-2"
            >
              <option value="">Relation</option>
              {RELATIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <span className="w-14 text-center text-xs text-muted-foreground">{usage(m.name)} items</span>
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
        <div className="flex gap-2">
          <Input aria-label="New person's name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select aria-label="Relationship" value={rel} onChange={(e) => setRel(e.target.value)} className="h-12 w-32 shrink-0 rounded-xl border border-input bg-card px-2">
            <option value="">Relation</option>
            {RELATIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <Button onClick={add} disabled={!name.trim()}>
          Add
        </Button>
      </Card>
    </Page>
  )
}
