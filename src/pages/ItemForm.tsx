import { Check, Plus, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, StickyBar } from '@/components/common'
import { FieldInput, SecretInput } from '@/components/FieldInput'
import { AttachmentsEditor } from '@/components/Attachments'
import { LockerContentsEditor } from '@/components/LockerContents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORY_BY_ID, itemPath } from '@/lib/categories'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { blankItem, deleteAttachmentBytes, newId, saveItem, updateSettings, useVault } from '@/lib/vault'

function uniq(values: (string | undefined)[]) {
  return [...new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b))
}

export default function ItemForm() {
  const { cat: catParam, id } = useParams()
  const { items } = useVault()
  const existing = id ? items.find((i) => i.id === id) : undefined
  if (id && !existing) return <Navigate to="/" replace />
  const catId = existing?.category ?? catParam ?? ''
  if (!CATEGORY_BY_ID[catId]) return <Navigate to="/add" replace />
  return <Form key={id ?? catId} initial={existing ?? blankItem(catId)} isNew={!existing} />
}

function Form({ initial, isNew }: { initial: Item; isNew: boolean }) {
  const navigate = useNavigate()
  const { items, settings } = useVault()
  const [item, setItem] = useState<Item>(initial)
  const [tagDraft, setTagDraft] = useState('')
  const [newPerson, setNewPerson] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const cat = CATEGORY_BY_ID[item.category]

  const main = cat.fields.filter((f) => f.main)
  const more = cat.fields.filter((f) => !f.main)

  // Remembered values: anything typed before in the same field of the same category.
  const suggestions = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const f of cat.fields)
      if (f.remember) out[f.key] = uniq(items.filter((i) => i.category === cat.id).map((i) => i.fields[f.key]))
    return out
  }, [items, cat])
  const subcats = uniq([...cat.subcategories, ...items.filter((i) => i.category === cat.id).map((i) => i.subcategory)])
  const allTags = uniq(items.flatMap((i) => i.tags))
  const memberNames = settings.members.map((m) => m.name)

  const setField = (key: string, v: string) => setItem((s) => ({ ...s, fields: { ...s.fields, [key]: v } }))
  const togglePerson = (name: string) =>
    setItem((s) => ({
      ...s,
      belongsTo: s.belongsTo.includes(name) ? s.belongsTo.filter((n) => n !== name) : [...s.belongsTo, name],
    }))
  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,$/, '')
    if (t && !item.tags.includes(t)) setItem((s) => ({ ...s, tags: [...s.tags, t] }))
    setTagDraft('')
  }

  const addPerson = async () => {
    const name = newPerson?.trim()
    if (!name) return setNewPerson(null)
    if (!memberNames.includes(name))
      await updateSettings({ members: [...settings.members, { id: newId(), name, relationship: '' }] })
    setItem((s) => ({ ...s, belongsTo: s.belongsTo.includes(name) ? s.belongsTo : [...s.belongsTo, name] }))
    setNewPerson(null)
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!item.name.trim()) {
      toast.error('Give it a name first')
      document.getElementById('name')?.focus()
      return
    }
    setSaving(true)
    // Drop empty values so items stay tidy.
    const fields = Object.fromEntries(Object.entries(item.fields).filter(([, v]) => v !== '' && v !== undefined))
    const saved = await saveItem({
      ...item,
      name: item.name.trim(),
      subcategory: item.subcategory?.trim() || undefined,
      fields,
      tags: tagDraft.trim() ? [...item.tags, tagDraft.trim()] : item.tags,
      nominees: item.nominees.filter((n) => n.name.trim()),
      custom: item.custom.filter((c) => c.label.trim() || c.value.trim()),
      lockerContents: item.lockerContents?.filter((e) => e.item.trim()),
    })
    // Files taken off the item are deleted from this device.
    const kept = new Set((item.attachments ?? []).map((a) => a.id))
    const removed = (initial.attachments ?? []).filter((a) => !kept.has(a.id)).map((a) => a.id)
    if (removed.length) await deleteAttachmentBytes(removed)
    toast.success(isNew ? 'Saved' : 'Changes saved')
    navigate(itemPath(saved), { replace: true })
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-6 pb-32 lg:px-8">
      <StickyBar className="-mt-6 flex min-h-14 items-center justify-between pt-4">
        <button type="button" onClick={() => navigate(-1)} className="text-[15px] font-semibold text-primary">
          Cancel
        </button>
        <h1 className="text-[17px] font-bold">{isNew ? `New ${cat.short === "FD / RD" ? cat.short : cat.short.toLowerCase()}` : `Edit ${cat.short === "FD / RD" ? cat.short : cat.short.toLowerCase()}`}</h1>
        <span className="w-[52px]" />
      </StickyBar>

      <Card className="flex flex-col gap-3.5 p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name" className="text-[13px] font-semibold text-foreground/80">
            Name *
          </Label>
          <Input
            id="name"
            autoFocus={isNew}
            value={item.name}
            placeholder={`e.g. ${EXAMPLES[cat.id] ?? 'My item'}`}
            onChange={(e) => setItem({ ...item, name: e.target.value })}
            autoComplete="off"
          />
        </div>

        {subcats.length > 0 || cat.id === 'other' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sub" className="text-[13px] font-semibold text-foreground/80">
              Type
            </Label>
            <Input
              id="sub"
              list="sub-list"
              value={item.subcategory ?? ''}
              placeholder={subcats.slice(0, 3).join(', ')}
              onChange={(e) => setItem({ ...item, subcategory: e.target.value })}
              autoComplete="off"
            />
            <datalist id="sub-list">
              {subcats.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {!item.subcategory && (
              <div className="flex flex-wrap gap-1.5">
                {subcats.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setItem({ ...item, subcategory: s })}
                    className="rounded-lg bg-muted px-2.5 py-1.5 text-[13px] font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground/80">Belongs to</span>
            <span className="text-xs text-muted-foreground">
              {item.belongsTo.length > 1 ? `Joint · ${item.belongsTo.length} people` : 'Tap one or more'}
            </span>
          </div>
          {/* One row that scrolls sideways; tap to select several. */}
          <div
            role="group"
            aria-label="Belongs to"
            className="-mx-4 flex snap-x scroll-px-4 gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {memberNames.map((n) => {
              const on = item.belongsTo.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => togglePerson(n)}
                  className={cn(
                    'flex h-9 shrink-0 snap-start items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap',
                    on ? 'bg-primary text-primary-foreground' : 'border border-input bg-card text-foreground',
                  )}
                >
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                  {n}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setNewPerson(newPerson === null ? '' : null)}
              className="h-9 shrink-0 snap-start rounded-full border border-dashed border-input px-3 text-[13px] font-semibold whitespace-nowrap text-primary"
            >
              + Person
            </button>
          </div>
          {newPerson !== null && (
            <div className="flex gap-1.5">
              <Input
                autoFocus
                aria-label="New person's name"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addPerson()
                  }
                }}
                placeholder="Name, e.g. Father"
                className="h-11"
              />
              <Button type="button" className="h-11" onClick={addPerson}>
                Add
              </Button>
            </div>
          )}
        </div>

        {main.map((f) => (
          <FieldInput
            key={f.key}
            def={f}
            value={item.fields[f.key] ?? ''}
            onChange={(v) => setField(f.key, v)}
            suggestions={suggestions[f.key]}
          />
        ))}

        {cat.id === 'locker' && (
          <LockerContentsEditor
            value={item.lockerContents ?? []}
            onChange={(lockerContents) => setItem({ ...item, lockerContents })}
          />
        )}

        {cat.hasNominee && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-foreground/80">Nominee</span>
            {item.nominees.map((n, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  aria-label="Nominee name"
                  list="member-list"
                  value={n.name}
                  placeholder="Name"
                  onChange={(e) =>
                    setItem({
                      ...item,
                      nominees: item.nominees.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                    })
                  }
                />
                <div className="relative w-24 shrink-0">
                  <Input
                    aria-label="Share percent"
                    inputMode="numeric"
                    value={n.share ?? ''}
                    placeholder="100"
                    onChange={(e) =>
                      setItem({
                        ...item,
                        nominees: item.nominees.map((x, i) =>
                          i === idx ? { ...x, share: e.target.value.replace(/\D/g, '').slice(0, 3) } : x,
                        ),
                      })
                    }
                    className="pr-7"
                  />
                  <span className="pointer-events-none absolute top-0 right-3 flex h-12 items-center text-muted-foreground">
                    %
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Remove nominee"
                  onClick={() => setItem({ ...item, nominees: item.nominees.filter((_, i) => i !== idx) })}
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="size-5" />
                </button>
              </div>
            ))}
            <datalist id="member-list">
              {memberNames.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => setItem({ ...item, nominees: [...item.nominees, { name: '', share: '' }] })}
              className="self-start text-[13px] font-semibold text-primary"
            >
              + {item.nominees.length ? 'Add another nominee' : 'Add nominee'}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tag" className="text-[13px] font-semibold text-foreground/80">
            Tags (optional)
          </Label>
          <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card px-2 py-1.5">
            {item.tags.map((t) => (
              <span key={t} className="flex h-8 items-center gap-1 rounded-lg bg-muted pr-1 pl-2.5 text-[13px]">
                {t}
                <button
                  type="button"
                  aria-label={`Remove tag ${t}`}
                  onClick={() => setItem({ ...item, tags: item.tags.filter((x) => x !== t) })}
                  className="flex size-6 items-center justify-center rounded"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <input
              id="tag"
              list="tag-list"
              value={tagDraft}
              onChange={(e) => {
                const v = e.target.value
                if (v.endsWith(',')) addTag(v)
                else setTagDraft(v)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag(tagDraft)
                }
              }}
              onBlur={() => tagDraft && addTag(tagDraft)}
              placeholder="Add tag"
              autoCapitalize="none"
              className="h-8 min-w-24 flex-1 bg-transparent px-1 outline-none"
            />
            <datalist id="tag-list">
              {allTags
                .filter((t) => !item.tags.includes(t))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </div>
        </div>
      </Card>

      <details className="group rounded-2xl border bg-card px-4 py-3.5" open={!isNew && more.some((f) => initial.fields[f.key])}>
        <summary className="cursor-pointer text-[15px] font-semibold">More details ({more.length + 1})</summary>
        <div className="mt-3.5 flex flex-col gap-3.5">
          {more.map((f) => (
            <FieldInput
              key={f.key}
              def={f}
              value={item.fields[f.key] ?? ''}
              onChange={(v) => setField(f.key, v)}
              suggestions={suggestions[f.key]}
            />
          ))}
          {cat.fields.some((x) => x.reminder) && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead" className="text-[13px] font-semibold text-foreground/80">
                Remind me
              </Label>
              <select
                id="lead"
                value={item.leadDays ?? ''}
                onChange={(e) => setItem({ ...item, leadDays: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base"
              >
                <option value="">Usual time (set in Settings)</option>
                {[1, 3, 7, 15, 30, 45, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? 'day' : 'days'} before
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes" className="text-[13px] font-semibold text-foreground/80">
              Notes
            </Label>
            <Textarea id="notes" rows={3} value={item.notes} onChange={(e) => setItem({ ...item, notes: e.target.value })} />
          </div>
        </div>
      </details>

      <Card className="flex flex-col gap-3 p-4">
        <span className="text-[15px] font-semibold">Attachments</span>
        <AttachmentsEditor value={item.attachments ?? []} onChange={(attachments) => setItem({ ...item, attachments })} />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <span className="text-[15px] font-semibold">Custom fields</span>
        {item.custom.map((c, idx) => {
          const upd = (patch: Partial<typeof c>) =>
            setItem({ ...item, custom: item.custom.map((x, i) => (i === idx ? { ...x, ...patch } : x)) })
          return (
            <div key={c.id} className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <Input aria-label="Field name" placeholder="Field name" value={c.label} onChange={(e) => upd({ label: e.target.value })} />
                <button
                  type="button"
                  aria-label="Remove field"
                  onClick={() => setItem({ ...item, custom: item.custom.filter((_, i) => i !== idx) })}
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="size-5" />
                </button>
              </div>
              {c.secret ? (
                <SecretInput id={`c-${c.id}`} value={c.value} onChange={(v) => upd({ value: v })} />
              ) : (
                <Input aria-label="Value" placeholder="Value" value={c.value} onChange={(e) => upd({ value: e.target.value })} />
              )}
              <label className="flex items-center justify-between text-[13px] font-medium">
                Secret (hidden until tapped, never searched)
                <Switch checked={!!c.secret} onCheckedChange={(v) => upd({ secret: v })} />
              </label>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setItem({ ...item, custom: [...item.custom, { id: newId(), label: '', value: '' }] })}
          className="flex items-center gap-1 self-start text-sm font-semibold text-primary"
        >
          <Plus className="size-4" /> Add custom field
        </button>
      </Card>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-2xl px-5 pt-3.5 pb-4 lg:px-8">
          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  )
}

const EXAMPLES: Record<string, string> = {
  bank: 'SBI savings',
  card: 'HDFC credit card',
  deposit: 'SBI FD 3',
  investment: 'PPF account',
  gold: 'Wedding necklace',
  locker: 'SBI locker',
  property: 'Mylapore house',
  loan: 'Home loan',
  utility: 'EB connection',
  id: 'Aadhaar (Self)',
  insurance: 'Star Health family floater',
  vehicle: 'Car TN 09 AB 1234',
  appliance: 'LG fridge',
  subscription: 'Netflix',
  contact: 'Ramesh K (insurance agent)',
  password: 'Gmail',
}
