import { Copy, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/secure-ui'

/** Shows the recovery key with Print and Copy, plus a print-only page. */
export function RecoveryKeyCard({ recoveryKey }: { recoveryKey: string }) {
  const groups = recoveryKey.split('-')
  const lines = [groups.slice(0, 4).join('-'), groups.slice(4).join('-')]
  const printed = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <>
      <div className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-muted-foreground/50 bg-card p-5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">RECOVERY KEY</p>
        <p className="font-mono text-[19px] leading-relaxed tracking-wider select-all">
          {lines[0]}
          <br />
          {lines[1]}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> Print or save PDF
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            if (await copyText(recoveryKey, true)) toast.success('Copied. Clears from clipboard in 30 seconds')
          }}
        >
          <Copy /> Copy
        </Button>
      </div>
      {/* Only visible when printing */}
      <div className="print-only">
        <h1>HomeVault recovery key</h1>
        <p className="key">{recoveryKey}</p>
        <p>Printed {printed}.</p>
        <p>
          This key opens your HomeVault if the master password is forgotten. Keep it with your important papers, away
          from the phone and laptop. Anyone with this key and your device can read the vault.
        </p>
      </div>
    </>
  )
}
