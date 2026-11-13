// The 17 ready-made categories and their fields (spec section 5).
// "main" fields show first on the form; the rest sit under "More details".
// Fields marked secret are hidden until tapped and are never searched.
// Fields with `reminder` will feed the Coming up list (phase 2).

export type FieldType =
  | 'text'
  | 'number'
  | 'amount'
  | 'date'
  | 'expiry' // MM/YY
  | 'select'
  | 'bool'
  | 'textarea'
  | 'phone'
  | 'email'
  | 'url'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  main?: boolean
  secret?: boolean
  options?: string[]
  /** Values the user typed before are offered back (banks, insurers…). */
  remember?: boolean
  reminder?: { label: string; repeat?: 'monthly' | 'yearly' | 'cycle' }
  placeholder?: string
  /** Shown as "approx." / "as of" reference figure. */
  reference?: 'approx' | 'asOf'
  /** For long numbers: show masked (e.g. Aadhaar) */
  maskable?: boolean
}

export interface CategoryDef {
  id: string
  name: string
  short: string // name on add picker
  mark: string // 1–2 letter tile mark
  subcategories: string[]
  hasNominee?: boolean
  fields: FieldDef[]
  /** Field shown as the one key detail on list rows */
  rowDetail?: (f: Record<string, string>) => string
}

const f = (key: string, label: string, type: FieldType = 'text', extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  type,
  ...extra,
})
const m = (key: string, label: string, type: FieldType = 'text', extra: Partial<FieldDef> = {}) =>
  f(key, label, type, { main: true, ...extra })
const s = (key: string, label: string) => f(key, label, 'text', { secret: true })

const last4 = (v?: string) => (v ? `•${v.replace(/\s/g, '').slice(-4)}` : '')
const join = (...p: (string | undefined)[]) => p.filter(Boolean).join(' · ')

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'bank',
    name: 'Bank accounts',
    short: 'Bank account',
    mark: 'B',
    subcategories: ['Savings', 'Current', 'Joint', 'NRE', 'NRO'],
    hasNominee: true,
    rowDetail: (v) => join(v.bank, last4(v.accountNumber)),
    fields: [
      m('bank', 'Bank', 'text', { remember: true }),
      m('accountNumber', 'Account number'),
      m('ifsc', 'IFSC'),
      m('branch', 'Branch', 'text', { remember: true }),
      m('balance', 'Current balance', 'amount', { reference: 'asOf' }),
      m('balanceAsOf', 'Balance as of', 'date'),
      f('holders', 'Account holder(s)'),
      f('customerId', 'Customer ID (CIF)'),
      f('mobile', 'Registered mobile', 'phone'),
      f('email', 'Registered email', 'email'),
      f('netbankingUser', 'Net banking user ID'),
      f('passbookKept', 'Where passbook is kept'),
      s('netbankingPassword', 'Net banking password'),
      s('transactionPassword', 'Transaction password'),
      s('mpin', 'MPIN'),
      s('upiPin', 'UPI PIN'),
    ],
  },
  {
    id: 'card',
    name: 'Cards',
    short: 'Card',
    mark: 'C',
    subcategories: ['Debit', 'Credit'],
    rowDetail: (v) => join(v.bank, v.last4 ? `•${v.last4}` : '', v.expiry ? `exp ${v.expiry}` : ''),
    fields: [
      m('bank', 'Bank', 'text', { remember: true }),
      m('cardHolder', 'Card holder'),
      m('last4', 'Last 4 digits', 'number'),
      m('expiry', 'Expiry (MM/YY)', 'expiry', { reminder: { label: 'Card expires' } }),
      m('billDue', 'Bill due date', 'date', { reminder: { label: 'Bill due', repeat: 'monthly' } }),
      f('network', 'Network', 'select', { options: ['Visa', 'RuPay', 'Mastercard', 'Amex', 'Diners'] }),
      f('creditLimit', 'Credit limit', 'amount'),
      f('statementDate', 'Statement date (day of month)', 'number'),
      f('customerCare', 'Customer care number', 'phone'),
      s('fullNumber', 'Full card number'),
      s('cvv', 'CVV'),
      s('atmPin', 'ATM PIN'),
    ],
  },
  {
    id: 'deposit',
    name: 'Deposits (FD/RD)',
    short: 'FD / RD',
    mark: 'D',
    subcategories: ['Fixed deposit', 'Recurring deposit'],
    hasNominee: true,
    rowDetail: (v) => join(v.bank, v.rate ? `${v.rate}%` : ''),
    fields: [
      m('bank', 'Bank', 'text', { remember: true }),
      m('number', 'FD/RD number'),
      m('amount', 'Amount', 'amount'),
      m('rate', 'Interest rate (% p.a.)', 'number'),
      m('startDate', 'Start date', 'date'),
      m('maturityDate', 'Maturity date', 'date', { reminder: { label: 'Matures' } }),
      f('holders', 'Holder(s)'),
      f('maturityAmount', 'Maturity amount (from bank)', 'amount'),
      f('interestActual', 'Interest per payout (from bank)', 'amount'),
      f('payout', 'Payout type', 'select', { options: ['Cumulative', 'Monthly', 'Quarterly'] }),
      f('autoRenew', 'Auto-renew', 'bool'),
      f('linkedAccount', 'Interest credited to'),
      f('branch', 'Branch', 'text', { remember: true }),
    ],
  },
  {
    id: 'investment',
    name: 'Bonds and investments',
    short: 'Investment',
    mark: 'I',
    subcategories: ['Bond', 'PPF', 'NSC', 'KVP', 'SGB', 'Mutual fund', 'Shares'],
    hasNominee: true,
    rowDetail: (v) => join(v.issuer, v.number ? last4(v.number) : ''),
    fields: [
      m('issuer', 'Issuer / platform', 'text', { remember: true }),
      m('number', 'Folio / certificate / account number'),
      m('invested', 'Amount invested', 'amount'),
      m('maturityDate', 'Maturity date', 'date', { reminder: { label: 'Matures' } }),
      f('units', 'Units / quantity', 'number'),
      f('purchaseDate', 'Purchase date', 'date'),
      f('rate', 'Interest rate (% p.a.)', 'number'),
      f('broker', 'Broker or demat ID'),
      f('loginUser', 'Login user ID'),
      s('loginPassword', 'Login password'),
      s('pin', 'PIN'),
    ],
  },
  {
    id: 'gold',
    name: 'Gold and jewellery',
    short: 'Gold',
    mark: 'G',
    subcategories: ['Jewellery', 'Coin', 'Bar'],
    rowDetail: (v) => join(v.weight ? `${v.weight} g` : '', v.purity, v.keptAt),
    fields: [
      m('weight', 'Weight (grams)', 'number'),
      m('purity', 'Purity', 'select', { options: ['22K', '24K', '18K', '916', 'Other'] }),
      m('keptAt', 'Where kept'),
      f('purchaseDate', 'Purchase date', 'date'),
      f('price', 'Price paid', 'amount'),
      f('shop', 'Shop', 'text', { remember: true }),
      f('billNumber', 'Bill number'),
    ],
  },
  {
    id: 'locker',
    name: 'Bank lockers',
    short: 'Bank locker',
    mark: 'Lk',
    subcategories: [],
    hasNominee: true,
    rowDetail: (v) => join(v.bank, v.lockerNumber ? `No. ${v.lockerNumber}` : ''),
    fields: [
      m('bank', 'Bank', 'text', { remember: true }),
      m('branch', 'Branch', 'text', { remember: true }),
      m('lockerNumber', 'Locker number'),
      m('size', 'Size', 'select', { options: ['Small', 'Medium', 'Large', 'Extra large'] }),
      m('holders', 'Holder(s)'),
      m('keyKept', 'Where the key is kept'),
      f('rent', 'Annual rent', 'amount'),
      f('rentDue', 'Rent due date', 'date', { reminder: { label: 'Locker rent due', repeat: 'yearly' } }),
      f('agreementDate', 'Agreement date', 'date'),
      f('branchPhone', 'Branch phone', 'phone'),
      f('lastVisited', 'Last visited', 'date'),
      f('contents', 'Contents (one per line)', 'textarea'),
      s('keyNumber', 'Key number'),
    ],
  },
  {
    id: 'property',
    name: 'Property',
    short: 'Property',
    mark: 'P',
    subcategories: ['House', 'Flat', 'Land', 'Commercial'],
    rowDetail: (v) => v.address?.split('\n')[0] ?? '',
    fields: [
      m('address', 'Address', 'textarea'),
      m('owners', 'Owner(s)'),
      m('doorNumber', 'Door / survey number'),
      f('patta', 'Patta / khata number'),
      f('regNumber', 'Registration document number'),
      f('regDate', 'Registration date', 'date'),
      f('subRegistrar', 'Sub-registrar office'),
      f('purchaseValue', 'Purchase value', 'amount'),
      f('taxNumber', 'Property tax assessment number'),
      f('taxDue', 'Property tax due date', 'date', { reminder: { label: 'Property tax due', repeat: 'cycle' } }),
      f('docsKept', 'Where original documents are kept'),
    ],
  },
  {
    id: 'loan',
    name: 'Loans',
    short: 'Loan',
    mark: 'L',
    subcategories: ['Home', 'Vehicle', 'Personal', 'Gold', 'Education'],
    rowDetail: (v) => join(v.lender, v.emi ? `EMI ₹${formatINR(v.emi)}` : ''),
    fields: [
      m('lender', 'Lender', 'text', { remember: true }),
      m('accountNumber', 'Loan account number'),
      m('emi', 'EMI amount', 'amount'),
      m('emiDate', 'Next EMI date', 'date', { reminder: { label: 'EMI due', repeat: 'monthly' } }),
      m('endDate', 'End date', 'date', { reminder: { label: 'Loan ends' } }),
      f('borrowers', 'Borrower(s)'),
      f('sanctioned', 'Sanctioned amount', 'amount'),
      f('rate', 'Interest rate (% p.a.)', 'number'),
      f('rateType', 'Rate type', 'select', { options: ['Fixed', 'Floating'] }),
      f('startDate', 'Start date', 'date'),
      f('tenure', 'Tenure (months)', 'number'),
      f('outstanding', 'Outstanding amount', 'amount', { reference: 'asOf' }),
      f('debitAccount', 'EMI debit account'),
      f('pledgedGold', 'Pledged gold details', 'textarea'),
      f('customerCare', 'Customer care number', 'phone'),
      s('loginPassword', 'Login password'),
    ],
  },
  {
    id: 'utility',
    name: 'Utilities',
    short: 'Utility',
    mark: 'U',
    subcategories: ['Electricity', 'Water', 'Gas', 'Internet', 'Mobile', 'DTH'],
    rowDetail: (v) => join(v.provider, v.consumerNumber),
    fields: [
      m('provider', 'Provider', 'text', { remember: true }),
      m('consumerNumber', 'Consumer / service number'),
      m('address', 'Address'),
      m('billDue', 'Next bill due date', 'date', { reminder: { label: 'Bill due', repeat: 'cycle' } }),
      f('mobile', 'Registered mobile', 'phone'),
      f('cycle', 'Billing cycle', 'select', { options: ['Monthly', 'Bi-monthly', 'Quarterly', 'Yearly'] }),
      f('usualAmount', 'Usual amount', 'amount'),
      f('autoPay', 'Auto-pay', 'bool'),
      f('loginUser', 'Login user ID'),
      f('link', 'Website / app link', 'url'),
      s('loginPassword', 'Login password'),
    ],
  },
  {
    id: 'id',
    name: 'ID documents',
    short: 'ID document',
    mark: 'ID',
    subcategories: ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving licence'],
    rowDetail: (v) => join(v.person, v.expiry ? `exp ${formatDate(v.expiry)}` : ''),
    fields: [
      m('person', 'Person'),
      m('number', 'Number', 'text', { maskable: true }),
      m('expiry', 'Expiry date', 'date', { reminder: { label: 'Expires' } }),
      f('issueDate', 'Issue date', 'date'),
      f('issuedAt', 'Issued at'),
      f('nameAsPrinted', 'Name as printed'),
      f('linkedMobile', 'Linked mobile', 'phone'),
    ],
  },
  {
    id: 'insurance',
    name: 'Insurance',
    short: 'Insurance',
    mark: 'In',
    subcategories: ['Health', 'Life', 'Term', 'Vehicle', 'Home'],
    hasNominee: true,
    rowDetail: (v) => join(v.insurer, v.premium ? `₹${formatINR(v.premium)}` : ''),
    fields: [
      m('insurer', 'Insurer', 'text', { remember: true }),
      m('policyNumber', 'Policy number'),
      m('insured', 'Insured person(s)'),
      m('premium', 'Premium amount', 'amount'),
      m('nextPremium', 'Next premium date', 'date', { reminder: { label: 'Premium due', repeat: 'cycle' } }),
      f('sumAssured', 'Sum assured', 'amount'),
      f('frequency', 'Premium frequency', 'select', { options: ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Single'] }),
      f('startDate', 'Start date', 'date'),
      f('endDate', 'End / maturity date', 'date', { reminder: { label: 'Policy ends' } }),
      f('agentName', 'Agent name'),
      f('agentPhone', 'Agent phone', 'phone'),
      f('claimsHelpline', 'Claims / TPA helpline', 'phone'),
      f('loginUser', 'Login user ID'),
      s('loginPassword', 'Login password'),
    ],
  },
  {
    id: 'vehicle',
    name: 'Vehicles',
    short: 'Vehicle',
    mark: 'V',
    subcategories: ['Car', 'Two-wheeler', 'Other'],
    rowDetail: (v) => join(v.registration, v.makeModel),
    fields: [
      m('makeModel', 'Make and model'),
      m('registration', 'Registration number'),
      m('owner', 'Owner'),
      f('rcValidity', 'RC valid until', 'date', { reminder: { label: 'RC renewal' } }),
      f('pucExpiry', 'PUC expiry', 'date', { reminder: { label: 'PUC expires' } }),
      f('nextService', 'Next service date', 'date', { reminder: { label: 'Service due' } }),
      f('chassis', 'Chassis number'),
      f('engine', 'Engine number'),
      f('purchaseDate', 'Purchase date', 'date'),
      f('dealer', 'Dealer'),
      f('fastag', 'FASTag ID'),
      f('lastService', 'Last service date', 'date'),
      f('lastServiceKm', 'Last service km', 'number'),
    ],
  },
  {
    id: 'appliance',
    name: 'Appliances, warranty, AMC',
    short: 'Appliance',
    mark: 'A',
    subcategories: ['Kitchen', 'Electronics', 'Home', 'Other'],
    rowDetail: (v) => join(v.brand, v.warrantyEnd ? `warranty ${formatDate(v.warrantyEnd)}` : ''),
    fields: [
      m('brand', 'Brand', 'text', { remember: true }),
      m('model', 'Model'),
      m('purchaseDate', 'Purchase date', 'date'),
      m('warrantyEnd', 'Warranty end date', 'date', { reminder: { label: 'Warranty ends' } }),
      f('serial', 'Serial number'),
      f('shop', 'Shop', 'text', { remember: true }),
      f('invoice', 'Invoice number'),
      f('price', 'Price', 'amount'),
      f('extWarrantyEnd', 'Extended warranty end', 'date', { reminder: { label: 'Extended warranty ends' } }),
      f('amcProvider', 'AMC provider'),
      f('amcStart', 'AMC start', 'date'),
      f('amcEnd', 'AMC end', 'date', { reminder: { label: 'AMC renewal' } }),
      f('amcAmount', 'AMC amount', 'amount'),
      f('servicePhone', 'Service centre phone', 'phone'),
      f('lastService', 'Last service date', 'date'),
      f('nextService', 'Next service date', 'date', { reminder: { label: 'Service due' } }),
    ],
  },
  {
    id: 'subscription',
    name: 'Subscriptions',
    short: 'Subscription',
    mark: 'S',
    subcategories: ['Streaming', 'Software', 'News', 'Other'],
    rowDetail: (v) => join(v.amount ? `₹${formatINR(v.amount)}` : '', v.frequency?.toLowerCase()),
    fields: [
      m('plan', 'Plan'),
      m('amount', 'Amount', 'amount'),
      m('frequency', 'Frequency', 'select', { options: ['Monthly', 'Quarterly', 'Yearly'] }),
      m('renewal', 'Next renewal date', 'date', { reminder: { label: 'Renews', repeat: 'cycle' } }),
      f('paymentMethod', 'Payment method'),
      f('autoRenew', 'Auto-renew', 'bool'),
      f('loginEmail', 'Login email', 'email'),
      f('sharedWith', 'Shared with'),
      f('cancelLink', 'Cancel link', 'url'),
      s('password', 'Password'),
    ],
  },
  {
    id: 'contact',
    name: 'Contacts',
    short: 'Contact',
    mark: 'Co',
    subcategories: ['CA', 'Insurance agent', 'Bank RM', 'Doctor', 'Lawyer', 'Technician'],
    rowDetail: (v) => join(v.organisation, v.phone),
    fields: [
      m('role', 'Role'),
      m('phone', 'Phone', 'phone'),
      m('organisation', 'Organisation', 'text', { remember: true }),
      f('phone2', 'Second phone', 'phone'),
      f('email', 'Email', 'email'),
      f('address', 'Address', 'textarea'),
      f('onFamilySheet', 'Show on family sheet', 'bool'),
    ],
  },
  {
    id: 'password',
    name: 'Passwords and logins',
    short: 'Password',
    mark: 'Pw',
    subcategories: [],
    rowDetail: (v) => v.userId ?? '',
    fields: [
      m('link', 'Web link', 'url'),
      m('userId', 'User ID'),
      m('password', 'Password', 'text', { secret: true }),
      f('registered', 'Registered email / mobile'),
      f('questions', 'Security questions', 'textarea'),
      s('pin', 'PIN'),
      f('answers', 'Security answers', 'textarea', { secret: true }),
    ],
  },
  {
    id: 'other',
    name: 'Other',
    short: 'Other',
    mark: 'O',
    subcategories: [],
    fields: [],
  },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, CategoryDef>

export function getCategory(id: string): CategoryDef {
  return CATEGORY_BY_ID[id] ?? CATEGORY_BY_ID.other
}

// ---------------------------------------------------------------------------
// Formatting helpers (Indian commas, readable dates)

export function formatINR(v: string | number): string {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,₹\s]/g, ''))
  if (!Number.isFinite(n)) return String(v)
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)
}

export function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function itemPath(i: { id: string; category: string }) {
  return `/c/${i.category}/${i.id}`
}
