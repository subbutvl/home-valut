import { useState } from 'react'
import { CalendarClock, Check, CopyPlus, Printer, Share2, Pencil, Star, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ItemLogo } from '@/components/CategoryIcon'
import { Card, ValueRow } from '@/components/common'
import { AttachmentsView } from '@/components/Attachments'
import { LinkedAccountRow, LinkedToAccount } from '@/components/BankLink'
import { LockerContentsView } from '@/components/LockerContents'
import { ShareDialog } from '@/components/ShareDialog'
import { Button } from '@/components/ui/button'
import { formatDate, formatINR, getCategory, type FieldDef } from '@/lib/categories'
import { dueText, isStale, shortDate, nextDue, urgency } from '@/lib/dates'
import { estimateFd } from '@/lib/estimates'
import { glowFor, gradientFor, keyFigure, keyIdentifier } from '@/lib/palette'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { markDone } from '@/components/Reminders'
import { PROBLEM_TEXT, passwordIssues } from '@/lib/checks'
import { dueEntries } from '@/lib/reminders'
import { moveToBin, toggleFavourite, useVault } from '@/lib/vault'

function display(fd: FieldDef, v: string): string {
  switch (fd.type) {
    case 'amount':
      return `₹${formatINR(v)}`
    case 'date':
      return formatDate(v)
    case 'bool':
      return v === 'yes' ? 'Yes' : 'No'
    case 'number':
      return fd.key === 'rate' ? `${v}%` : v
    default:
      return v
  }
}

/** Aadhaar-style masking: XXXX XXXX 1234 */
function masked(v: string) {
  const digits = v.replace(/\s/g, '')
  return digits.length > 4 ? `${'X'.repeat(digits.length - 4).replace(/(.{4})/g, '$1 ')}${digits.slice(-4)}` : v
}

export function ItemDetail({ item, backTo }: { item: Item; backTo: string }) {
  const navigate = useNavigate()
  const [sharing, setSharing] = useState(false)
  const cat = getCategory(item.category)
  const due = nextDue(item)
  const urg = urgency(due)
  const filled = cat.fields.filter((fd) => item.fields[fd.key])
  const fd = item.category === 'deposit' ? estimateFd(item) : null
  const { settings, items } = useVault()
  const pwIssues = passwordIssues(items).filter((p) => p.item.id === item.id)
  // "Mark done" for bills, premiums, EMIs, subscriptions, once they are within their reminder window.
  const doneEntry = dueEntries(item, settings)
    .filter((e) => e.days <= e.lead)
    .sort((a, b) => a.days - b.days)[0]

  const meta = [item.subcategory || cat.short, item.belongsTo.length > 1 ? `Joint · ${item.belongsTo.join(', ')}` : item.belongsTo[0]]
    .filter(Boolean)
    .join(' · ')
  const figure = keyFigure(item)
  const ident = keyIdentifier(item)

  const onDelete = async () => {
    await moveToBin(item.id)
    toast('Moved to Bin. You can restore it for 30 days.')
    navigate(backTo)
  }
  const onDuplicate = () => navigate(`/add/${item.category}?from=${item.id}`)

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => toggleFavourite(item.id)}
          aria-label={item.favourite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={!!item.favourite}
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border bg-card"
        >
          <Star className={cn('size-[20px]', item.favourite ? 'fill-amber-400 stroke-amber-600' : 'stroke-muted-foreground')} />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Duplicate: make a new one like this"
          title="Duplicate"
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border bg-card"
        >
          <CopyPlus className="size-[19px]" />
        </button>
        <Button asChild className="h-11 rounded-[14px] px-5">
          <Link to={`/edit/${item.id}`}>
            <Pencil /> Edit
          </Link>
        </Button>
      </div>

      {/* Hero card: the item's colour, logo, name, people and its one key figure. */}
      <section
        className="relative flex flex-col gap-5 overflow-hidden rounded-[28px] p-5 text-white"
        style={{ backgroundImage: gradientFor(item.category), boxShadow: glowFor(item.category) }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18), rgba(255,255,255,0) 70%)' }}
        />
        <div className="flex items-center gap-3">
          <ItemLogo item={item} size="md" className="size-12 rounded-[14px] border-0 bg-white text-[#1B3C7A] [&_svg]:text-[#1B3C7A]" />
          <div className="flex min-w-0 flex-col">
            <h1 className="text-[24px] leading-tight font-bold break-words">{item.name}</h1>
            <span className="text-[13px] text-white/75">{meta}</span>
          </div>
        </div>
        {figure && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-white/75">
              {figure.label}
              {item.category === 'bank' && isStale(item.fields.balanceAsOf) ? ' · over 90 days old' : ''}
            </span>
            <span className="num text-[40px] leading-none font-bold">{figure.value}</span>
          </div>
        )}
        {ident && <span className="font-mono text-[16px] tracking-[0.12em] text-white/90">{ident}</span>}
      </section>

      {due && (urg === 'overdue' || urg === 'soon') && (
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold',
            urg === 'overdue' ? 'bg-destructive/10 text-destructive' : 'bg-warn-bg text-warn-fg',
          )}
        >
          <CalendarClock className="size-5" />
          {urg === 'overdue'
            ? `${due.label} · was due ${shortDate(due.date)}`
            : `${dueText(due)} · in ${due.days} ${due.days === 1 ? 'day' : 'days'}`}
        </div>
      )}

      {doneEntry && (
        <Button size="lg" onClick={() => markDone(doneEntry)}>
          <Check /> Mark done{doneEntry.repeatMonths ? ' · move to next cycle' : ''}
        </Button>
      )}

      {fd && (
        <Card className="grid grid-cols-2 gap-3 p-4">
          {fd.perPeriod !== undefined && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Interest per {fd.period}</span>
              <span className="text-[22px] font-bold">₹{formatINR(item.fields.interestActual || fd.perPeriod)}</span>
              <span className="text-xs text-muted-foreground">
                {item.fields.interestActual ? 'entered by you' : 'approx. · estimated'}
              </span>
            </div>
          )}
          {fd.maturity !== undefined && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Amount at maturity</span>
              <span className="text-[22px] font-bold">₹{formatINR(item.fields.maturityAmount || fd.maturity)}</span>
              <span className="text-xs text-muted-foreground">
                {item.fields.maturityAmount ? 'entered by you' : 'approx. · estimated'}
              </span>
            </div>
          )}
          <p className="col-span-2 text-xs text-muted-foreground">
            Reference figures only. Edit the item to enter the bank's actual numbers.
          </p>
        </Card>
      )}

      {(filled.length > 0 || item.custom.length > 0 || item.nominees.length > 0) && (
        <Card className="overflow-hidden">
          {filled
            .filter((f) => !(item.category === 'bank' && (f.key === 'balance' || f.key === 'balanceAsOf')))
            .map((f) => {
              const v = item.fields[f.key]
              const isMasked = f.maskable && item.subcategory === 'Aadhaar'
              return (
                <ValueRow
                  key={f.key}
                  label={f.label}
                  value={v}
                  display={isMasked ? masked(v) : display(f, v)}
                  secret={f.secret}
                  mono={isMasked}
                />
              )
            })}
          {item.nominees.length > 0 && (
            <ValueRow
              label={item.nominees.length > 1 ? 'Nominees' : 'Nominee'}
              value={item.nominees.map((n) => `${n.name}${n.share ? ` ${n.share}%` : ''}`).join(', ')}
            />
          )}
          {item.custom
            .filter((c) => c.value)
            .map((c) => (
              <ValueRow key={c.id} label={c.label || 'Custom field'} value={c.value} secret={c.secret} />
            ))}
        </Card>
      )}

      <LinkedAccountRow item={item} />

      {pwIssues.length > 0 && (
        <Link to="/health" className="flex flex-col gap-0.5 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-fg">
          <span className="font-semibold">Weak password</span>
          {pwIssues.map((p) => (
            <span key={p.label}>
              {p.label}: {p.problems.map((x) => PROBLEM_TEXT[x]).join(', ')}
            </span>
          ))}
        </Link>
      )}

      {cat.hasNominee && item.nominees.length === 0 && (
        <div className="flex items-center justify-between rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-fg">
          <span className="font-semibold">No nominee added</span>
          <Link to={`/edit/${item.id}`} className="font-semibold underline">
            Add
          </Link>
        </div>
      )}

      {item.lockerContents?.length ? <LockerContentsView value={item.lockerContents} /> : null}

      {item.category === 'bank' && <LinkedToAccount account={item} />}

      {item.attachments?.length ? <AttachmentsView value={item.attachments} /> : null}

      {(item.notes || item.tags.length > 0) && (
        <Card className="flex flex-col gap-2 p-4">
          {item.notes && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Notes</span>
              <p className="text-[15px] whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <Link
                  key={t}
                  to={`/search?tag=${encodeURIComponent(t)}`}
                  className="rounded-lg bg-muted px-2.5 py-1 text-[13px]"
                >
                  {t}
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {filled.length === 0 && item.custom.length === 0 && !item.notes && !item.attachments?.length && !item.lockerContents?.length && (
        <p className="text-sm text-muted-foreground">Nothing else saved yet. Tap Edit to add details.</p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <Button variant="outline" onClick={() => setSharing(true)}>
          <Share2 /> Share
        </Button>
        <Button variant="outline" onClick={() => navigate(`/print/item/${item.id}`)}>
          <Printer /> Print
        </Button>
        <Button variant="outline" onClick={onDuplicate}>
          <CopyPlus /> Duplicate
        </Button>
        <Button variant="outline" className="text-destructive" onClick={onDelete}>
          <Trash2 /> Delete
        </Button>
      </div>
      <ShareDialog item={item} open={sharing} onClose={() => setSharing(false)} />
      <p className="text-center text-xs text-muted-foreground">
        Secrets hide again after 30 seconds. Copied secrets clear from the clipboard after 30 seconds.
      </p>
    </div>
  )
}
