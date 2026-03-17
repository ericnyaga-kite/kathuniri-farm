import { Router } from 'express'
import { prisma } from '../db/client'

export const summaryRouter = Router()

// GET /api/summary/today
// Returns a consolidated snapshot for the manager's daily dashboard.
summaryRouter.get('/today', async (req, res, next) => {
  try {
    const dateParam  = req.query.date ? String(req.query.date) : null
    const baseDate   = dateParam ? new Date(dateParam) : new Date()
    const todayStart = new Date(baseDate)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(baseDate)
    todayEnd.setHours(23, 59, 59, 999)

    const month = baseDate.getMonth() + 1
    const year  = baseDate.getFullYear()

    // ── Tea ──────────────────────────────────────────────────────────────────
    // Only look for a delivery dated TODAY — never show stale data
    const todayDeliveries = await prisma.teaSmsDelivery.findMany({
      where: { deliveryDate: { gte: todayStart, lte: todayEnd } },
      include: { allocations: true },
    })

    const todayTeaKg = todayDeliveries.length > 0
      ? todayDeliveries.reduce(
          (sum, d) => sum + d.allocations.reduce((s, a) => s + Number(a.kgAllocated), 0),
          0
        )
      : null

    // Also fetch the most recent delivery (any date) so UI can show "last SMS was X days ago"
    const lastDelivery = await prisma.teaSmsDelivery.findFirst({
      orderBy: { deliveryDate: 'desc' },
      select: { deliveryDate: true, smsRecord: { select: { source: true } } },
    })

    // ── Milk ─────────────────────────────────────────────────────────────────
    // All active cows
    const cows = await prisma.cow.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, tagNumber: true, status: true },
    })

    // Today's production records
    const todayProduction = await prisma.milkProduction.findMany({
      where: { productionDate: { gte: todayStart, lte: todayEnd } },
    })

    const milkByCow = new Map<string, number>()
    let totalMilkToday = 0
    for (const r of todayProduction) {
      const litres = Number(r.litres)
      totalMilkToday += litres
      if (r.cowId) {
        milkByCow.set(r.cowId, (milkByCow.get(r.cowId) ?? 0) + litres)
      }
    }

    // ── Health alerts ─────────────────────────────────────────────────────────
    // Active withdrawal periods ending in the future
    const activeWithdrawals = await prisma.treatment.findMany({
      where: { withdrawalEndsDate: { gte: todayStart } },
      include: {
        healthEvent: {
          select: { cowId: true, cow: { select: { name: true, tagNumber: true } } },
        },
      },
      orderBy: { withdrawalEndsDate: 'asc' },
    })

    // Health events in the last 7 days
    const sevenDaysAgo = new Date(todayStart)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const recentHealthEvents = await prisma.healthEvent.findMany({
      where: { eventDate: { gte: sevenDaysAgo } },
      orderBy: { eventDate: 'desc' },
      take: 5,
      include: { cow: { select: { name: true } } },
    })

    // ── Rental ───────────────────────────────────────────────────────────────
    const rooms = await prisma.rentalRoom.findMany({
      where: { active: true, occupancyStatus: 'occupied' },
      orderBy: { roomNumber: 'asc' },
    })

    const thisMonthPayments = await prisma.rentPayment.findMany({
      where: { periodYear: year, periodMonth: month },
      select: { roomId: true },
    })

    const paidRoomIds = new Set(thisMonthPayments.map(p => p.roomId))
    const roomStatus = rooms.map(r => ({
      id:          r.id,
      roomNumber:  r.roomNumber,
      tenantName:  r.tenantName,
      paidThisMonth: paidRoomIds.has(r.id),
    }))

    // ── Electricity ───────────────────────────────────────────────────────────
    // Rooms without an electricity reading this month
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd   = new Date(year, month, 0, 23, 59, 59)
    const readingsThisMonth = await prisma.electricityReading.findMany({
      where: { readingDate: { gte: monthStart, lte: monthEnd } },
      select: { roomId: true },
    })
    const readingRoomIds = new Set(readingsThisMonth.map(r => r.roomId))
    const roomsNeedingReading = rooms
      .filter(r => !readingRoomIds.has(r.id))
      .map(r => ({ id: r.id, roomNumber: r.roomNumber, tenantName: r.tenantName }))

    // ── Today's daily logs ────────────────────────────────────────────────────
    const todayLogs = await prisma.dailyLog.findMany({
      where: { logDate: { gte: todayStart, lte: todayEnd } },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      date: todayStart.toISOString().split('T')[0],

      tea: {
        totalKgToday:      todayTeaKg !== null ? Math.round(todayTeaKg * 10) / 10 : null,
        lastDeliveryDate:  lastDelivery?.deliveryDate ?? null,
        lastDeliverySource: lastDelivery?.smsRecord?.source ?? null,
      },

      milk: {
        totalLitresToday: Math.round(totalMilkToday * 10) / 10,
        cows: cows.map(c => ({
          id:        c.id,
          name:      c.name,
          tagNumber: c.tagNumber,
          status:    c.status,
          litresToday: Math.round((milkByCow.get(c.id) ?? 0) * 10) / 10,
        })),
      },

      healthAlerts: {
        activeWithdrawals: activeWithdrawals.map(t => ({
          drugName:           t.drugName,
          withdrawalEndsDate: t.withdrawalEndsDate,
          cowName: t.healthEvent.cow?.name ?? 'Unknown',
        })),
        recentEvents: recentHealthEvents.map(e => ({
          id:           e.id,
          eventDate:    e.eventDate,
          eventType:    e.eventType,
          conditionName: e.conditionName,
          cowName:      e.cow.name,
        })),
      },

      rental: {
        totalOccupied:    rooms.length,
        paidCount:        paidRoomIds.size,
        unpaidCount:      rooms.length - paidRoomIds.size,
        rooms:            roomStatus,
        needingReading:   roomsNeedingReading,
      },

      logs: todayLogs,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/summary/active-days?year=YYYY&month=M
// Returns an array of day-of-month numbers (1–31) that have at least one
// milk production record, tea delivery, daily log, or rent payment.
// Used by the calendar to show dot indicators.
summaryRouter.get('/active-days', async (req, res, next) => {
  try {
    const now   = new Date()
    const year  = req.query.year  ? parseInt(String(req.query.year))  : now.getFullYear()
    const month = req.query.month ? parseInt(String(req.query.month)) : now.getMonth() + 1

    const start = new Date(year, month - 1, 1)
    const end   = new Date(year, month,     0, 23, 59, 59)

    const [milkDays, teaDays, logDays, rentDays] = await Promise.all([
      prisma.milkProduction.findMany({
        where:  { productionDate: { gte: start, lte: end } },
        select: { productionDate: true },
        distinct: ['productionDate'],
      }),
      prisma.teaSmsDelivery.findMany({
        where:  { deliveryDate: { gte: start, lte: end } },
        select: { deliveryDate: true },
        distinct: ['deliveryDate'],
      }),
      prisma.dailyLog.findMany({
        where:  { logDate: { gte: start, lte: end } },
        select: { logDate: true },
        distinct: ['logDate'],
      }),
      prisma.rentPayment.findMany({
        where:  { paymentDate: { gte: start, lte: end } },
        select: { paymentDate: true },
        distinct: ['paymentDate'],
      }),
    ])

    const days = new Set<number>()
    for (const r of milkDays) days.add(new Date(r.productionDate).getDate())
    for (const r of teaDays)  days.add(new Date(r.deliveryDate).getDate())
    for (const r of logDays)  days.add(new Date(r.logDate).getDate())
    for (const r of rentDays) days.add(new Date(r.paymentDate).getDate())

    res.json({ year, month, activeDays: Array.from(days).sort((a, b) => a - b) })
  } catch (err) {
    next(err)
  }
})
