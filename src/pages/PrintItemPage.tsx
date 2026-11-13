import { Printer } from 'lucide-react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Page } from '@/components/AppShell'
import { PageHeader } from '@/components/common'
import { PageStyle, PrintItem } from '@/components/PrintDoc'
import { Button } from '@/components/ui/button'
import { getCategory, itemPath } from '@/lib/categories'
import { printedOn, type SecretMode } from '@/lib/printing'
import { useVault } from '@/lib/vault'

/** One item on one page: used for "Share as PDF" and "Print". */
export default function PrintItemPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { items } = useVault()
  const item = items.find((i) => i.id === id && !i.deletedAt)
  if (!item) return <Navigate to="/" replace />
  const m = params.get('mode')
  const mode: SecretMode = m === 'shown' || m === 'omit' ? m : 'hidden'
  return (
    <Page>
      <PageStyle />
      <PageHeader
        title="Print one item"
        back={itemPath(item)}
        subtitle="Choose “Save as PDF” in the print window to get a file you can share."
      />
      <Button size="lg" onClick={() => window.print()}>
        <Printer /> Print or save as PDF
      </Button>
      <article className="print-doc" aria-label="Preview">
        <p className="pd-meta">
          HomeVault · {getCategory(item.category).name} · printed on {printedOn()}
        </p>
        <div style={{ marginTop: '8pt' }}>
          <PrintItem item={item} mode={mode} />
        </div>
      </article>
    </Page>
  )
}
