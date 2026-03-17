import { Router } from 'express'
import { prisma } from '../db/client'
import { saveUpload } from '../lib/uploadHelper'

export const logsRouter = Router()

// GET /api/logs?date=YYYY-MM-DD&category=
logsRouter.get('/', async (req, res, next) => {
  try {
    const { date, category } = req.query as Record<string, string | undefined>

    const where: Record<string, unknown> = {}

    if (date) {
      const d = new Date(date)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)
      where.logDate = { gte: d, lte: dayEnd }
    }
    if (category) {
      where.category = category
    }

    const logs = await prisma.dailyLog.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    res.json(logs)
  } catch (err) {
    next(err)
  }
})

// POST /api/logs
// Body: { logDate, category, title?, body, photoId?, createdBy? }
logsRouter.post('/', async (req, res, next) => {
  try {
    const { logDate, category, title, body, photoId, createdBy } = req.body as {
      logDate:    string
      category:   string
      title?:     string
      body:       string
      photoId?:   string
      createdBy?: string
    }

    if (!logDate || !category || !body?.trim()) {
      res.status(400).json({ error: 'logDate, category, and body are required' })
      return
    }

    const log = await prisma.dailyLog.create({
      data: {
        logDate:   new Date(logDate),
        category,
        title:     title?.trim() || null,
        body:      body.trim(),
        photoId:   photoId ?? null,
        createdBy: createdBy ?? 'manager',
      },
    })

    res.status(201).json(log)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/logs/:id
logsRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.dailyLog.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/logs/:id/photo ─────────────────────────────────────────────────
// Body: { dataUrl: string, mimeType: string }
// Saves the image via saveUpload helper, then links it to the daily log.
// Returns the updated log record.

logsRouter.post('/:id/photo', async (req, res, next) => {
  try {
    const { dataUrl, mimeType } = req.body as {
      dataUrl:  string
      mimeType: string
    }

    if (!dataUrl || !mimeType) {
      res.status(400).json({ error: 'dataUrl and mimeType are required' })
      return
    }

    const upload = await saveUpload(
      dataUrl,
      mimeType,
      'DailyLog',
      req.params.id,
    )

    const log = await prisma.dailyLog.update({
      where: { id: req.params.id },
      data:  { photoId: upload.id },
    })

    res.json({ ...log, photoUrl: upload.url })
  } catch (err) {
    next(err)
  }
})
