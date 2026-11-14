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
        size === 'sm' ? 'size-8 rounded-lg' : 'size-10 rounded-xl',
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
          <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</h3>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
            {g.ids.map((id) => {
              const c = CATEGORY_BY_ID[id]
              const n = counts?.[id] ?? 0
              return (
                <Link
                  key={id}
                  to={hrefFor(id)}
                  className="flex min-h-[104px] flex-col gap-2 rounded-[14px] border bg-card p-3 hover:border-primary/40"
                >
                  <CategoryIcon id={id} />
                  <span className="text-[13px] leading-tight font-semibold">{counts ? c.name : c.short}</span>
                  {counts && (
                    <span className="mt-auto text-xs text-muted-foreground">
                      {n} {n === 1 ? 'item' : 'items'}
                    </span>
                  )}
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
