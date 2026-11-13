import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { Card, EmptyState, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { getCategory } from '@/lib/categories'
import { BIN_DAYS } from '@/lib/types'
import { deleteForever, restoreFromBin, useVault } from '@/lib/vault'

export default function Bin() {
  const { items } = useVault()
  const binned = items.filter((i) => i.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  const daysLeft = (t: number) => Math.max(0, BIN_DAYS - Math.floor((Date.now() - t) / 86_400_000))

  return (
    <Page>
      <PageHeader title="Bin" back="/settings" subtitle={`Deleted items stay here for ${BIN_DAYS} days, then are removed.`} />
      {binned.length === 0 ? (
        <EmptyState title="The bin is empty" />
      ) : (
        <Card className="overflow-hidden">
          {binned.map((i) => (
            <div key={i.id} className="flex items-center gap-2 border-b border-border/60 px-4 py-3 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{i.name}</span>
                <span className="text-[13px] text-muted-foreground">
                  {getCategory(i.category).name} · {daysLeft(i.deletedAt!)} days left
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={async () => { await restoreFromBin(i.id); toast.success('Restored') }}>
                Restore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={async () => {
                  if (confirm(`Delete “${i.name}” for good? This cannot be undone.`)) await deleteForever(i.id)
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </Card>
      )}
    </Page>
  )
}
