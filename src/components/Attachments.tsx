import { Camera, Download, FileText, Paperclip, Share2, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { MAX_BYTES, isImage, prepareFile, sizeText } from '@/lib/images'
import { fetchAttachment } from '@/lib/sync'
import type { Attachment } from '@/lib/types'
import { cn } from '@/lib/utils'
import { putAttachmentBytes, readAttachment } from '@/lib/vault'

/** Decrypt an attachment into a blob URL; fetch it from Drive first if this device lacks it. */
function useAttachmentUrl(a: Attachment | null) {
  const [state, setState] = useState<{ url?: string; blob?: Blob; missing?: boolean }>({})
  useEffect(() => {
    if (!a) return
    let url: string | undefined
    let cancelled = false
    ;(async () => {
      let blob = await readAttachment(a.id, a.type).catch(() => null)
      if (!blob && (await fetchAttachment(a.id).catch(() => false))) blob = await readAttachment(a.id, a.type).catch(() => null)
      if (cancelled) return
      if (!blob) return setState({ missing: true })
      url = URL.createObjectURL(blob)
      setState({ url, blob })
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [a])
  return state
}

function Thumb({ a, onOpen, onRemove }: { a: Attachment; onOpen?: () => void; onRemove?: () => void }) {
  const { url, missing } = useAttachmentUrl(isImage(a.type) ? a : null)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-24 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border bg-muted text-center"
        aria-label={`Open ${a.name}`}
      >
        {isImage(a.type) && url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <>
            <FileText className="size-7 text-muted-foreground" />
            <span className="line-clamp-2 px-2 text-[11px] leading-tight text-muted-foreground">
              {missing ? 'Not on this device yet' : a.name}
            </span>
          </>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${a.name}`}
          className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full border bg-card shadow-sm"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Full-screen view with download and share. */
function Viewer({ a, onClose }: { a: Attachment | null; onClose: () => void }) {
  const { url, blob, missing } = useAttachmentUrl(a)
  const save = () => {
    if (!url || !a) return
    const link = document.createElement('a')
    link.href = url
    link.download = a.name
    link.click()
  }
  const share = async () => {
    if (!blob || !a) return
    const file = new File([blob], a.name, { type: a.type })
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: a.name }).catch(() => {})
    else save()
  }
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95dvh] max-w-[min(96vw,900px)] gap-3 overflow-y-auto p-3 sm:max-w-[min(96vw,900px)]">
        <DialogTitle className="truncate pr-8 text-base">{a?.name}</DialogTitle>
        {missing ? (
          <p className="text-sm text-muted-foreground">
            This file is not on this device yet. Connect Google Drive and sign in to fetch it.
          </p>
        ) : !url ? (
          <p className="text-sm text-muted-foreground">Opening…</p>
        ) : a && isImage(a.type) ? (
          <div className="overflow-auto rounded-lg bg-black/90" style={{ touchAction: 'pinch-zoom' }}>
            <img src={url} alt={a.name} className="mx-auto max-h-[75dvh] w-auto" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <FileText className="size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {a ? sizeText(a.size) : ''}. Open it with Download, or send it with Share.
            </p>
            <Button variant="outline" onClick={() => url && window.open(url, '_blank')}>
              Open in a new tab
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" disabled={!url} onClick={save}>
            <Download /> Download
          </Button>
          <Button variant="outline" disabled={!blob} onClick={share}>
            <Share2 /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** On the add/edit form: take a photo, choose files, or drop them (laptop). */
export function AttachmentsEditor({ value, onChange }: { value: Attachment[]; onChange: (v: Attachment[]) => void }) {
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [open, setOpen] = useState<Attachment | null>(null)

  const add = async (files: FileList | File[]) => {
    setBusy(true)
    const added: Attachment[] = []
    for (const f of Array.from(files)) {
      if (!isImage(f.type) && f.type !== 'application/pdf') {
        toast.error(`${f.name}: only photos and PDFs`)
        continue
      }
      if (f.size > MAX_BYTES && !isImage(f.type)) {
        toast.error(`${f.name} is over 10 MB`)
        continue
      }
      const p = await prepareFile(f)
      if (p.bytes.byteLength > MAX_BYTES) {
        toast.error(`${f.name} is over 10 MB`)
        continue
      }
      const id = await putAttachmentBytes(p.bytes)
      added.push({ id, name: p.name, type: p.type, size: p.bytes.byteLength, addedAt: Date.now() })
    }
    onChange([...value, ...added])
    setBusy(false)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (e.dataTransfer.files.length) void add(e.dataTransfer.files)
      }}
      className={cn('flex flex-col gap-3 rounded-xl', drag && 'ring-2 ring-primary ring-offset-4 ring-offset-card')}
    >
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {value.map((a) => (
            <Thumb key={a.id} a={a} onOpen={() => setOpen(a)} onRemove={() => onChange(value.filter((x) => x.id !== a.id))} />
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => camRef.current?.click()} className="border-dashed">
          <Camera /> Take photo
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="border-dashed">
          <Paperclip /> {busy ? 'Adding…' : 'Choose file'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Photos or PDFs, up to 10 MB. Photos are made smaller automatically. Everything is encrypted. On a laptop you can
        drop files here.
      </p>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
        if (e.target.files?.length) void add(e.target.files)
        e.target.value = ''
      }} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => {
        if (e.target.files?.length) void add(e.target.files)
        e.target.value = ''
      }} />
      <Viewer a={open} onClose={() => setOpen(null)} />
    </div>
  )
}

/** On the item page: thumbnails that open full screen. */
export function AttachmentsView({ value, onRemove }: { value: Attachment[]; onRemove?: (id: string) => void }) {
  const [open, setOpen] = useState<Attachment | null>(null)
  if (!value.length) return null
  return (
    <Card className="flex flex-col gap-3 p-4">
      <span className="text-[15px] font-semibold">Attachments · {value.length}</span>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {value.map((a) => (
          <Thumb key={a.id} a={a} onOpen={() => setOpen(a)} />
        ))}
      </div>
      {onRemove && open && (
        <Button variant="ghost" className="text-destructive" onClick={() => onRemove(open.id)}>
          <Trash2 /> Remove
        </Button>
      )}
      <Viewer a={open} onClose={() => setOpen(null)} />
    </Card>
  )
}
