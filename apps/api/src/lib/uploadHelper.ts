import { prisma } from '../db/client'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// ─── R2 / S3 client (only constructed when credentials are present) ───────────

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  if (!accountId) return null
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'kathuniri-farm'

// ─── saveUpload ───────────────────────────────────────────────────────────────
//
// Accepts a data URL (data:image/jpeg;base64,...) or bare base64 string.
// If R2 is configured, decodes the base64 and uploads the buffer to R2.
// Otherwise stores the full data URL directly in `r2Key` (fallback mode).
//
// Returns { id, url } where url is a public or local access URL.

export async function saveUpload(
  dataUrl: string,
  mimeType: string,
  linkedEntityType?: string,
  linkedEntityId?: string,
  filename?: string,
): Promise<{ id: string; url: string }> {
  // Normalise: ensure we have a full data URL
  const fullDataUrl = dataUrl.startsWith('data:')
    ? dataUrl
    : `data:${mimeType};base64,${dataUrl}`

  // Strip the prefix to get the pure base64 payload
  const base64 = fullDataUrl.replace(/^data:[^;]+;base64,/, '')
  const sizeBytes = Math.round(base64.length * 0.75) // approximate decoded size

  const r2Client = getR2Client()
  const safeFilename = filename ?? `upload-${Date.now()}.jpg`

  let r2Key: string
  let publicUrl: string

  if (r2Client) {
    // ── Upload to Cloudflare R2 ───────────────────────────────────────────
    const buffer = Buffer.from(base64, 'base64')
    const key = `uploads/${Date.now()}-${safeFilename}`

    await r2Client.send(
      new PutObjectCommand({
        Bucket:      R2_BUCKET,
        Key:         key,
        Body:        buffer,
        ContentType: mimeType,
      }),
    )

    r2Key     = key
    publicUrl = `${process.env.R2_PUBLIC_URL ?? ''}/${key}`
  } else {
    // ── Fallback: store data URL directly in r2Key ────────────────────────
    r2Key = fullDataUrl
    // We'll set publicUrl after we have the DB record id
    publicUrl = '' // placeholder
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

  if (!r2Client) {
    publicUrl = `/api/uploads/${record.id}`
  }

  return { id: record.id, url: publicUrl }
}
