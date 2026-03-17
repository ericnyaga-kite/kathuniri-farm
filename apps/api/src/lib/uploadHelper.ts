import { prisma } from '../db/client'

// ─── saveUpload ───────────────────────────────────────────────────────────────
//
// Accepts a data URL (data:image/jpeg;base64,...) or bare base64 string.
// If R2_WORKER_URL is configured, PUTs the image to the Cloudflare Worker
// which stores it in R2. Otherwise stores the data URL directly as fallback.
//
// Returns { id, url } where url is a publicly accessible image URL.

export async function saveUpload(
  dataUrl: string,
  mimeType: string,
  linkedEntityType?: string,
  linkedEntityId?: string,
  filename?: string,
): Promise<{ id: string; url: string }> {
  const fullDataUrl = dataUrl.startsWith('data:')
    ? dataUrl
    : `data:${mimeType};base64,${dataUrl}`

  const base64 = fullDataUrl.replace(/^data:[^;]+;base64,/, '')
  const sizeBytes = Math.round(base64.length * 0.75)

  const safeFilename = filename ?? `upload-${Date.now()}.jpg`
  const workerUrl = process.env.R2_WORKER_URL ?? ''
  const uploadSecret = process.env.R2_UPLOAD_SECRET ?? ''

  let r2Key: string
  let publicUrl: string

  if (workerUrl) {
    // ── Upload to Cloudflare Worker → R2 ─────────────────────────────────
    const buffer = Buffer.from(base64, 'base64')
    const key = `uploads/${Date.now()}-${safeFilename}`

    const res = await fetch(`${workerUrl}/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'X-Upload-Secret': uploadSecret,
      },
      body: buffer,
    })

    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`)

    r2Key     = key
    publicUrl = `${workerUrl}/${key}`
  } else {
    // ── Fallback: store data URL in DB ────────────────────────────────────
    r2Key     = fullDataUrl
    publicUrl = '' // filled in after DB insert
  }

  const record = await prisma.fileUpload.create({
    data: {
      filename:         safeFilename,
      r2Key,
      mimeType,
      sizeBytes,
      linkedEntityType: linkedEntityType ?? null,
      linkedEntityId:   linkedEntityId   ?? null,
      uploadedBy:       'manager',
    },
  })

  if (!workerUrl) {
    publicUrl = `/api/uploads/${record.id}`
  }

  return { id: record.id, url: publicUrl }
}
