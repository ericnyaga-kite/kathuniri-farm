/**
 * Compress an image File to a base64 JPEG data URL.
 * Resizes so the longest side is at most maxPx, then encodes at the given quality.
 * Typical output: 50–150 KB base64 for a phone photo.
 */
export async function compressImage(
  file: File,
  maxPx = 1200,
  quality = 0.78,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = e => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let w = img.width
        let h = img.height
        if (w > h) {
          if (w > maxPx) { h = Math.round(h * maxPx / w); w = maxPx }
        } else {
          if (h > maxPx) { w = Math.round(w * maxPx / h); h = maxPx }
        }
        const canvas = document.createElement('canvas')
        canvas.width  = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** Returns a human-readable size string for a base64 data URL */
export function base64SizeLabel(dataUrl: string): string {
  const bytes = Math.round((dataUrl.length * 3) / 4)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}
