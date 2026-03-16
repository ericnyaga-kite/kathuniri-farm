import { Router } from 'express'
import { prisma } from '../db/client'

export const syncRouter = Router()

// POST /api/sync/upload
// Receives offline queue entries from the PWA and writes them to the database.
// Each entry has: tableName, recordId, operation, payload, createdAt
syncRouter.post('/upload', async (req, res, next) => {
  try {
    const { entries } = req.body as {
      deviceId?: string
      lastSyncAt?: string
      entries: Array<{
        tableName: string
        recordId: string
        operation: 'INSERT' | 'UPDATE' | 'DELETE'
        payload: Record<string, unknown>
        createdAt: string
      }>
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.json({ synced: 0 })
    }

    const results: { recordId: string; status: 'ok' | 'error'; error?: string }[] = []

    for (const entry of entries) {
      try {
        await applyEntry(entry)
        results.push({ recordId: entry.recordId, status: 'ok' })
      } catch (err) {
        results.push({ recordId: entry.recordId, status: 'error', error: String(err) })
      }
    }

    return res.json({
      synced: results.filter(r => r.status === 'ok').length,
      errors: results.filter(r => r.status === 'error'),
      serverTime: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/sync/download?since=ISO_TIMESTAMP
// Returns server records updated since the given timestamp.
// Used by PWA to pull changes made by the owner on the web dashboard.
syncRouter.get('/download', async (req, res, next) => {
  try {
    const since = req.query.since
      ? new Date(req.query.since as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // default: last 7 days

    const [milkProduction, pickingSessions, pickerRecords, alerts] = await Promise.all([
      prisma.milkProduction.findMany({
        where: { updatedAt: { gte: since } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
      prisma.pickingSession.findMany({
        where: { updatedAt: { gte: since } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.pickerRecord.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.alert.findMany({
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    res.json({
      serverTime: new Date().toISOString(),
      records: [
        { tableName: 'milk_production',  records: milkProduction,  deletedIds: [] },
        { tableName: 'picking_sessions', records: pickingSessions, deletedIds: [] },
        { tableName: 'picker_records',   records: pickerRecords,   deletedIds: [] },
      ],
      alerts,
      pendingParseResults: [],
    })
  } catch (err) {
    next(err)
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────

async function applyEntry(entry: {
  tableName: string
  recordId: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: Record<string, unknown>
}) {
  const { tableName, recordId, operation, payload } = entry

  switch (tableName) {
    case 'milk_production':
      await applyMilkProduction(recordId, operation, payload)
      break
    case 'picking_sessions':
      await applyPickingSession(recordId, operation, payload)
      break
    case 'picker_records':
      await applyPickerRecord(recordId, operation, payload)
      break
    default:
      throw new Error(`Unknown table: ${tableName}`)
  }
}

async function applyMilkProduction(
  id: string,
  op: string,
  p: Record<string, unknown>,
) {
  if (op === 'DELETE') {
    await prisma.milkProduction.deleteMany({ where: { id } })
    return
  }
  await prisma.milkProduction.upsert({
    where: { id },
    update: {
      litres: Number(p.litres),
      session: String(p.session),
      withdrawalActive: Boolean(p.withdrawalActive),
      saleable: Boolean(p.saleable ?? true),
      notes: p.notes ? String(p.notes) : undefined,
    },
    create: {
      id,
      productionDate: new Date(String(p.productionDate)),
      cowId: p.cowId ? String(p.cowId) : undefined,
      session: String(p.session),
      litres: Number(p.litres),
      withdrawalActive: Boolean(p.withdrawalActive),
      saleable: Boolean(p.saleable ?? true),
      source: 'manager_pwa',
    },
  })
}

async function applyPickingSession(
  id: string,
  op: string,
  p: Record<string, unknown>,
) {
  if (op === 'DELETE') {
    await prisma.pickingSession.deleteMany({ where: { id } })
    return
  }

  // centreId from the PWA is the sector's canonicalName (e.g. 'Kathuniri A').
  // Look it up to get the DB uuid.
  let centreId = String(p.centreId)
  const centre = await prisma.collectionCentre.findFirst({
    where: { canonicalName: { equals: centreId, mode: 'insensitive' } },
  })
  if (centre) centreId = centre.id

  await prisma.pickingSession.upsert({
    where: { id },
    update: {
      pickerTotalKg: p.pickerTotalKg ? Number(p.pickerTotalKg) : undefined,
      reconciliationStatus: String(p.reconciliationStatus ?? 'pending'),
    },
    create: {
      id,
      sessionDate: new Date(String(p.sessionDate)),
      centreId,
      pickerTotalKg: p.pickerTotalKg ? Number(p.pickerTotalKg) : undefined,
      reconciliationStatus: 'pending',
    },
  })
}

async function applyPickerRecord(
  id: string,
  op: string,
  p: Record<string, unknown>,
) {
  if (op === 'DELETE') {
    await prisma.pickerRecord.deleteMany({ where: { id } })
    return
  }

  // Staff: look up by name if no UUID staffId
  let staffId = String(p.staffId)
  const staffName = p.staffName ? String(p.staffName) : staffId

  // Try to find existing staff by name; create casual entry if missing
  const existing = await prisma.staff.findFirst({
    where: { fullName: { equals: staffName, mode: 'insensitive' } },
  })

  if (existing) {
    staffId = existing.id
  } else {
    const newStaff = await prisma.staff.create({
      data: {
        fullName: staffName,
        employmentType: 'casual',
        pickerRatePerKg: Number(p.ratePerKg ?? 14),
        active: true,
      },
    })
    staffId = newStaff.id
  }

  await prisma.pickerRecord.upsert({
    where: { id },
    update: {
      kgPicked: Number(p.kgPicked),
      ratePerKg: Number(p.ratePerKg),
      grossPay: Number(p.grossPay),
    },
    create: {
      id,
      sessionId: String(p.sessionId),
      staffId,
      kgPicked: Number(p.kgPicked),
      ratePerKg: Number(p.ratePerKg),
      grossPay: Number(p.grossPay),
    },
  })
}
