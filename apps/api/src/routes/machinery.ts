import { Router } from 'express'
import { prisma } from '../db/client'

export const machineryRouter = Router()

// GET /api/machinery
machineryRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.machinery.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        repairLogs: {
          orderBy: { logDate: 'desc' },
          take: 1,
        },
      },
    })
    res.json(items)
  } catch (err) {
    next(err)
  }
})

// POST /api/machinery
machineryRouter.post('/', async (req, res, next) => {
  try {
    const { name, serialNumber, purchaseDate, status, notes } = req.body as {
      name:          string
      serialNumber?: string
      purchaseDate?: string
      status?:       string
      notes?:        string
    }

    const item = await prisma.machinery.create({
      data: {
        name,
        serialNumber: serialNumber ?? null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        status:       status ?? 'operational',
        notes:        notes ?? null,
      },
    })
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/machinery/:id
machineryRouter.patch('/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.name         !== undefined) data.name         = String(b.name)
    if (b.serialNumber !== undefined) data.serialNumber = b.serialNumber ? String(b.serialNumber) : null
    if (b.purchaseDate !== undefined) data.purchaseDate = b.purchaseDate ? new Date(String(b.purchaseDate)) : null
    if (b.status       !== undefined) data.status       = String(b.status)
    if (b.notes        !== undefined) data.notes        = b.notes ? String(b.notes) : null
    if (b.active       !== undefined) data.active       = Boolean(b.active)

    const item = await prisma.machinery.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// GET /api/machinery/:id/logs
machineryRouter.get('/:id/logs', async (req, res, next) => {
  try {
    const logs = await prisma.machineryLog.findMany({
      where: { machineryId: req.params.id },
      orderBy: { logDate: 'desc' },
    })
    res.json(logs)
  } catch (err) {
    next(err)
  }
})

// POST /api/machinery/:id/logs
machineryRouter.post('/:id/logs', async (req, res, next) => {
  try {
    const { logDate, logType, description, costKes } = req.body as {
      logDate:     string
      logType:     string
      description: string
      costKes?:    number
    }

    const log = await prisma.machineryLog.create({
      data: {
        machineryId: req.params.id,
        logDate:     new Date(logDate),
        logType,
        description,
        costKes:     costKes ?? null,
      },
    })
    res.status(201).json(log)
  } catch (err) {
    next(err)
  }
})
