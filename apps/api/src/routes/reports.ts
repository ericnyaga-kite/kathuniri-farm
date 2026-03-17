import { Router } from 'express'
import { prisma } from '../db/client'

export const reportsRouter = Router()

// GET /api/reports/daily?date=2026-03-16
// Returns all DailyLog entries for a given date, with plot info and media metadata
reportsRouter.get('/daily', async (req, res, next) => {
  try {
    const dateStr = req.query.date as string | undefined
    const d = dateStr ? new Date(dateStr) : new Date()
    d.setHours(0, 0, 0, 0)
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999)

    const logs = await prisma.dailyLog.findMany({
      where: { logDate: { gte: d, lte: dayEnd } },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    })

    if (logs.length === 0) { res.json({ date: d.toISOString().split('T')[0], entries: [] }); return }

    // Fetch plots referenced
    const plotIds = [...new Set(logs.map(l => l.plotId).filter(Boolean) as string[])]
    const plots = plotIds.length
      ? await prisma.plot.findMany({ where: { id: { in: plotIds } }, select: { id: true, canonicalName: true, plotType: true } })
      : []
    const plotMap = new Map(plots.map(p => [p.id, p]))

    // Fetch media for all logs
    const logIds = logs.map(l => l.id)
    const media = await prisma.plotMedia.findMany({
      where: { logId: { in: logIds } },
      select: { id: true, logId: true, mimeType: true, note: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    const mediaByLog = media.reduce<Record<string, typeof media>>((acc, m) => {
      if (m.logId) (acc[m.logId] ??= []).push(m)
      return acc
    }, {})

    res.json({
      date: d.toISOString().split('T')[0],
      entries: logs.map(l => ({
        id:        l.id,
        logDate:   l.logDate,
        category:  l.category,
        title:     l.title,
        body:      l.body,
        createdBy: l.createdBy,
        plot:      l.plotId ? (plotMap.get(l.plotId) ?? null) : null,
        media:     mediaByLog[l.id] ?? [],
      })),
    })
  } catch (err) { next(err) }
})
