import {
  BookUser,
  Car,
  CreditCard,
  Folder,
  Gem,
  HandCoins,
  House,
  IdCard,
  KeyRound,
  Landmark,
  PiggyBank,
  Repeat,
  ShieldCheck,
  TrendingUp,
  Vault,
  WashingMachine,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CATEGORY_BY_ID, CATEGORY_GROUPS } from '@/lib/categories'
import { logoFor } from '@/lib/logos'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'

/** One icon per category, used everywhere in the app. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  bank: Landmark,
  card: CreditCard,
  deposit: PiggyBank,
  investment: TrendingUp,
  loan: HandCoins,
  property: House,
  gold: Gem,
  locker: Vault,
  insurance: ShieldCheck,
  id: IdCard,
  utility: Zap,
  appliance: WashingMachine,
  vehicle: Car,
  subscription: Repeat,
  contact: BookUser,
  password: KeyRound,
  other: Folder,
}

export function CategoryIcon({ id, className, size = 'md' }: { id: string; className?: string; size?: 'sm' | 'md' }) {
  const Icon = CATEGORY_ICONS[id] ?? Folder
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center bg-accent text-accent-foreground',
        size === 'sm' ? 'size-8 rounded-[10px]' : 'size-10 rounded-[12px]',
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-[18px]' : 'size-[22px]'} strokeWidth={1.8} />
    </span>
  )
}

/** Grouped category tiles, shared by Home and Add. */
export function CategoryGrid({ hrefFor, counts }: { hrefFor: (id: string) => string; counts?: Record<string, number> }) {
  return (
    <div className="flex flex-col gap-5">
      {CATEGORY_GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col gap-2.5">
          <h3 className="px-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{g.title}</h3>
          <div className={cn('grid gap-2.5', counts ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5')}>
            {g.ids.map((id) => {
              const c = CATEGORY_BY_ID[id]
              const n = counts?.[id] ?? 0
              return (
                <Link
                  key={id}
                  to={hrefFor(id)}
                  className="flex min-h-[104px] flex-col justify-between gap-3 rounded-[20px] border bg-card p-3.5 shadow-soft transition-colors hover:border-primary/40"
                >
                  <span className="flex items-start justify-between gap-2">
                    <CategoryIcon id={id} />
                    {counts && (
                      <span className="num text-[26px] leading-none font-bold" aria-label={`${n} ${n === 1 ? 'item' : 'items'}`}>
                        {n}
                      </span>
                    )}
                  </span>
                  <span className="text-[14px] leading-tight font-medium text-foreground/80">{counts ? c.name : c.short}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

/** An item's own logo when one is bundled, otherwise its category icon. */
export function ItemLogo({ item, size = 'sm', className }: { item: Item; size?: 'sm' | 'md'; className?: string }) {
  const url = logoFor(item)
  if (!url) return <CategoryIcon id={item.category} size={size} className={className} />
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden border bg-white',
        size === 'sm' ? 'size-8 rounded-lg' : 'size-10 rounded-xl',
        className,
      )}
    >
      <img src={url} alt="" className="size-full object-contain p-0.5" />
    </span>
  )
}
