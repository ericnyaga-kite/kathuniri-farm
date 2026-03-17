import { Router } from 'express'
import { prisma } from '../db/client'

export const rentalRouter = Router()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * How many full calendar months have elapsed since lastPaymentDate with no
 * payment recorded for the current month.  Returns 0 if a payment exists for
 * the current month, capped at 12.
 */
function computeOutstandingMonths(
  lastPaymentDate: Date | null,
  referenceNow: Date,
): number {
  if (!lastPaymentDate) return 12

  const refYear  = referenceNow.getFullYear()
  const refMonth = referenceNow.getMonth() // 0-based

  const payYear  = lastPaymentDate.getFullYear()
  const payMonth = lastPaymentDate.getMonth() // 0-based

  // If the last payment was for the current calendar month, nothing is due yet
  if (payYear === refYear && payMonth === refMonth) return 0

  const months = (refYear - payYear) * 12 + (refMonth - payMonth)
  return Math.min(months, 12)
}

// ---------------------------------------------------------------------------
// GET /api/rental/rooms?year=YYYY&month=M
// Returns all rooms. currentMonthPayment is for the requested period (defaults
// to current month). outstandingMonths is computed from the most recent payment.
// ---------------------------------------------------------------------------
rentalRouter.get('/rooms', async (req, res, next) => {
  try {
    const now   = new Date()
    const year  = req.query.year  ? parseInt(req.query.year  as string) : now.getFullYear()
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1

    const rooms = await prisma.rentalRoom.findMany({
      where: { active: true },
      orderBy: { roomNumber: 'asc' },
      include: {
        electricityReadings: {
          orderBy: { readingDate: 'desc' },
          take: 1,
        },
        rentPayments: {
          where: { periodYear: year, periodMonth: month },
          orderBy: { paymentDate: 'asc' },
        },
      },
    })

    // Fetch the single most-recent payment per room (for outstanding months calc)
    const latestPayments = await prisma.rentPayment.findMany({
      where: { roomId: { in: rooms.map(r => r.id) } },
      orderBy: { paymentDate: 'desc' },
      distinct: ['roomId'],
    })
    const latestByRoom = new Map(latestPayments.map(p => [p.roomId, p]))

    const result = rooms.map(room => {
      const latestReading  = room.electricityReadings[0] ?? null
      const monthPayments  = room.rentPayments           // all payments for selected month
      const latestPayment  = latestByRoom.get(room.id)   ?? null

      // Sum all payments for the selected month
      const currentMonthRentPaid  = monthPayments.reduce((s, p) => s + Number(p.rentAmountKes),        0)
      const currentMonthElecPaid  = monthPayments.reduce((s, p) => s + Number(p.electricityAmountKes), 0)
      const currentMonthTotalPaid = monthPayments.reduce((s, p) => s + Number(p.totalAmountKes),       0)

      const outstandingMonths = computeOutstandingMonths(
        latestPayment?.paymentDate ?? null,
        now,
      )

      return {
        id:                     room.id,
        roomNumber:             room.roomNumber,
        tenantName:             room.tenantName,
        tenantPhone:            room.tenantPhone,
        monthlyRentKes:         room.monthlyRentKes !== null ? Number(room.monthlyRentKes) : null,
        electricityRatePerUnit: Number(room.electricityRatePerUnit),
        occupancyStatus:        room.occupancyStatus,
        rentDueDay:             room.rentDueDay,
        notes:                  room.notes,
        latestElectricityReading: latestReading ? {
          id:              latestReading.id,
          readingDate:     latestReading.readingDate,
          meterReading:    Number(latestReading.meterReading),
          previousReading: latestReading.previousReading !== null ? Number(latestReading.previousReading) : null,
          unitsConsumed:   latestReading.unitsConsumed   !== null ? Number(latestReading.unitsConsumed)   : null,
          amountKes:       latestReading.amountKes       !== null ? Number(latestReading.amountKes)       : null,
          source:          latestReading.source,
        } : null,
        // All payments for the selected month (supports partial payments)
        currentMonthPayments: monthPayments.map(p => ({
          id:                   p.id,
          paymentDate:          p.paymentDate,
          periodMonth:          p.periodMonth,
          periodYear:           p.periodYear,
          rentAmountKes:        Number(p.rentAmountKes),
          electricityAmountKes: Number(p.electricityAmountKes),
          totalAmountKes:       Number(p.totalAmountKes),
          paymentMethod:        p.paymentMethod,
          mpesaRef:             p.mpesaRef,
        })),
        currentMonthRentPaid,
        currentMonthElecPaid,
        currentMonthTotalPaid,
        outstandingMonths,
      }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/rental/rooms/:id
// ---------------------------------------------------------------------------
rentalRouter.patch('/rooms/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      tenantName,
      tenantPhone,
      monthlyRentKes,
      notes,
      occupancyStatus,
    } = req.body as {
      tenantName?:      string
      tenantPhone?:     string
      monthlyRentKes?:  number
      notes?:           string
      occupancyStatus?: string
    }

    // Build update payload with only the fields present in the body
    const data: Record<string, unknown> = {}
    if (tenantName      !== undefined) data.tenantName      = tenantName
    if (tenantPhone     !== undefined) data.tenantPhone     = tenantPhone
    if (monthlyRentKes  !== undefined) data.monthlyRentKes  = monthlyRentKes
    if (notes           !== undefined) data.notes           = notes
    if (occupancyStatus !== undefined) data.occupancyStatus = occupancyStatus

    const room = await prisma.rentalRoom.update({
      where: { id },
      data,
    })

    res.json({
      id:                     room.id,
      roomNumber:             room.roomNumber,
      tenantName:             room.tenantName,
      tenantPhone:            room.tenantPhone,
      monthlyRentKes:         room.monthlyRentKes !== null ? Number(room.monthlyRentKes) : null,
      electricityRatePerUnit: Number(room.electricityRatePerUnit),
      occupancyStatus:        room.occupancyStatus,
      rentDueDay:             room.rentDueDay,
      notes:                  room.notes,
      active:                 room.active,
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/rental/rooms/:id/electricity
// ---------------------------------------------------------------------------
rentalRouter.post('/rooms/:id/electricity', async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      readingDate,
      meterReading,
      previousReading,
    } = req.body as {
      readingDate:      string
      meterReading:     number
      previousReading?: number
    }

    const room = await prisma.rentalRoom.findUnique({ where: { id } })
    if (!room) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    const rate = Number(room.electricityRatePerUnit)

    let unitsConsumed: number | undefined
    let amountKes: number | undefined

    if (previousReading !== undefined) {
      unitsConsumed = meterReading - previousReading
      amountKes     = unitsConsumed * rate
    }

    const reading = await prisma.electricityReading.create({
      data: {
        roomId:          id,
        readingDate:     new Date(readingDate),
        meterReading,
        previousReading: previousReading ?? null,
        unitsConsumed:   unitsConsumed   ?? null,
        amountKes:       amountKes       ?? null,
        source:          'manual',
      },
    })

    res.status(201).json({
      id:              reading.id,
      roomId:          reading.roomId,
      readingDate:     reading.readingDate,
      meterReading:    Number(reading.meterReading),
      previousReading: reading.previousReading !== null ? Number(reading.previousReading) : null,
      unitsConsumed:   reading.unitsConsumed   !== null ? Number(reading.unitsConsumed)   : null,
      amountKes:       reading.amountKes       !== null ? Number(reading.amountKes)       : null,
      source:          reading.source,
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/rental/rooms/:id/payments
// ---------------------------------------------------------------------------
rentalRouter.post('/rooms/:id/payments', async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      paymentDate,
      periodMonth,
      periodYear,
      rentAmountKes,
      electricityAmountKes,
      paymentMethod,
      mpesaRef,
      notes,
    } = req.body as {
      paymentDate:          string
      periodMonth:          number
      periodYear:           number
      rentAmountKes:        number
      electricityAmountKes: number
      paymentMethod:        string
      mpesaRef?:            string
      notes?:               string
    }

    const room = await prisma.rentalRoom.findUnique({ where: { id } })
    if (!room) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    const totalAmountKes = rentAmountKes + electricityAmountKes

    const payment = await prisma.rentPayment.create({
      data: {
        roomId:               id,
        paymentDate:          new Date(paymentDate),
        periodMonth,
        periodYear,
        rentAmountKes,
        electricityAmountKes,
        totalAmountKes,
        paymentMethod,
        mpesaRef:             mpesaRef ?? null,
        notes:                notes    ?? null,
      },
      include: {
        room: {
          select: {
            id:             true,
            roomNumber:     true,
            tenantName:     true,
            occupancyStatus: true,
          },
        },
      },
    })

    res.status(201).json({
      id:                   payment.id,
      roomId:               payment.roomId,
      paymentDate:          payment.paymentDate,
      periodMonth:          payment.periodMonth,
      periodYear:           payment.periodYear,
      rentAmountKes:        Number(payment.rentAmountKes),
      electricityAmountKes: Number(payment.electricityAmountKes),
      totalAmountKes:       Number(payment.totalAmountKes),
      paymentMethod:        payment.paymentMethod,
      mpesaRef:             payment.mpesaRef,
      notes:                payment.notes,
      room:                 payment.room,
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/rental/rooms/:id/payments?year=&month=
// ---------------------------------------------------------------------------
rentalRouter.get('/rooms/:id/payments', async (req, res, next) => {
  try {
    const { id } = req.params
    const { year, month } = req.query as Record<string, string | undefined>

    const room = await prisma.rentalRoom.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!room) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    const whereClause: Record<string, unknown> = { roomId: id }
    let useLimit = true

    if (year) {
      whereClause.periodYear = parseInt(year)
      useLimit = false
    }
    if (month) {
      whereClause.periodMonth = parseInt(month)
      useLimit = false
    }

    const payments = await prisma.rentPayment.findMany({
      where: whereClause as never,
      orderBy: { paymentDate: 'desc' },
      ...(useLimit ? { take: 12 } : {}),
    })

    res.json(
      payments.map(p => ({
        id:                   p.id,
        roomId:               p.roomId,
        paymentDate:          p.paymentDate,
        periodMonth:          p.periodMonth,
        periodYear:           p.periodYear,
        rentAmountKes:        Number(p.rentAmountKes),
        electricityAmountKes: Number(p.electricityAmountKes),
        totalAmountKes:       Number(p.totalAmountKes),
        paymentMethod:        p.paymentMethod,
        mpesaRef:             p.mpesaRef,
        notes:                p.notes,
      })),
    )
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/rental/summary?year=YYYY&month=M
// ---------------------------------------------------------------------------
rentalRouter.get('/summary', async (req, res, next) => {
  try {
    const now   = new Date()
    const year  = req.query.year  ? parseInt(req.query.year  as string) : now.getFullYear()
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1

    // All active rooms
    const rooms = await prisma.rentalRoom.findMany({
      where: { active: true },
      orderBy: { roomNumber: 'asc' },
    })

    // Payments for the requested period
    const payments = await prisma.rentPayment.findMany({
      where: { periodYear: year, periodMonth: month },
    })

    const paidRoomIds = new Set(payments.map(p => p.roomId))

    const occupiedRooms = rooms.filter(r => r.occupancyStatus === 'occupied')

    const expectedRentKes = occupiedRooms.reduce(
      (sum, r) => sum + (r.monthlyRentKes !== null ? Number(r.monthlyRentKes) : 0),
      0,
    )

    let collectedRentKes        = 0
    let collectedElectricityKes = 0

    for (const p of payments) {
      collectedRentKes        += Number(p.rentAmountKes)
      collectedElectricityKes += Number(p.electricityAmountKes)
    }

    const outstandingRooms = occupiedRooms.filter(r => !paidRoomIds.has(r.id))

    const roomSummary = rooms.map(room => {
      const roomPayments = payments.filter(p => p.roomId === room.id)
      const paid = roomPayments.length > 0

      return {
        id:              room.id,
        roomNumber:      room.roomNumber,
        tenantName:      room.tenantName,
        occupancyStatus: room.occupancyStatus,
        monthlyRentKes:  room.monthlyRentKes !== null ? Number(room.monthlyRentKes) : null,
        paid,
        payments: roomPayments.map(p => ({
          id:                   p.id,
          paymentDate:          p.paymentDate,
          rentAmountKes:        Number(p.rentAmountKes),
          electricityAmountKes: Number(p.electricityAmountKes),
          totalAmountKes:       Number(p.totalAmountKes),
          paymentMethod:        p.paymentMethod,
          mpesaRef:             p.mpesaRef,
        })),
      }
    })

    res.json({
      year,
      month,
      totalRooms:             rooms.length,
      occupiedRooms:          occupiedRooms.length,
      expectedRentKes:        Math.round(expectedRentKes),
      collectedRentKes:       Math.round(collectedRentKes),
      collectedElectricityKes: Math.round(collectedElectricityKes),
      outstandingRooms: outstandingRooms.map(r => ({
        id:             r.id,
        roomNumber:     r.roomNumber,
        tenantName:     r.tenantName,
        monthlyRentKes: r.monthlyRentKes !== null ? Number(r.monthlyRentKes) : null,
      })),
      rooms: roomSummary,
    })
  } catch (err) {
    next(err)
  }
})
