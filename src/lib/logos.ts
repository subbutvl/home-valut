// Logos for banks, insurers and services, bundled from src/assets/logos.
// Nothing is fetched from the internet: that would tell other sites which
// banks and services you use, and would not work offline.

import type { Item } from './types'

/** slug → words that identify it (lower case). The slug is the file name. */
export const LOGO_ALIASES: Record<string, string[]> = {
  sbi: ['sbi', 'state bank'],
  hdfc: ['hdfc bank', 'hdfc'],
  icici: ['icici bank', 'icici'],
  axis: ['axis'],
  kotak: ['kotak'],
  canara: ['canara'],
  'indian-bank': ['indian bank'],
  iob: ['iob', 'indian overseas'],
  'bank-of-baroda': ['bank of baroda', 'bob'],
  pnb: ['pnb', 'punjab national'],
  'union-bank': ['union bank'],
  'bank-of-india': ['bank of india'],
  'central-bank': ['central bank'],
  'yes-bank': ['yes bank'],
  'idfc-first': ['idfc'],
  indusind: ['indusind'],
  federal: ['federal bank'],
  'karur-vysya': ['karur vysya', 'kvb'],
  'city-union': ['city union', 'cub'],
  'tamilnad-mercantile': ['tamilnad mercantile', 'tmb'],
  'south-indian': ['south indian bank'],
  'india-post': ['india post', 'post office'],
  lic: ['lic', 'life insurance corporation'],
  'star-health': ['star health'],
  'hdfc-ergo': ['hdfc ergo'],
  'hdfc-life': ['hdfc life'],
  'icici-lombard': ['icici lombard'],
  'icici-prudential': ['icici prudential', 'icici pru'],
  'sbi-life': ['sbi life'],
  'niva-bupa': ['niva bupa', 'max bupa'],
  'care-health': ['care health', 'religare'],
  'tata-aig': ['tata aig'],
  'bajaj-allianz': ['bajaj allianz'],
  zerodha: ['zerodha'],
  groww: ['groww'],
  netflix: ['netflix'],
  'amazon-prime': ['amazon prime', 'prime video'],
  jiohotstar: ['jiohotstar', 'hotstar'],
  spotify: ['spotify'],
  youtube: ['youtube'],
  airtel: ['airtel'],
  jio: ['jio'],
  bsnl: ['bsnl'],
  vi: ['vodafone', 'vi'],
  tangedco: ['tangedco', 'tneb', 'tnpdcl'],
  'google-one': ['google one'],
  microsoft: ['microsoft 365', 'office 365'],
}

const files = import.meta.glob('../assets/logos/*.{svg,png,webp,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** slug → bundled file url, only for logos that exist */
const AVAILABLE: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]),
)

// Whole words only, longest first, so "hdfc ergo" wins over "hdfc" and "vi" doesn't match "navi".
const MATCHERS: [string, RegExp][] = Object.entries(LOGO_ALIASES)
  .flatMap(([slug, words]) => words.map((w) => [slug, w] as const))
  .sort((a, b) => b[1].length - a[1].length)
  .map(([slug, w]) => [slug, new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`)])

const ORG_FIELDS = ['bank', 'insurer', 'issuer', 'lender', 'provider', 'brand', 'organisation']

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The logo url for an item, or undefined when none is bundled. */
export function logoFor(item: Item): string | undefined {
  if (!Object.keys(AVAILABLE).length) return undefined
  const texts = [...ORG_FIELDS.map((k) => item.fields[k]), item.name].filter(Boolean).map((t) => t!.toLowerCase().trim())
  for (const t of texts) {
    for (const [slug, re] of MATCHERS) if (AVAILABLE[slug] && re.test(t)) return AVAILABLE[slug]
    // A file named after the exact organisation also works, e.g. "mylapore-cooperative.png".
    const direct = AVAILABLE[slugify(t)]
    if (direct) return direct
  }
  return undefined
}
