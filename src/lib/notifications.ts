// In-app Notifications centre (spec section 6). Alerts are created when the app
// is opened and every hour while it is open. They live in the encrypted settings
// record, so reading one on the phone marks it read on the laptop too.

import { formatINR } from './categories'
import { PROBLEM_TEXT, healthReport } from './checks'
import { shortDate } from './dates'
import { getSyncMeta } from './db'
import { allDue } from './reminders'
import type { Notif, Settings } from './types'
import { getState, newId, saveSettings } from './vault'

const DAY = 86_400_000

export function visibleNotifs(s: Settings): Notif[] {
  const now = Date.now()
  return s.notifications.filter((n) => !n.snoozeUntil || n.snoozeUntil <= now).sort((a, b) => b.createdAt - a.createdAt)
}

export function unreadCount(s: Settings): number {
  return visibleNotifs(s).filter((n) => !n.read).length
}

/** Apply a change to the notification list and save once. */
async function edit(fn: (s: Settings) => Partial<Settings> | null) {
  const s = getState().settings
  const patch = fn(s)
  if (patch) await saveSettings({ ...s, ...patch })
}

export async function addNotification(n: Omit<Notif, 'id' | 'createdAt'>) {
  await edit((s) => {
    if (s.notifKeys[n.key]) return null
    return {
      notifications: [{ ...n, id: newId(), createdAt: Date.now() }, ...s.notifications],
      notifKeys: { ...s.notifKeys, [n.key]: Date.now() },
    }
  })
}

/** Create any new reminder, overdue and backup alerts; tidy old ones. */
export async function refreshNotifications() {
  const st = getState()
  if (st.status !== 'unlocked') return
  const s = st.settings
  const now = Date.now()
  const fresh: Notif[] = []
  const keys = { ...s.notifKeys }
  const add = (n: Omit<Notif, 'id' | 'createdAt'>) => {
    if (keys[n.key]) return
    keys[n.key] = now
    fresh.push({ ...n, id: newId(), createdAt: now })
  }

  for (const e of allDue(st.items, s)) {
    if (e.days > e.lead) continue
    const when = shortDate(e.date)
    const amt = e.amount ? ` · ${e.amount}` : ''
    if (e.days < 0)
      add({
        key: `overdue:${e.item.id}:${e.field.key}:${e.value}`,
        type: 'overdue',
        itemId: e.item.id,
        title: `${e.item.name}: ${e.label.toLowerCase()} · overdue since ${when}`,
        body: `Not marked done yet${amt}`,
      })
    else
      add({
        key: `reminder:${e.item.id}:${e.field.key}:${e.value}`,
        type: 'reminder',
        itemId: e.item.id,
        title: `${e.item.name}: ${e.label.toLowerCase()} ${e.days === 0 ? 'today' : `in ${e.days} ${e.days === 1 ? 'day' : 'days'}`}`,
        body: `${when}${amt}`,
      })
  }

  // Each new health-check issue also becomes a Check notification.
  const h = healthReport(st.items, s)
  for (const g of h.nominees)
    for (const i of g.items)
      add({ key: `check:nominee:${i.id}`, type: 'check', itemId: i.id, title: `${i.name} has no nominee`, body: 'Add a nominee so the family can claim it.' })
  for (const b of h.bankLimit)
    add({
      key: `check:limit:${b.key}:${Math.floor(b.total / 100000)}`,
      type: 'check',
      title: `Deposits at ${b.bank} for ${b.person} are ₹${formatINR(b.total)}`,
      body: `Above the ₹${formatINR(s.bankLimit)} insured limit (DICGC). Figures are the ones you typed.`,
    })
  for (const p of h.passwords)
    add({
      key: `check:pw:${p.item.id}:${p.label}:${p.problems.join(',')}`,
      type: 'check',
      itemId: p.item.id,
      title: `Weak password on ${p.item.name}`,
      body: `${p.label}: ${p.problems.map((x) => PROBLEM_TEXT[x]).join(', ')}`,
    })

  // Family sheet: remind every 6 months to reprint if anything changed since.
  const printed = s.familySheet?.printedAt
  if (printed && now - printed > 182 * DAY && st.items.some((i) => i.updatedAt > printed))
    add({
      key: `family:${printed}`,
      type: 'app',
      title: 'Family sheet is over 6 months old and items have changed',
      body: 'Print it again from Settings → Emergency family sheet.',
    })

  const sync = await getSyncMeta()
  if (sync.connected && sync.lastSync && now - sync.lastSync > 7 * DAY)
    add({
      key: `backup:${Math.floor(now / (7 * DAY))}`,
      type: 'backup',
      title: 'No backup to Google Drive for 7 days',
      body: 'Open Backup and sync, then tap Sync now.',
    })

  // Read alerts go after 90 days; remembered keys after 180 days.
  const kept = s.notifications.filter((n) => !(n.read && now - n.createdAt > 90 * DAY))
  for (const [k, t] of Object.entries(keys)) if (now - t > 180 * DAY) delete keys[k]

  if (fresh.length || kept.length !== s.notifications.length)
    await saveSettings({ ...s, notifications: [...fresh, ...kept], notifKeys: keys })
}

export const markRead = (id: string) =>
  edit((s) =>
    s.notifications.some((n) => n.id === id && !n.read)
      ? { notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }
      : null,
  )

export const markAllRead = () =>
  edit((s) => ({ notifications: s.notifications.map((n) => (n.read ? n : { ...n, read: true })) }))

export const snooze = (id: string, days: number) =>
  edit((s) => ({
    notifications: s.notifications.map((n) =>
      n.id === id ? { ...n, read: false, snoozeUntil: Date.now() + days * DAY } : n,
    ),
  }))

/** After "Mark done", its reminder/overdue alerts are marked read. */
export const readForItem = (itemId: string) =>
  edit((s) =>
    s.notifications.some((n) => n.itemId === itemId && !n.read && (n.type === 'reminder' || n.type === 'overdue'))
      ? {
          notifications: s.notifications.map((n) =>
            n.itemId === itemId && (n.type === 'reminder' || n.type === 'overdue') ? { ...n, read: true } : n,
          ),
        }
      : null,
  )
