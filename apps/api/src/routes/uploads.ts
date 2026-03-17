import { Router } from 'express'
import { prisma } from '../db/client'
import { saveUpload } from '../lib/uploadHelper'

export const uploadsRouter = Router()

// ─── POST /api/uploads ────────────────────────────────────────────────────────
// Body: { dataUrl, mimeType, linkedEntityType?, linkedEntityId?, filename? }
// Returns: { id, url }

uploadsRouter.post('/', async (req, res, next) => {
  try {
    const { dataUrl, mimeType, linkedEntityType, linkedEntityId, filename } =
      req.body as {
        dataUrl:           string
        mimeType:          string
        linkedEntityType?: string
        linkedEntityId?:   string
        filename?:         string
      }

    if (!dataUrl || !mimeType) {
      res.status(400).json({ error: 'dataUrl and mimeType are required' })
      return
    }

    const result = await saveUpload(
      dataUrl,
      mimeType,
      linkedEntityType,
      linkedEntityId,
      filename,
    )

    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/uploads/:id ─────────────────────────────────────────────────────
// If r2Key starts with 'data:' → serve image bytes from the stored data URL.
// Otherwise → redirect to R2 public URL.

uploadsRouter.get('/:id', async (req, res, next) => {
  try {
    const record = await prisma.fileUpload.findUnique({
      where: { id: req.params.id },
    })

    if (!record) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    if (record.r2Key.startsWith('data:')) {
      // Fallback mode: serve from stored data URL
      const dataUrl   = record.r2Key
      const base64    = dataUrl.replace(/^data:[^;]+;base64,/, '')
      const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/)
      const mimeType  = mimeMatch ? mimeMatch[1] : record.mimeType

      const buffer = Buffer.from(base64, 'base64')
      res.setHeader('Content-Type', mimeType)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.send(buffer)
    } else {
      // R2 mode: redirect to public URL
      const publicUrl = `${process.env.R2_PUBLIC_URL ?? ''}/${record.r2Key}`
      res.redirect(302, publicUrl)
    }
  } catch (err) {
    next(err)
  }
})
