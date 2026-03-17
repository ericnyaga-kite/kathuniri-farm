import { Router } from 'express'
import { prisma } from '../db/client'

export const plotsRouter = Router()

// GET /api/plots — all active plots with latest log date and media count
plotsRouter.get('/', async (_req, res, next) => {
  try {
    const plots = await prisma.plot.findMany({
      where: { active: true },
      orderBy: [{ plotType: 'asc' }, { canonicalName: 'asc' }],
    })

    // Fetch latest log per plot
    const plotIds = plots.map(p => p.id)

    const latestLogs = await prisma.dailyLog.findMany({
      where: { plotId: { in: plotIds } },
      orderBy: { logDate: 'desc' },
      distinct: ['plotId'],
      select: { plotId: true, logDate: true, body: true },
    })

    const mediaCounts = await Promise.all(
      plotIds.map(id =>
        prisma.plotMedia.count({ where: { plotId: id } }).then(count => ({ id, count }))
      )
    )

    const logMap   = new Map(latestLogs.map(l => [l.plotId, l]))
    const countMap = new Map(mediaCounts.map(m => [m.id, m.count]))

    res.json(plots.map(p => ({
      id:            p.id,
      canonicalName: p.canonicalName,
      plotType:      p.plotType,
      areaHa:        p.areaHa ? Number(p.areaHa) : null,
      currentCrop:   p.currentCrop,
      notes:         p.notes,
      lat:           p.lat ?? null,
      lng:           p.lng ?? null,
      latestLogDate: logMap.get(p.id)?.logDate ?? null,
      latestLogBody: logMap.get(p.id)?.body    ?? null,
      mediaCount:    countMap.get(p.id) ?? 0,
    })))
  } catch (err) {
    next(err)
  }
})

// GET /api/plots/crops — summary grouped by currentCrop
// Must be registered BEFORE /:id routes to avoid param capture
plotsRouter.get('/crops', async (_req, res, next) => {
  try {
    const plots = await prisma.plot.findMany({
      where: { active: true, currentCrop: { not: null } },
      orderBy: { canonicalName: 'asc' },
    })

    if (plots.length === 0) { res.json([]); return }

    const plotIds = plots.map(p => p.id)

    // Latest activity per plot per type — one query, JS aggregation
    const activities = await prisma.cropActivity.findMany({
      where: { plotId: { in: plotIds } },
      orderBy: { activityDate: 'desc' },
      select: { plotId: true, activityType: true, activityDate: true, notes: true },
    })

    // Keep only the most recent date per (plotId, activityType)
    const actMap = new Map<string, Record<string, { date: Date; notes: string | null }>>()
    for (const a of activities) {
      if (!actMap.has(a.plotId)) actMap.set(a.plotId, {})
      const byType = actMap.get(a.plotId)!
      if (!byType[a.activityType]) byType[a.activityType] = { date: a.activityDate, notes: a.notes }
    }

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const daysAgoFn = (d: Date) => Math.floor((today.getTime() - d.getTime()) / 86_400_000)

    const TRACKED = ['planting', 'weeding', 'fertilizing', 'spraying', 'tilling', 'harvesting']

    // Group by crop
    const cropMap = new Map<string, typeof plots>()
    for (const p of plots) {
      const crop = p.currentCrop!
      ;(cropMap.get(crop) ?? cropMap.set(crop, []).get(crop)!).push(p)
    }

    const result = Array.from(cropMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([crop, cropPlots]) => ({
        crop,
        totalAreaHa: Math.round(cropPlots.reduce((s, p) => s + (Number(p.areaHa) || 0), 0) * 100) / 100,
        plots: cropPlots.map(p => {
          const acts = actMap.get(p.id) ?? {}
          const activity: Record<string, { date: string; daysAgo: number; notes: string | null } | null> = {}
          for (const type of TRACKED) {
            const a = acts[type]
            activity[type] = a
              ? { date: a.date.toISOString().split('T')[0], daysAgo: daysAgoFn(a.date), notes: a.notes }
              : null
          }
          return {
            id: p.id, canonicalName: p.canonicalName,
            areaHa: p.areaHa ? Number(p.areaHa) : null,
            activity,
          }
        }),
      }))

    res.json(result)
  } catch (err) { next(err) }
})

// POST /api/plots — create
plotsRouter.post('/', async (req, res, next) => {
  try {
    const { canonicalName, plotType, areaHa, currentCrop, notes } = req.body as {
      canonicalName: string; plotType: string; areaHa?: number; currentCrop?: string; notes?: string
    }
    const plot = await prisma.plot.create({
      data: { canonicalName, plotType, areaHa: areaHa ?? null, currentCrop: currentCrop ?? null, notes: notes ?? null },
    })
    res.status(201).json(plot)
  } catch (err) { next(err) }
})

// PATCH /api/plots/:id
plotsRouter.patch('/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.canonicalName !== undefined) data.canonicalName = String(b.canonicalName)
    if (b.plotType      !== undefined) data.plotType      = String(b.plotType)
    if (b.currentCrop   !== undefined) data.currentCrop   = b.currentCrop ? String(b.currentCrop) : null
    if (b.notes         !== undefined) data.notes         = b.notes       ? String(b.notes)       : null
    if (b.areaHa        !== undefined) data.areaHa        = b.areaHa      ? Number(b.areaHa)      : null
    if (b.lat           !== undefined) data.lat           = b.lat         ? Number(b.lat)         : null
    if (b.lng           !== undefined) data.lng           = b.lng         ? Number(b.lng)         : null
    if (b.active        !== undefined) data.active        = Boolean(b.active)
    const plot = await prisma.plot.update({ where: { id: req.params.id }, data })
    res.json(plot)
  } catch (err) { next(err) }
})

// GET /api/plots/:id/entries — logs + media for this plot
plotsRouter.get('/:id/entries', async (req, res, next) => {
  try {
    const { id } = req.params

    const [plot, logs, media] = await Promise.all([
      prisma.plot.findUnique({ where: { id } }),
      prisma.dailyLog.findMany({
        where: { plotId: id },
        orderBy: { logDate: 'desc' },
        take: 50,
      }),
      prisma.plotMedia.findMany({
        where: { plotId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, logId: true, mimeType: true, note: true, createdAt: true },
        // exclude dataUrl from list — fetch individually by id to save bandwidth
      }),
    ])

    if (!plot) { res.status(404).json({ error: 'Plot not found' }); return }

    res.json({ plot, logs, media })
  } catch (err) { next(err) }
})

// POST /api/plots/:id/entries — add log entry + optional image
// Body: { logDate, category?, title?, body, imageDataUrl? (base64 JPEG), note? }
plotsRouter.post('/:id/entries', async (req, res, next) => {
  try {
    const { id } = req.params
    const { logDate, category, title, body, imageDataUrl, note, createdBy } = req.body as {
      logDate:        string
      category?:      string
      title?:         string
      body:           string
      imageDataUrl?:  string   // base64 data URL — images only; must be < 2MB
      note?:          string
      createdBy?:     string
    }

    if (!body?.trim()) {
      res.status(400).json({ error: 'body is required' })
      return
    }

    if (imageDataUrl && imageDataUrl.length > 2_500_000) {
      res.status(413).json({ error: 'Image too large — compress before uploading (max ~2MB base64)' })
      return
    }

    const log = await prisma.dailyLog.create({
      data: {
        logDate:   new Date(logDate),
        category:  category ?? 'crops',
        plotId:    id,
        title:     title?.trim()     || null,
        body:      body.trim(),
        createdBy: createdBy ?? 'manager',
      },
    })

    let media: object | null = null
    if (imageDataUrl?.trim()) {
      media = await prisma.plotMedia.create({
        data: {
          plotId:    id,
          logId:     log.id,
          dataUrl:   imageDataUrl,
          mimeType:  'image/jpeg',
          note:      note?.trim() || null,
          createdBy: createdBy ?? 'manager',
        },
      })
    }

    res.status(201).json({ log, media })
  } catch (err) { next(err) }
})

// GET /api/plots/:id/activities
plotsRouter.get('/:id/activities', async (req, res, next) => {
  try {
    const activities = await prisma.cropActivity.findMany({
      where: { plotId: req.params.id },
      orderBy: { activityDate: 'desc' },
      take: 100,
    })
    res.json(activities)
  } catch (err) { next(err) }
})

// POST /api/plots/:id/activities
// Body: { activityDate, activityType, crop?, notes?, labourDays? }
// If activityType === 'planting' and crop is provided, also updates plot.currentCrop
plotsRouter.post('/:id/activities', async (req, res, next) => {
  try {
    const { id } = req.params
    const { activityDate, activityType, crop, notes, labourDays } = req.body as {
      activityDate: string; activityType: string; crop?: string
      notes?: string; labourDays?: number
    }

    if (!activityDate || !activityType) {
      res.status(400).json({ error: 'activityDate and activityType required' }); return
    }

    const activity = await prisma.cropActivity.create({
      data: {
        plotId:           id,
        activityDate:     new Date(activityDate),
        activityType,
        crop:             crop?.trim()  || null,
        notes:            notes?.trim() || null,
        labourDays:       labourDays    ?? null,
        completionStatus: 'done',
      },
    })

    // If planting a new crop, update the plot's currentCrop
    if (activityType === 'planting' && crop?.trim()) {
      await prisma.plot.update({
        where: { id },
        data: { currentCrop: crop.trim() },
      })
    }

    res.status(201).json(activity)
  } catch (err) { next(err) }
})

// GET /api/plots/:id/media/:mediaId — full base64 for a single image
plotsRouter.get('/:id/media/:mediaId', async (req, res, next) => {
  try {
    const item = await prisma.plotMedia.findFirst({
      where: { id: req.params.mediaId, plotId: req.params.id },
    })
    if (!item) { res.status(404).json({ error: 'Not found' }); return }
    res.json(item)
  } catch (err) { next(err) }
})
