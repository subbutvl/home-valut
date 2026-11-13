import { Link } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { CategoryGrid, CategoryIcon } from '@/components/CategoryIcon'
import { PageHeader } from '@/components/common'
import { CATEGORY_BY_ID } from '@/lib/categories'
import { useVault } from '@/lib/vault'

export default function AddChoose() {
  const { items } = useVault()
  // Recently used: categories of the 3 most recently created items.
  const recent = [
    ...new Set(
      [...items]
        .filter((i) => !i.deletedAt)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((i) => i.category),
    ),
  ].slice(0, 3)

  return (
    <Page>
      <PageHeader title="What are you adding?" back="/" />
      {recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-[13px] text-muted-foreground">Recently used</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((id) => (
              <Link
                key={id}
                to={`/add/${id}`}
                className="flex h-10 items-center gap-2 rounded-full bg-accent pr-4 pl-2 text-sm font-semibold text-accent-foreground"
              >
                <CategoryIcon id={id} size="sm" className="size-7 bg-transparent" />
                {CATEGORY_BY_ID[id].short}
              </Link>
            ))}
          </div>
        </section>
      )}
      <CategoryGrid hrefFor={(id) => `/add/${id}`} />
    </Page>
  )
}
