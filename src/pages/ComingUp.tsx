import { Page } from '@/components/AppShell'
import { EmptyState, PageHeader } from '@/components/common'
import { DueRow, SubscriptionTotal } from '@/components/Reminders'
import { NotificationBell } from '@/pages/Notifications'
import { allDue, groupComingUp, type DueEntry } from '@/lib/reminders'
import { useVault } from '@/lib/vault'

function Group({ title, entries, tone }: { title: string; entries: DueEntry[]; tone: string }) {
  if (!entries.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className={`px-1 text-xs font-semibold tracking-wide ${tone}`}>
        {title} · {entries.length}
      </h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {entries.map((e) => (
          <DueRow key={`${e.item.id}:${e.field.key}`} e={e} />
        ))}
      </div>
    </section>
  )
}

export default function ComingUp() {
  const { items, settings } = useVault()
  const g = groupComingUp(allDue(items, settings))
  const empty = !g.overdue.length && !g.soon.length && !g.later.length
  return (
    <Page>
      <PageHeader title="Coming up" right={<NotificationBell />} subtitle="Every date that needs attention in the next 90 days." />
      <SubscriptionTotal items={items} />
      <Group title="OVERDUE" entries={g.overdue} tone="text-destructive" />
      <Group title="NEXT 30 DAYS" entries={g.soon} tone="text-due" />
      <Group title="LATER (31–90 DAYS)" entries={g.later} tone="text-muted-foreground" />
      {empty && (
        <EmptyState title="Nothing due in the next 90 days">
          Renewal, maturity, premium, bill and expiry dates you add to items show up here.
        </EmptyState>
      )}
      <p className="text-center text-xs text-muted-foreground">
        “Done” moves a repeating date to its next cycle. No payments are recorded.
      </p>
    </Page>
  )
}
