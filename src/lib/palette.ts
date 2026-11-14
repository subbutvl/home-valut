// Colours for hero cards and favourite tiles: one rich gradient per category,
// the same in light and dark mode (white text on top).

import { formatDate, formatINR } from './categories'
import type { Item } from './types'

export const CAT_GRADIENT: Record<string, [string, string]> = {
  bank: ['#2E5BB8', '#142C63'],
  card: ['#3A3F4E', '#1C1F28'],
  deposit: ['#2FA37A', '#145A43'],
  investment: ['#8A57D6', '#3F2370'],
  loan: ['#B7791F', '#5C3A0B'],
  property: ['#C2603D', '#5E2A17'],
  gold: ['#B8932A', '#5E4810'],
  locker: ['#5B6B82', '#2A3342'],
  utility: ['#D9782F', '#77390D'],
  id: ['#4A6FA5', '#1F3557'],
  insurance: ['#1E9AA8', '#0E4F5A'],
  vehicle: ['#C9465E', '#661A28'],
  appliance: ['#3F8F8A', '#1B4744'],
  subscription: ['#C2477A', '#5E1A3A'],
  contact: ['#6B7A8F', '#2F3846'],
  password: ['#454B60', '#16181F'],
  other: ['#5E6473', '#2A2D36'],
}

export function gradientFor(category: string): string {
  const [a, b] = CAT_GRADIENT[category] ?? CAT_GRADIENT.other
  return `linear-gradient(145deg, ${a} 0%, ${b} 72%)`
}

export function glowFor(category: string): string {
  const [, b] = CAT_GRADIENT[category] ?? CAT_GRADIENT.other
  return `0 18px 36px -12px ${b}aa`
}

export interface KeyFigure {
  label: string
  value: string
}

/** The one number that matters most for an item, shown big on its card. */
export function keyFigure(item: Item): KeyFigure | null {
  const f = item.fields
  const amt = (v?: string) => (v ? `₹${formatINR(v)}` : '')
  switch (item.category) {
    case 'bank':
      return f.balance
        ? { label: `Balance${f.balanceAsOf ? ` · as of ${formatDate(f.balanceAsOf)}` : ''} · typed by you`, value: amt(f.balance) }
        : null
    case 'deposit':
      return f.amount ? { label: f.maturityDate ? `Matures ${formatDate(f.maturityDate)}` : 'Amount', value: amt(f.amount) } : null
    case 'insurance':
      return f.premium ? { label: f.nextPremium ? `Premium · due ${formatDate(f.nextPremium)}` : 'Premium', value: amt(f.premium) } : null
    case 'loan':
      return f.emi ? { label: 'EMI', value: amt(f.emi) } : null
    case 'subscription':
      return f.amount ? { label: f.frequency ? `${f.frequency}` : 'Amount', value: amt(f.amount) } : null
    case 'investment':
      return f.invested ? { label: 'Invested', value: amt(f.invested) } : null
    case 'gold':
      return f.weight ? { label: [f.purity, f.keptAt].filter(Boolean).join(' · ') || 'Weight', value: `${f.weight} g` } : null
    case 'card':
      return f.expiry ? { label: 'Expires', value: f.expiry } : null
    case 'vehicle':
      return f.registration ? { label: f.makeModel || 'Registration', value: f.registration } : null
    case 'utility':
      return f.usualAmount ? { label: 'Usual bill', value: amt(f.usualAmount) } : null
    case 'locker':
      return f.lockerNumber ? { label: [f.bank, f.branch].filter(Boolean).join(' · ') || 'Locker', value: `No. ${f.lockerNumber}` } : null
    default:
      return null
  }
}

/** The identifier shown in mono on the card (account, policy, card…), if any. */
export function keyIdentifier(item: Item): string | null {
  const f = item.fields
  if (item.category === 'card') return f.last4 ? `•••• •••• •••• ${f.last4}` : null
  if (item.category === 'vehicle') return null
  return f.accountNumber || f.number || f.policyNumber || f.consumerNumber || f.registration || null
}
