// Photos are shrunk on the device before they are encrypted, so backup stays fast.

export const MAX_BYTES = 10 * 1024 * 1024
const MAX_SIDE = 1800
const TARGET = 500 * 1024

export function isImage(type: string) {
  return type.startsWith('image/')
}

/** Resize and re-encode a photo as JPEG (about 300–500 KB). Other files pass through. */
export async function prepareFile(file: File): Promise<{ bytes: ArrayBuffer; type: string; name: string }> {
  if (!isImage(file.type) || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return { bytes: await file.arrayBuffer(), type: file.type || 'application/octet-stream', name: file.name }
  }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= TARGET && file.type === 'image/jpeg') {
      bitmap.close()
      return { bytes: await file.arrayBuffer(), type: file.type, name: file.name }
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    let quality = 0.82
    let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
    while (blob && blob.size > TARGET && quality > 0.5) {
      quality -= 0.1
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
    }
    if (!blob) throw new Error('encode failed')
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return { bytes: await blob.arrayBuffer(), type: 'image/jpeg', name }
  } catch {
    // Could not decode (e.g. an unusual format): keep the original.
    return { bytes: await file.arrayBuffer(), type: file.type, name: file.name }
  }
}

export function sizeText(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
