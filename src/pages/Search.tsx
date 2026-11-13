import { ChevronRight, Search as SearchIcon, X } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { CategoryIcon } from '@/components/CategoryIcon'
import { EmptyState } from '@/components/common'
import { CATEGORIES, getCategory, itemPath } from '@/lib/categories'
import { groupByCategory, search } from '@/lib/search'
import { cn } from '@/lib/utils'
import { useVault } from '@/lib/vault'

const filterClass =
  'h-9 shrink-0 rounded-full border border-input bg-card pl-3 pr-2 text-[13px] font-semibold text-foreground outline-none'

export default function Search() {
  const navigate = useNavigate()
  const { items, settings } = useVault()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const person = params.get('person') ?? ''
  const tag = params.get('tag') ?? ''
  const category = params.get('category') ?? ''

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const allTags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items])
  const filtered = items.filter(
    (i) =>
      !i.deletedAt &&
      (!person || i.belongsTo.includes(person)) &&
      (!tag || i.tags.includes(tag)) &&
      (!category || i.category === category),
  )
  const anyFilter = !!(person || tag || category)
  const hits = q.trim()
    ? search(filtered, q)
    : anyFilter
      ? filtered
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({ item, match: getCategory(item.category).rowDetail?.(item.fields) ?? '' }))
      : []
  const groups = groupByCategory(hits)

  return (
    <Page>
      <div className="flex items-center gap-2.5">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <div className="flex h-12 flex-1 items-center gap-2 rounded-[14px] border-2 border-primary bg-card px-3.5">
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
          <input
            id="q"
            type="search"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Search policy, account, vehicle…"
            className="h-full min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setParam('q', '')}>
              <X className="size-5 text-muted-foreground" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => navigate('/')} className="text-[15px] font-semibold text-primary lg:hidden">
          Cancel
        </button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setParams(q ? { q } : {}, { replace: true })}
          className={cn(
            'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold',
            !anyFilter ? 'bg-primary text-primary-foreground' : 'border border-input bg-card',
          )}
        >
          All
        </button>
        <select aria-label="Person" value={person} onChange={(e) => setParam('person', e.target.value)} className={cn(filterClass, person && 'border-primary text-primary')} style={{ fontSize: 13 }}>
          <option value="">Person</option>
          {settings.members.map((m) => (
            <option key={m.id}>{m.name}</option>
          ))}
        </select>
        <select aria-label="Tag" value={tag} onChange={(e) => setParam('tag', e.target.value)} className={cn(filterClass, tag && 'border-primary text-primary')} style={{ fontSize: 13 }}>
          <option value="">Tag</option>
          {allTags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select aria-label="Category" value={category} onChange={(e) => setParam('category', e.target.value)} className={cn(filterClass, category && 'border-primary text-primary')} style={{ fontSize: 13 }}>
          <option value="">Category</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {(q.trim() || anyFilter) && (
        <p className="text-[13px] text-muted-foreground">
          {hits.length} {hits.length === 1 ? 'result' : 'results'} · passwords and PINs are never searched
        </p>
      )}

      {!q.trim() && !anyFilter && (
        <p className="text-sm text-muted-foreground">
          Type a name, bank, policy or registration number, a person, a tag or anything from your notes.
        </p>
      )}

      {(q.trim() || anyFilter) && hits.length === 0 && (
        <EmptyState title="Nothing found">Try fewer letters, or another word from the item.</EmptyState>
      )}

      {groups.map((g) => (
        <section key={g.category.id} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <CategoryIcon id={g.category.id} size="sm" className="size-6 rounded-md [&_svg]:size-3.5" />
            {g.category.name}
          </h2>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {g.hits.map((h) => (
              <Link
                key={h.item.id}
                to={itemPath(h.item)}
                className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-b-0 hover:bg-muted/60"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{h.item.name}</span>
                  {h.match && <span className="truncate text-[13px] text-muted-foreground">{h.match}</span>}
                </div>
                <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Page>
  )
}
