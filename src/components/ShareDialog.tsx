import { FileText, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { SecretModePicker } from '@/components/PrintDoc'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { itemAsText, type SecretMode } from '@/lib/printing'
import { copyText } from '@/lib/secure-ui'
import type { Item } from '@/lib/types'

/** Share one item as text (WhatsApp or any app) or as a one-page PDF. Only this item leaves the app. */
export function ShareDialog({ item, open, onClose }: { item: Item; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<SecretMode>('hidden')

  const asText = async () => {
    const text = itemAsText(item, mode)
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text })
        onClose()
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    if (await copyText(text, mode === 'shown')) {
      toast.success('Copied. Paste it into WhatsApp or any app.')
      onClose()
    } else toast.error('Could not share or copy')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share “{item.name}”</DialogTitle>
          <DialogDescription>Only this one item is shared. Nothing else leaves the app.</DialogDescription>
        </DialogHeader>
        <SecretModePicker value={mode} onChange={setMode} />
        <Button size="lg" onClick={asText}>
          <MessageSquareText /> As text (WhatsApp, Messages…)
        </Button>
        <Button size="lg" variant="outline" onClick={() => navigate(`/print/item/${item.id}?mode=${mode}`)}>
          <FileText /> As PDF
        </Button>
      </DialogContent>
    </Dialog>
  )
}
