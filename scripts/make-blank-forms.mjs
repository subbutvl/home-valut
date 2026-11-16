// Usage: npm run forms   (writes docs/HomeVault-blank-forms.docx)
// Builds a blank, fill-by-hand Word form for every HomeVault category, from the
// app's own field definitions, grouped like the print page.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, AlignmentType, PageBreak, Footer, PageNumber, TableLayoutType, HeightRule, VerticalAlign,
} = require('docx')
// Node 23+ runs the app's TypeScript field list directly.
const { CATEGORIES, CATEGORY_GROUPS, CATEGORY_BY_ID, BANK_LINK_LABEL } = await import(
  new URL('../src/lib/categories.ts', import.meta.url).href
)

const OUT = process.argv[2] ?? new URL('../docs/HomeVault-blank-forms.docx', import.meta.url)
const FONT = 'Arial'
const INK = '14161D'
const MOSS = '3D6B37'
const MUTED = '5E6473'
const LINE = '9AA39A'
const PAGE_W = 11906 // A4 in DXA
const MARGIN = 900
const W = PAGE_W - MARGIN * 2 // 10106
const LABEL_W = 3300
const VALUE_W = W - LABEL_W

const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noBorders = { top: none, bottom: none, left: none, right: none }
const writeLine = { style: BorderStyle.SINGLE, size: 4, color: LINE }

const t = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, color: o.color ?? INK, italics: o.italics })
const p = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], spacing: { before: o.before ?? 0, after: o.after ?? 0 }, alignment: o.align, keepNext: o.keepNext, keepLines: true })

// --- grouping, same rules as the app's print layout --------------------------
const LOGIN_KEYS = /login|user|netbanking|registered|customerCare|helpline|servicePhone|branchPhone|agent/i
const PEOPLE_KEYS = /^(holders|owners|owner|insured|borrowers|cardHolder|person|sharedWith)$/
function groups(cat) {
  const g = { key: [], people: [], money: [], contact: [], other: [], secret: [] }
  for (const fd of cat.fields) {
    if (fd.key === 'onFamilySheet') continue
    if (fd.key === 'contents') continue
    if (fd.secret) g.secret.push(fd)
    else if (PEOPLE_KEYS.test(fd.key)) g.people.push(fd)
    else if (fd.main) g.key.push(fd)
    else if (['date', 'amount', 'expiry'].includes(fd.type) || ['rate', 'payout', 'frequency'].includes(fd.key)) g.money.push(fd)
    else if (['phone', 'email', 'url'].includes(fd.type) || LOGIN_KEYS.test(fd.key)) g.contact.push(fd)
    else g.other.push(fd)
  }
  return g
}

// What to pre-print in the writing space, so the form shows every option.
function hint(fd) {
  if (fd.type === 'select') return fd.options.map((o) => `☐ ${o}`).join('    ')
  if (fd.type === 'bool') return '☐ Yes    ☐ No'
  if (fd.type === 'date') return '____ / ____ / ________   (DD / MM / YYYY)'
  if (fd.type === 'expiry') return '____ / ____   (MM / YY)'
  if (fd.type === 'amount') return '₹'
  if (fd.key === 'rate') return '% p.a.'
  if (fd.key === 'weight' || fd.key === 'units') return ''
  if (fd.reference === 'asOf') return '₹'
  return ''
}
const tall = (fd) => fd.type === 'textarea'

// --- building blocks ----------------------------------------------------------
function row(label, hintText = '', o = {}) {
  const h = o.tall ? 900 : 440
  return new TableRow({
    cantSplit: true,
    height: { value: h, rule: HeightRule.ATLEAST },
    children: [
      new TableCell({
        width: { size: LABEL_W, type: WidthType.DXA },
        borders: noBorders,
        verticalAlign: VerticalAlign.BOTTOM,
        margins: { top: 40, bottom: 40, left: 0, right: 120 },
        children: [p(t(label, { size: 19, color: MUTED }))],
      }),
      new TableCell({
        width: { size: VALUE_W, type: WidthType.DXA },
        borders: { top: none, left: none, right: none, bottom: writeLine },
        verticalAlign: VerticalAlign.BOTTOM,
        margins: { top: 40, bottom: 40, left: 80, right: 0 },
        children: [p(t(hintText, { size: 17, color: '8A9088' }))],
      }),
    ],
  })
}

/** Full-width writing lines (notes). */
function lines(title, n) {
  return [
    p(t(title.toUpperCase(), { size: 16, bold: true, color: MOSS }), { before: 200, after: 40, keepNext: true }),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      layout: TableLayoutType.FIXED,
      rows: Array.from({ length: n }, () =>
        new TableRow({
          cantSplit: true,
          height: { value: 460, rule: HeightRule.ATLEAST },
          children: [new TableCell({ width: { size: W, type: WidthType.DXA }, borders: { top: none, left: none, right: none, bottom: writeLine }, children: [p(t(''))] })],
        }),
      ),
    }),
  ]
}

function section(title, rows) {
  return [
    p(t(title.toUpperCase(), { size: 16, bold: true, color: MOSS }), { before: 200, after: 40, keepNext: true }),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [LABEL_W, VALUE_W],
      layout: TableLayoutType.FIXED,
      borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
      rows,
    }),
  ]
}

/** A small grid with headings and N empty rows (locker contents, nominees). */
function gridTable(title, heads, widths, n) {
  const head = new TableRow({
    tableHeader: true,
    children: heads.map((h, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8EFE4' },
        borders: { top: writeLine, bottom: writeLine, left: writeLine, right: writeLine },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [p(t(h, { size: 17, bold: true, color: INK }))],
      }),
    ),
  })
  const empty = Array.from({ length: n }, () =>
    new TableRow({
      cantSplit: true,
      height: { value: 460, rule: HeightRule.ATLEAST },
      children: widths.map((w) =>
        new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: writeLine, bottom: writeLine, left: writeLine, right: writeLine }, children: [p(t(''))] }),
      ),
    }),
  )
  return [
    p(t(title.toUpperCase(), { size: 16, bold: true, color: MOSS }), { before: 200, after: 60, keepNext: true }),
    new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: [head, ...empty] }),
  ]
}

function titleBar(cat, groupTitle) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1F2A1C' },
            borders: noBorders,
            margins: { top: 160, bottom: 160, left: 220, right: 220 },
            children: [
              p(t(groupTitle.toUpperCase(), { size: 15, bold: true, color: 'AED69F' })),
              p(t(cat.name, { size: 34, bold: true, color: 'FFFFFF' }), { before: 40 }),
            ],
          }),
        ],
      }),
    ],
  })
}

// --- one form per category ----------------------------------------------------
function categoryForm(id, groupTitle) {
  const cat = CATEGORY_BY_ID[id]
  const g = groups(cat)
  const out = [titleBar(cat, groupTitle)]
  out.push(
    p(t('Use one sheet per ' + cat.short.toLowerCase() + '. Photocopy this page for more. Write clearly; leave blank what does not apply.', { size: 17, italics: true, color: MUTED }), { before: 120 }),
  )
  // Key details always start with Name and Type
  const keyRows = [row('Name *', '')]
  if (cat.subcategories.length) keyRows.push(row('Type', cat.subcategories.map((s) => `☐ ${s}`).join('    ') + '    ☐ Other: ________'))
  for (const fd of g.key) keyRows.push(row(fd.label.replace(/ \(.*\)$/, ''), hint(fd), { tall: tall(fd) }))
  if (BANK_LINK_LABEL[id]) keyRows.push(row(BANK_LINK_LABEL[id] + ' (bank account)', ''))
  out.push(...section('Key details', keyRows))

  const peopleRows = [row('Belongs to', '☐ Self    ☐ Joint with: ____________________')]
  for (const fd of g.people) peopleRows.push(row(fd.label, hint(fd)))
  out.push(...section('People', peopleRows))
  if (cat.hasNominee) out.push(...gridTable('Nominees', ['Nominee name', 'Relationship', 'Share %'], [5000, 3306, 1800], 3))

  if (g.money.length) out.push(...section('Dates and amounts', g.money.map((fd) => row(fd.label, hint(fd), { tall: tall(fd) }))))
  if (g.contact.length) out.push(...section('Contact and login', g.contact.map((fd) => row(fd.label, hint(fd)))))
  if (g.other.length) out.push(...section('Other details', g.other.map((fd) => row(fd.label, hint(fd), { tall: tall(fd) }))))
  if (id === 'locker') out.push(...gridTable('Contents of the locker', ['Item', 'Description', 'Approx. value ₹', 'Owner'], [2700, 3606, 1900, 1900], 6))
  if (g.secret.length)
    out.push(
      ...section('Passwords and PINs  (only if this paper will be kept safe)', g.secret.map((fd) => row(fd.label, ''))),
    )
  out.push(...gridTable('Extra details', ['Label', 'Value'], [3300, VALUE_W], 3))
  out.push(...section('Remind me', [row('Remind me before due dates', '☐ 1 week    ☐ 15 days    ☐ 1 month    ☐ 2 months')]))
  out.push(...lines('Notes', 4))
  out.push(...section('Papers kept', [row('Where the original papers are kept', ''), row('Attached copies', '☐ Front/back photo    ☐ Receipt/invoice    ☐ PDF    ☐ Other')]))
  return out
}

// --- cover ---------------------------------------------------------------------
const cover = [
  p(t('HomeVault', { size: 64, bold: true, color: MOSS }), { before: 1600 }),
  p(t('Family records · blank forms to fill by hand', { size: 30, color: INK }), { before: 80, after: 400 }),
  p(t('Filled by: ______________________________          Date: ____ / ____ / ________', { size: 21 }), { after: 300 }),
  p(t('How to use', { size: 24, bold: true }), { before: 200, after: 80 }),
  p(t('1.  One sheet per item. Photocopy a category page when you have more than one item of that kind.', { size: 20 }), { after: 60 }),
  p(t('2.  Every option the app offers is printed: tick ☐ boxes, write on the lines, leave blank what does not apply.', { size: 20 }), { after: 60 }),
  p(t('3.  Amounts and balances are for reference only. Write the date next to any balance.', { size: 20 }), { after: 60 }),
  p(t('4.  Passwords and PINs: write them only if this paper will be locked away. Otherwise leave that part blank.', { size: 20 }), { after: 60 }),
  p(t('5.  Later, type these into the HomeVault app, or use Settings → Import from Excel or CSV.', { size: 20 }), { after: 300 }),
  p(t('Contents', { size: 24, bold: true }), { before: 200, after: 80 }),
  ...CATEGORY_GROUPS.map((g) =>
    p([t(g.title + ':  ', { size: 20, bold: true, color: MOSS }), t(g.ids.map((id) => CATEGORY_BY_ID[id].name).join(' · '), { size: 20 })], { after: 80 }),
  ),
  // Page 2: people. Each category then starts on an odd page, so printed double-sided
  // every category is exactly one sheet (front and back), easy to photocopy.
  new Paragraph({ pageBreakBefore: true, children: [t('Family members', { size: 30, bold: true, color: MOSS })] }),
  p(t('Used for "Belongs to" and nominees on every form.', { size: 18, italics: true, color: MUTED }), { before: 40, after: 120 }),
  ...gridTable('', ['Name', 'Relationship', 'Date of birth', 'Mobile', 'Blood group'], [2900, 1900, 1800, 1906, 1600], 8).slice(1),
  p(t('Emergency medical notes', { size: 24, bold: true }), { before: 360, after: 80 }),
  ...gridTable('', ['Name', 'Allergies', 'Regular medicines', 'Conditions'], [2300, 2600, 2600, 2606], 5).slice(1),
  p(t('Key contacts (CA, insurance agent, bank manager, doctor, lawyer)', { size: 24, bold: true }), { before: 360, after: 80 }),
  ...gridTable('', ['Name', 'Role', 'Phone', 'Organisation'], [2600, 2200, 2306, 3000], 6).slice(1),
  p(t('Where the HomeVault recovery key is kept: ______________________________________________', { size: 20 }), { before: 360 }),
]

const children = [...cover]
for (const g of CATEGORY_GROUPS)
  for (const id of g.ids) {
    // Break before the form (not after the last one), so a full page never leaves a blank one.
    children.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 }, children: [t('', { size: 2 })] }))
    children.push(...categoryForm(id, g.title))
  }

const doc = new Document({
  creator: 'HomeVault',
  title: 'HomeVault blank forms',
  description: 'Blank forms for every HomeVault category, to fill by hand.',
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [
    {
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 900, bottom: 900, left: MARGIN, right: MARGIN } } },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [t('HomeVault blank forms · page ', { size: 15, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: MUTED })],
            }),
          ],
        }),
      },
      children,
    },
  ],
})
fs.writeFileSync(OUT, await Packer.toBuffer(doc))
console.log('written', OUT, CATEGORIES.length, 'categories')
