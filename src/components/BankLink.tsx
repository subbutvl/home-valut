import { Link } from 'react-router-dom'
import { CategoryIcon, ItemLogo } from '@/components/CategoryIcon'
import { Card } from '@/components/common'
import { Label } from '@/components/ui/label'
import { BANK_LINK_LABEL, CATEGORY_BY_ID, CATEGORY_GROUPS, getCategory, itemPath } from '@/lib/categories'
import type { Item } from '@/lib/types'
import { useVault } from '@/lib/vault'

const last4 = (v?: string) => (v ? ` ••${v.replace(/\s/g, '').slice(-4)}` : '')
export const accountLabel = (a: Item) => `${a.name}${last4(a.fields.accountNumber)}${a.belongsTo.length ? ` · ${a.belongsTo.join(', ')}` : ''}`

/** On the form: pick the bank account. Choosing one fills an empty Bank and Branch. */
export function BankLinkPicker({ item, onChange }: { item: Item; onChange: (patch: Partial<Item>) => void }) {
  const { items } = useVault()
  const accounts = items.filter((i) => i.category === 'bank' && !i.deletedAt).sort((a, b) => a.name.localeCompare(b.name))
  const label = BANK_LINK_LABEL[item.category]
  if (!label) return null
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="linked-account" className="text-[13px] font-semibold text-foreground/80">
        {label}
      </Label>
      <select
        id="linked-account"
        value={item.linkedAccountId ?? ''}
        onChange={(e) => {
          const acc = accounts.find((a) => a.id === e.target.value)
          const fields = { ...item.fields }
          if (acc) {
            if (!fields.bank && acc.fields.bank && CATEGORY_BY_ID[item.category].fields.some((f) => f.key === 'bank')) fields.bank = acc.fields.bank
            if (!fields.branch && acc.fields.branch && CATEGORY_BY_ID[item.category].fields.some((f) => f.key === 'branch')) fields.branch = acc.fields.branch
          }
          onChange({ linkedAccountId: e.target.value || undefined, fields })
        }}
        className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base"
      >
        <option value="">{accounts.length ? 'Choose a bank account' : 'No bank accounts added yet'}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {accountLabel(a)}
          </option>
        ))}
      </select>
    </div>
  )
}

/** On a card/FD/locker page: which account it is linked to. */
export function LinkedAccountRow({ item }: { item: Item }) {
  const { items } = useVault()
  const acc = item.linkedAccountId ? items.find((i) => i.id === item.linkedAccountId && !i.deletedAt) : undefined
  if (!acc) return null
  return (
    <Link to={itemPath(acc)} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:border-primary/40">
      <CategoryIcon id="bank" size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted-foreground">{BANK_LINK_LABEL[item.category]}</span>
        <span className="truncate text-[15px] font-semibold">{accountLabel(acc)}</span>
      </span>
    </Link>
  )
}

const ORDER = CATEGORY_GROUPS.flatMap((g) => g.ids)

/** On a bank account page: everything linked to it, with quick add. */
export function LinkedToAccount({ account }: { account: Item }) {
  const { items } = useVault()
  const linked = items
    .filter((i) => i.linkedAccountId === account.id && !i.deletedAt)
    .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.name.localeCompare(b.name))
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-[15px] font-semibold">Linked to this account · {linked.length}</span>
      </div>
      {linked.map((i) => (
        <Link key={i.id} to={itemPath(i)} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/50">
          <ItemLogo item={i} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">{i.name}</span>
            <span className="truncate text-[13px] text-muted-foreground">
              {[getCategory(i.category).short, getCategory(i.category).rowDetail?.(i.fields)].filter(Boolean).join(' · ')}
            </span>
          </span>
        </Link>
      ))}
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {(['card', 'deposit', 'locker', 'loan'] as const).map((cat) => (
          <Link
            key={cat}
            to={`/add/${cat}?account=${account.id}`}
            className="flex h-9 items-center gap-1.5 rounded-full border border-dashed border-input pr-3 pl-1.5 text-[13px] font-semibold text-primary"
          >
            <CategoryIcon id={cat} size="sm" className="size-6 bg-transparent [&_svg]:size-4" />+ {getCategory(cat).short}
          </Link>
        ))}
      </div>
    </Card>
  )
}
