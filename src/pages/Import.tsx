import { CircleAlert, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Card, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { CATEGORY_BY_ID, CATEGORY_GROUPS } from '@/lib/categories'
import {
  BASE_TARGETS,
  autoMap,
  buildRow,
  downloadTemplate,
  readFile,
  targetFromKey,
  targetKey,
  undoImport,
  type Cell,
  type Target,
} from '@/lib/importer'
import { addNotification } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { newId, saveItem, updateSettings, useVault } from '@/lib/vault'

const sel = 'h-10 w-full min-w-36 rounded-lg border border-input bg-card px-2 text-sm'

export default function Import() {
  const navigate = useNavigate()
  const { settings } = useVault()
  const [catId, setCatId] = useState('')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Cell[][]>([])
  const [map, setMap] = useState<Target[]>([])
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [createPeople, setCreatePeople] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ id: string; added: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cat = catId ? CATEGORY_BY_ID[catId] : null

  const members = settings.members.map((m) => m.name)
  const results = useMemo(
    () => (cat ? rows.map((r, i) => buildRow(r, map, cat, members, i)) : []),
    [rows, map, cat, settings.members], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const withProblems = results.filter((r) => Object.keys(r.problems).length)
  const toImport = results.filter((r) => !skipped.has(r.index) && !r.problems[-1] && r.item.name.trim())
  const newPeople = [...new Set(toImport.flatMap((r) => r.newPeople))]

  const onFile = async (f: File) => {
    try {
      const data = await readFile(f)
      if (data.length < 2) return toast.error('The file needs a heading row and at least one item')
      const head = data[0].map((h) => String(h ?? '').trim())
      const body = data.slice(1).filter((r) => !String(r[0] ?? '').toLowerCase().includes('(delete this row)'))
      setFileName(f.name)
      setHeaders(head)
      setRows(body)
      setMap(autoMap(head, CATEGORY_BY_ID[catId]))
      // Rows with problems start unticked; tick one to import it without the bad values.
      const cat0 = CATEGORY_BY_ID[catId]
      const m0 = autoMap(head, cat0)
      setSkipped(
        new Set(
          body
            .map((r, i) => buildRow(r, m0, cat0, settings.members.map((x) => x.name), i))
            .filter((r) => Object.keys(r.problems).length)
            .map((r) => r.index),
        ),
      )
    } catch {
      toast.error('Could not read that file. Save it as .xlsx or .csv and try again.')
    }
  }
  const confirm = async () => {
    setBusy(true)
    const importId = newId()
    if (createPeople && newPeople.length)
      await updateSettings({
        members: [...settings.members, ...newPeople.map((name) => ({ id: newId(), name, relationship: '' }))],
      })
    let added = 0
    for (const r of toImport) {
      const item = { ...r.item, importId }
      if (!createPeople && newPeople.length) {
        item.belongsTo = item.belongsTo.filter((n) => !newPeople.includes(n))
        item.nominees = item.nominees.filter((n) => !newPeople.includes(n.name))
      }
      await saveItem(item)
      added++
    }
    const skippedCount = results.length - added
    await addNotification({
      key: `import:${importId}`,
      type: 'app',
      title: `${added} ${added === 1 ? 'item' : 'items'} added, ${skippedCount} skipped`,
      body: `Imported ${cat?.name} from ${fileName}.`,
    })
    setBusy(false)
    setDone({ id: importId, added, skipped: skippedCount })
  }

  if (done)
    return (
      <Page>
        <PageHeader title="Import finished" back="/settings" />
        <Card className="flex flex-col gap-3 p-5">
          <p className="text-[17px] font-semibold">
            {done.added} added, {done.skipped} skipped
          </p>
          <p className="text-sm text-muted-foreground">
            Now delete {fileName} from your computer. It holds your data without encryption.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button onClick={() => navigate(`/c/${catId}`)}>See {cat?.name}</Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={async () => {
                if (!window.confirm(`Undo this import? The ${done.added} items it added are removed.`)) return
                const n = await undoImport(done.id)
                toast.success(`Import undone. ${n} items removed.`)
                setDone(null)
                setRows([])
              }}
            >
              Undo import
            </Button>
          </div>
        </Card>
      </Page>
    )

  return (
    <Page wide>
      <PageHeader
        title="Import from Excel or CSV"
        back="/settings"
        subtitle="The file is read on this device only. Easiest on the laptop."
      />

      <Card className="flex flex-col gap-3 p-4">
        <span className="text-[15px] font-semibold">1. Pick a category</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_GROUPS.flatMap((g) => g.ids).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setCatId(id)
                setRows([])
                setHeaders([])
              }}
              aria-pressed={catId === id}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm font-medium',
                catId === id ? 'border-primary bg-accent text-accent-foreground' : 'bg-card',
              )}
            >
              <CategoryIcon id={id} size="sm" className="size-7 bg-transparent [&_svg]:size-4" />
              {CATEGORY_BY_ID[id].short}
            </button>
          ))}
        </div>
      </Card>

      {cat && (
        <Card className="flex flex-col gap-3 p-4">
          <span className="text-[15px] font-semibold">2. Fill a spreadsheet</span>
          <p className="text-sm text-muted-foreground">
            Download the template: one column per field and an example row. Fill it in Excel or Google Sheets, one row
            per item, and save as .xlsx or .csv. Your own sheet works too. Dates as DD/MM/YYYY; amounts with or
            without commas.
          </p>
          <Button variant="outline" className="self-start" onClick={() => downloadTemplate(cat.id)}>
            <Download /> Download the {cat.short} template
          </Button>
        </Card>
      )}

      {cat && (
        <Card className="flex flex-col gap-3 p-4">
          <span className="text-[15px] font-semibold">3. Choose the file</span>
          <Button className="self-start" onClick={() => fileRef.current?.click()}>
            <Upload /> {fileName && rows.length ? 'Choose another file' : 'Choose file'}
          </Button>
          {fileName && rows.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" /> {fileName} · {rows.length} rows
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void onFile(f)
            }}
          />
        </Card>
      )}

      {cat && rows.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <span className="text-[15px] font-semibold">4. Check the columns and rows</span>
          <p className="text-sm text-muted-foreground">
            Columns were matched by their heading. Change any that are wrong. Unmatched columns become custom fields.
            {withProblems.length > 0 &&
              ` ${withProblems.length} rows have problems, marked in red, and are left out. Tick one to import it anyway without the red values, or fix the file and choose it again.`}
          </p>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">
                    Import
                  </th>
                  {headers.map((h, col) => (
                    <th key={col} className="px-1.5 py-1.5 text-left align-bottom">
                      <div className="mb-1 truncate text-xs font-semibold text-muted-foreground" title={h}>
                        {h || `Column ${col + 1}`}
                      </div>
                      <select
                        aria-label={`Column ${h} goes to`}
                        value={targetKey(map[col] ?? { kind: 'skip' })}
                        onChange={(e) => setMap(map.map((t, i) => (i === col ? targetFromKey(e.target.value) : t)))}
                        className={sel}
                      >
                        <option value="skip">Skip</option>
                        {BASE_TARGETS.map((b) => (
                          <option key={b.kind} value={b.kind}>
                            {b.label}
                          </option>
                        ))}
                        <optgroup label={cat.name}>
                          {cat.fields.map((f) => (
                            <option key={f.key} value={`field:${f.key}`}>
                              {f.label}
                            </option>
                          ))}
                        </optgroup>
                        <option value={`custom:${h || `Column ${col + 1}`}`}>New custom field “{h || `Column ${col + 1}`}”</option>
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const off = skipped.has(r.index) || !!r.problems[-1]
                  return (
                    <tr key={r.index} className={cn(off && 'opacity-50')}>
                      <td className="sticky left-0 z-10 border-t bg-card px-2 py-1.5">
                        <input
                          type="checkbox"
                          aria-label={`Import row ${r.index + 2}`}
                          checked={!off}
                          disabled={!!r.problems[-1]}
                          onChange={() => {
                            const s = new Set(skipped)
                            if (s.has(r.index)) s.delete(r.index)
                            else s.add(r.index)
                            setSkipped(s)
                          }}
                          className="size-5 accent-[var(--primary)]"
                        />
                      </td>
                      {headers.map((_, col) => {
                        const v = rows[r.index][col]
                        const problem = r.problems[col]
                        return (
                          <td
                            key={col}
                            title={problem}
                            className={cn(
                              'max-w-56 truncate border-t px-2 py-1.5',
                              problem && 'bg-destructive/10 text-destructive',
                              map[col]?.kind === 'skip' && 'text-muted-foreground/60',
                            )}
                          >
                            {v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '')}
                            {problem && <span className="block text-[11px] font-semibold">{problem}</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {results.some((r) => r.problems[-1]) && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="size-4" /> Rows without a name can't be imported. Pick the Name column above.
            </p>
          )}
        </Card>
      )}

      {cat && rows.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <span className="text-[15px] font-semibold">5. Confirm</span>
          {newPeople.length > 0 && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={createPeople}
                onChange={(e) => setCreatePeople(e.target.checked)}
                className="mt-0.5 size-5 accent-[var(--primary)]"
              />
              <span>
                Add these new family members: <strong>{newPeople.join(', ')}</strong>
                <span className="block text-muted-foreground">If unticked, those names are left off the items.</span>
              </span>
            </label>
          )}
          <Button size="lg" disabled={busy || toImport.length === 0} onClick={confirm}>
            {busy ? 'Adding…' : `Add ${toImport.length} ${toImport.length === 1 ? 'item' : 'items'}`}
            {results.length - toImport.length > 0 ? ` · skip ${results.length - toImport.length}` : ''}
          </Button>
          <p className="text-xs text-muted-foreground">One tap undoes the whole import afterwards.</p>
        </Card>
      )}
    </Page>
  )
}
