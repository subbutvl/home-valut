import { parseDate } from './dates'
import type { Item } from './types'

const num = (v?: string) => {
  const n = Number(String(v ?? '').replace(/[,₹\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface FdEstimate {
  /** Interest per payout period, for monthly/quarterly payout */
  perPeriod?: number
  period?: 'month' | 'quarter'
  /** Maturity amount for cumulative deposits */
  maturity?: number
}

/**
 * Rough FD figures for display only, labelled "approx." on screen.
 * Monthly/quarterly payout: simple interest per period.
 * Cumulative: compounded quarterly, as Indian banks usually do.
 */
export function estimateFd(item: Item): FdEstimate | null {
  const amount = num(item.fields.amount)
  const rate = num(item.fields.rate)
  if (!amount || !rate) return null
  const payout = item.fields.payout || 'Cumulative'
  if (payout === 'Monthly') return { perPeriod: Math.round((amount * rate) / 1200), period: 'month' }
  if (payout === 'Quarterly') return { perPeriod: Math.round((amount * rate) / 400), period: 'quarter' }
  const start = parseDate(item.fields.startDate)
  const end = parseDate(item.fields.maturityDate)
  if (!start || !end || end <= start) return null
  const years = (end.getTime() - start.getTime()) / (365.25 * 86_400_000)
  return { maturity: Math.round(amount * (1 + rate / 400) ** (4 * years)) }
}
