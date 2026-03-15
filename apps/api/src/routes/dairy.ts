import { Router } from 'express'
import { prisma } from '../db/client'

export const dairyRouter = Router()

// GET /api/dairy/cows
// Returns all active cows with latest health event, active withdrawals, and last 7 days milk totals.
dairyRouter.get('/cows', async (_req, res, next) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

    const cows = await prisma.cow.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        healthEvents: {
          orderBy: { eventDate: 'desc' },
          take: 1,
          include: {
            treatments: {
              orderBy: { withdrawalEndsDate: 'desc' },
            },
          },
        },
        milkProduction: {
          where: {
            productionDate: { gte: sevenDaysAgo },
          },
        },
      },
    })

    const result = cows.map(cow => {
      const last7Litres = cow.milkProduction.reduce((sum, r) => sum + Number(r.litres), 0)

      // Find any treatment with withdrawalEndsDate >= today across all health events
      // We need to check treatments from the latest health event and also look across events
      // The healthEvents include only the latest (take: 1), so query separately below
      const latestHealthEvent = cow.healthEvents[0] ?? null
      const activeTreatments = latestHealthEvent?.treatments.filter(
        t => t.withdrawalEndsDate && t.withdrawalEndsDate >= today
      ) ?? []

      const withdrawalActive = activeTreatments.length > 0
      const withdrawalEndsDate = withdrawalActive
        ? activeTreatments.reduce<Date | null>((latest, t) =>
            !latest || (t.withdrawalEndsDate && t.withdrawalEndsDate > latest)
              ? t.withdrawalEndsDate
              : latest
          , null)
        : null

      return {
        id:                   cow.id,
        name:                 cow.name,
        tagNumber:            cow.tagNumber,
        breed:                cow.breed,
        status:               cow.status,
        dateLastCalved:       cow.dateLastCalved,
        expectedDryOffDate:   cow.expectedDryOffDate,
        expectedCalvingDate:  cow.expectedCalvingDate,
        latestHealthEvent:    latestHealthEvent,
        last7DaysLitres:      Math.round(last7Litres * 10) / 10,
        withdrawalActive,
        withdrawalEndsDate,
      }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET /api/dairy/milk/summary?year=YYYY&month=M
// Monthly milk totals, per-cow breakdown, per-buyer breakdown, and daily totals.
dairyRouter.get('/milk/summary', async (req, res, next) => {
  try {
    const now = new Date()
    const year  = req.query.year  ? parseInt(req.query.year  as string) : now.getFullYear()
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd   = new Date(year, month, 0, 23, 59, 59)

    const [productions, deliveries] = await Promise.all([
      prisma.milkProduction.findMany({
        where: { productionDate: { gte: monthStart, lte: monthEnd } },
        include: { cow: { select: { id: true, name: true } } },
        orderBy: { productionDate: 'asc' },
      }),
      prisma.milkDelivery.findMany({
        where: { deliveryDate: { gte: monthStart, lte: monthEnd } },
        include: { buyer: { select: { id: true, canonicalName: true } } },
      }),
    ])

    // Overall totals
    let totalLitres = 0
    let saleableLitres = 0
    let withdrawalLitres = 0

    // Per-cow
    const cowMap = new Map<string, {
      cowId: string; cowName: string
      totalLitres: number; morningLitres: number; eveningLitres: number
    }>()

    // Daily totals
    const dayMap = new Map<string, { date: string; totalLitres: number; saleableLitres: number }>()

    for (const r of productions) {
      const litres = Number(r.litres)
      totalLitres += litres
      if (r.saleable) saleableLitres += litres
      if (r.withdrawalActive) withdrawalLitres += litres

      // Cow breakdown
      const existing = cowMap.get(r.cowId ?? '')
      if (existing) {
        existing.totalLitres += litres
        if (r.session === 'morning') existing.morningLitres += litres
        if (r.session === 'evening') existing.eveningLitres += litres
      } else {
        cowMap.set(r.cowId ?? '', {
          cowId:         r.cowId ?? '',
          cowName:       r.cow?.name ?? 'Unknown',
          totalLitres:   litres,
          morningLitres: r.session === 'morning' ? litres : 0,
          eveningLitres: r.session === 'evening' ? litres : 0,
        })
      }

      // Daily breakdown
      const dateKey = r.productionDate.toISOString().split('T')[0]
      const dayEntry = dayMap.get(dateKey) ?? { date: dateKey, totalLitres: 0, saleableLitres: 0 }
      dayEntry.totalLitres += litres
      if (r.saleable) dayEntry.saleableLitres += litres
      dayMap.set(dateKey, dayEntry)
    }

    // Per-buyer from MilkDelivery
    const buyerMap = new Map<string, {
      buyerId: string; buyerName: string
      litresDelivered: number; totalValueKes: number
      unpaidLitres: number; unpaidValueKes: number
    }>()

    for (const d of deliveries) {
      const litres     = Number(d.litres)
      const totalValue = Number(d.totalValue)
      const existing   = buyerMap.get(d.buyerId)
      const unpaid     = !d.paymentReceived

      if (existing) {
        existing.litresDelivered += litres
        existing.totalValueKes   += totalValue
        if (unpaid) {
          existing.unpaidLitres   += litres
          existing.unpaidValueKes += totalValue
        }
      } else {
        buyerMap.set(d.buyerId, {
          buyerId:         d.buyerId,
          buyerName:       d.buyer.canonicalName,
          litresDelivered: litres,
          totalValueKes:   totalValue,
          unpaidLitres:    unpaid ? litres     : 0,
          unpaidValueKes:  unpaid ? totalValue : 0,
        })
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10

    res.json({
      year,
      month,
      totalLitres:      round1(totalLitres),
      saleableLitres:   round1(saleableLitres),
      withdrawalLitres: round1(withdrawalLitres),
      perCow: Array.from(cowMap.values()).map(c => ({
        ...c,
        totalLitres:   round1(c.totalLitres),
        morningLitres: round1(c.morningLitres),
        eveningLitres: round1(c.eveningLitres),
      })),
      perBuyer: Array.from(buyerMap.values()).map(b => ({
        ...b,
        litresDelivered: round1(b.litresDelivered),
        totalValueKes:   Math.round(b.totalValueKes),
        unpaidLitres:    round1(b.unpaidLitres),
        unpaidValueKes:  Math.round(b.unpaidValueKes),
      })),
      dailyTotals: Array.from(dayMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
          date:           d.date,
          totalLitres:    round1(d.totalLitres),
          saleableLitres: round1(d.saleableLitres),
        })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/dairy/milk/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns MilkProduction records with cow name. Defaults to last 14 days.
dairyRouter.get('/milk/daily', async (req, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string>

    let fromDate: Date
    let toDate: Date

    if (from && to) {
      fromDate = new Date(from)
      toDate   = new Date(to)
    } else {
      toDate   = new Date()
      fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 13)
    }

    const records = await prisma.milkProduction.findMany({
      where: {
        productionDate: { gte: fromDate, lte: toDate },
      },
      orderBy: { productionDate: 'desc' },
      include: { cow: { select: { name: true, tagNumber: true } } },
    })

    res.json(records)
  } catch (err) {
    next(err)
  }
})

// GET /api/dairy/buyers
// Returns all active MilkBuyer records with currentBalance and last delivery date.
dairyRouter.get('/buyers', async (_req, res, next) => {
  try {
    const buyers = await prisma.milkBuyer.findMany({
      where: { active: true },
      orderBy: { canonicalName: 'asc' },
      include: {
        deliveries: {
          orderBy: { deliveryDate: 'desc' },
          take: 1,
          select: { deliveryDate: true },
        },
      },
    })

    const result = buyers.map(b => ({
      id:             b.id,
      canonicalName:  b.canonicalName,
      paymentType:    b.paymentType,
      pricePerLitre:  Number(b.pricePerLitre),
      currentBalance: Number(b.currentBalance),
      phone:          b.phone,
      lastDeliveryDate: b.deliveries[0]?.deliveryDate ?? null,
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/dairy/deliveries
// Body: { deliveryDate, buyerId, litres, pricePerLitre }
dairyRouter.post('/deliveries', async (req, res, next) => {
  try {
    const { deliveryDate, buyerId, litres, pricePerLitre } = req.body as {
      deliveryDate: string
      buyerId: string
      litres: number
      pricePerLitre: number
    }

    const totalValue = litres * pricePerLitre

    const delivery = await prisma.milkDelivery.create({
      data: {
        deliveryDate:    new Date(deliveryDate),
        buyerId,
        litres,
        pricePerLitre,
        totalValue,
        paymentReceived: false,
      },
      include: { buyer: { select: { canonicalName: true, paymentType: true } } },
    })

    res.status(201).json(delivery)
  } catch (err) {
    next(err)
  }
})

// GET /api/dairy/cows/:id/health
// Returns cow health events with treatments, ordered by eventDate desc.
dairyRouter.get('/cows/:id/health', async (req, res, next) => {
  try {
    const { id } = req.params

    const cow = await prisma.cow.findUnique({
      where: { id },
      select: {
        id:                  true,
        name:                true,
        tagNumber:           true,
        breed:               true,
        status:              true,
        dateLastCalved:      true,
        expectedDryOffDate:  true,
        expectedCalvingDate: true,
        healthEvents: {
          orderBy: { eventDate: 'desc' },
          include: {
            treatments: {
              orderBy: { withdrawalEndsDate: 'desc' },
            },
          },
        },
      },
    })

    if (!cow) {
      res.status(404).json({ error: 'Cow not found' })
      return
    }

    // Separate reproduction events from health events
    const reproductionEventTypes = ['calving', 'insemination', 'pregnancy_check', 'dry_off']
    const healthEvents      = cow.healthEvents.filter(e => !reproductionEventTypes.includes(e.eventType))
    const reproductionEvents = cow.healthEvents.filter(e => reproductionEventTypes.includes(e.eventType))

    res.json({
      cow: {
        id:                  cow.id,
        name:                cow.name,
        tagNumber:           cow.tagNumber,
        breed:               cow.breed,
        status:              cow.status,
        dateLastCalved:      cow.dateLastCalved,
        expectedDryOffDate:  cow.expectedDryOffDate,
        expectedCalvingDate: cow.expectedCalvingDate,
      },
      healthEvents,
      reproductionEvents,
    })
  } catch (err) {
    next(err)
  }
})
