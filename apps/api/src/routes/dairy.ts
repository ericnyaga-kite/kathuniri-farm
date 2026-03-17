import { Router } from 'express'
import { prisma } from '../db/client'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
      let withdrawalEndsDate: Date | null = null
      if (withdrawalActive) {
        for (const tx of activeTreatments) {
          if (tx.withdrawalEndsDate && (!withdrawalEndsDate || tx.withdrawalEndsDate > withdrawalEndsDate)) {
            withdrawalEndsDate = tx.withdrawalEndsDate
          }
        }
      }

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

// POST /api/dairy/cows
dairyRouter.post('/cows', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const cow = await prisma.cow.create({
      data: {
        name:               String(b.name),
        tagNumber:          b.tagNumber  ? String(b.tagNumber)  : null,
        breed:              b.breed      ? String(b.breed)      : null,
        status:             String(b.status ?? 'milking'),
        dateLastCalved:     b.dateLastCalved    ? new Date(String(b.dateLastCalved))    : null,
        expectedDryOffDate: b.expectedDryOffDate ? new Date(String(b.expectedDryOffDate)) : null,
        active:             true,
      },
    })
    res.status(201).json(cow)
  } catch (err) { next(err) }
})

// PATCH /api/dairy/cows/:id
dairyRouter.patch('/cows/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.name               !== undefined) data.name               = String(b.name)
    if (b.tagNumber          !== undefined) data.tagNumber          = b.tagNumber ? String(b.tagNumber) : null
    if (b.breed              !== undefined) data.breed              = b.breed ? String(b.breed) : null
    if (b.status             !== undefined) data.status             = String(b.status)
    if (b.dateLastCalved     !== undefined) data.dateLastCalved     = b.dateLastCalved ? new Date(String(b.dateLastCalved)) : null
    if (b.expectedDryOffDate !== undefined) data.expectedDryOffDate = b.expectedDryOffDate ? new Date(String(b.expectedDryOffDate)) : null
    if (b.active             !== undefined) data.active             = Boolean(b.active)
    const cow = await prisma.cow.update({ where: { id: req.params.id }, data })
    res.json(cow)
  } catch (err) { next(err) }
})

// PATCH /api/dairy/buyers/:id
dairyRouter.patch('/buyers/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.canonicalName  !== undefined) data.canonicalName  = String(b.canonicalName)
    if (b.paymentType    !== undefined) data.paymentType    = String(b.paymentType)
    if (b.pricePerLitre  !== undefined) data.pricePerLitre  = b.pricePerLitre != null ? Number(b.pricePerLitre) : null
    if (b.phone          !== undefined) data.phone          = b.phone ? String(b.phone) : null
    if (b.active         !== undefined) data.active         = Boolean(b.active)
    const buyer = await prisma.milkBuyer.update({ where: { id: req.params.id }, data })
    res.json({ ...buyer, pricePerLitre: Number(buyer.pricePerLitre), currentBalance: Number(buyer.currentBalance) })
  } catch (err) { next(err) }
})

// POST /api/dairy/cows/:id/health
// Body: { eventDate, eventType, conditionName?, symptoms?, notes?, drugName?, durationDays?, withdrawalPeriodDays?, costKes? }
dairyRouter.post('/cows/:id/health', async (req, res, next) => {
  try {
    const { id } = req.params
    const b = req.body as Record<string, unknown>

    const event = await prisma.healthEvent.create({
      data: {
        cowId:         id,
        eventDate:     new Date(String(b.eventDate)),
        eventType:     String(b.eventType ?? 'illness'),
        conditionName: b.conditionName ? String(b.conditionName) : null,
        symptoms:      b.symptoms      ? String(b.symptoms)      : null,
        notes:         b.notes         ? String(b.notes)         : null,
      },
    })

    // If a drug is provided, create a Treatment linked to this health event
    if (b.drugName) {
      const durationDays         = b.durationDays         ? Number(b.durationDays)         : null
      const withdrawalPeriodDays = b.withdrawalPeriodDays ? Number(b.withdrawalPeriodDays) : 0
      let withdrawalEndsDate: Date | null = null

      if (withdrawalPeriodDays > 0) {
        withdrawalEndsDate = new Date(event.eventDate)
        withdrawalEndsDate.setDate(withdrawalEndsDate.getDate() + withdrawalPeriodDays)
      }

      await prisma.treatment.create({
        data: {
          healthEventId:       event.id,
          drugName:            String(b.drugName),
          dosageRoute:         b.dosageRoute ? String(b.dosageRoute) : null,
          durationDays:        durationDays,
          withdrawalPeriodDays,
          withdrawalEndsDate,
          costKes:             b.costKes ? Number(b.costKes) : null,
        },
      })
    }

    const full = await prisma.healthEvent.findUnique({
      where: { id: event.id },
      include: { treatments: true },
    })

    res.status(201).json(full)
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

// PATCH /api/dairy/health-events/:id
dairyRouter.patch('/health-events/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.eventDate     !== undefined) data.eventDate     = new Date(String(b.eventDate))
    if (b.eventType     !== undefined) data.eventType     = String(b.eventType)
    if (b.conditionName !== undefined) data.conditionName = b.conditionName ? String(b.conditionName) : null
    if (b.symptoms      !== undefined) data.symptoms      = b.symptoms      ? String(b.symptoms)      : null
    if (b.notes         !== undefined) data.notes         = b.notes         ? String(b.notes)         : null
    const event = await prisma.healthEvent.update({
      where: { id: req.params.id },
      data,
      include: { treatments: true },
    })
    res.json(event)
  } catch (err) { next(err) }
})

// PATCH /api/dairy/treatments/:id
dairyRouter.patch('/treatments/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.drugName            !== undefined) data.drugName            = String(b.drugName)
    if (b.dosageRoute         !== undefined) data.dosageRoute         = b.dosageRoute ? String(b.dosageRoute) : null
    if (b.durationDays        !== undefined) data.durationDays        = b.durationDays ? Number(b.durationDays) : null
    if (b.withdrawalPeriodDays !== undefined) data.withdrawalPeriodDays = Number(b.withdrawalPeriodDays)
    if (b.withdrawalEndsDate  !== undefined) data.withdrawalEndsDate  = b.withdrawalEndsDate ? new Date(String(b.withdrawalEndsDate)) : null
    if (b.costKes             !== undefined) data.costKes             = b.costKes ? Number(b.costKes) : null
    const tx = await prisma.treatment.update({ where: { id: req.params.id }, data })
    res.json(tx)
  } catch (err) { next(err) }
})

// ─── POST /api/dairy/milk ─────────────────────────────────────────────────
// Upsert a MilkProduction record (called by sync queue from manager's IndexedDB)
dairyRouter.post('/milk', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const productionDate = new Date(String(b.productionDate))
    const cowId   = b.cowId   ? String(b.cowId)   : null
    const session = String(b.session === 'AM' || b.session === 'morning' ? 'morning' : 'evening')

    // Check for existing record (same date + cow + session)
    const existing = await prisma.milkProduction.findFirst({
      where: { productionDate, cowId: cowId ?? undefined, session },
    })

    let record
    if (existing) {
      record = await prisma.milkProduction.update({
        where: { id: existing.id },
        data: { litres: Number(b.litres) },
      })
    } else {
      record = await prisma.milkProduction.create({
        data: {
          id:              b.id ? String(b.id) : undefined,
          productionDate,
          cowId,
          session,
          litres:          Number(b.litres),
          withdrawalActive: Boolean(b.withdrawalActive ?? false),
          saleable:        Boolean(b.saleable ?? true),
          source:          b.source ? String(b.source) : 'manager',
          createdBy:       b.createdBy ? String(b.createdBy) : null,
        },
      })
    }
    res.status(201).json(record)
  } catch (err) { next(err) }
})

// ─── Small stock ──────────────────────────────────────────────────────────

// GET /api/dairy/small-stock
dairyRouter.get('/small-stock', async (_req, res, next) => {
  try {
    const animals = await prisma.smallStock.findMany({
      where: { active: true },
      orderBy: [{ species: 'asc' }, { name: 'asc' }],
      include: {
        healthEvents: {
          orderBy: { eventDate: 'desc' },
          take: 1,
        },
      },
    })
    res.json(animals)
  } catch (err) { next(err) }
})

// PATCH /api/dairy/small-stock/:id
dairyRouter.patch('/small-stock/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.name        !== undefined) data.name        = b.name        ? String(b.name)        : null
    if (b.tagNumber   !== undefined) data.tagNumber   = b.tagNumber   ? String(b.tagNumber)   : null
    if (b.status      !== undefined) data.status      = String(b.status)
    if (b.dateOfBirth !== undefined) data.dateOfBirth = b.dateOfBirth ? new Date(String(b.dateOfBirth)) : null
    if (b.notes       !== undefined) data.notes       = b.notes       ? String(b.notes)       : null
    const animal = await prisma.smallStock.update({ where: { id: req.params.id }, data })
    res.json(animal)
  } catch (err) { next(err) }
})

// GET /api/dairy/small-stock/:id/health
dairyRouter.get('/small-stock/:id/health', async (req, res, next) => {
  try {
    const animal = await prisma.smallStock.findUnique({
      where: { id: req.params.id },
      include: {
        healthEvents: { orderBy: { eventDate: 'desc' } },
      },
    })
    if (!animal) { res.status(404).json({ error: 'Not found' }); return }
    res.json(animal)
  } catch (err) { next(err) }
})

// POST /api/dairy/small-stock/:id/health
dairyRouter.post('/small-stock/:id/health', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const event = await prisma.smallStockHealthEvent.create({
      data: {
        animalId:      req.params.id,
        eventDate:     new Date(String(b.eventDate)),
        eventType:     String(b.eventType ?? 'routine'),
        conditionName: b.conditionName ? String(b.conditionName) : null,
        symptoms:      b.symptoms      ? String(b.symptoms)      : null,
        drugName:      b.drugName      ? String(b.drugName)      : null,
        costKes:       b.costKes       ? Number(b.costKes)       : null,
        notes:         b.notes         ? String(b.notes)         : null,
      },
    })
    res.status(201).json(event)
  } catch (err) { next(err) }
})

// PATCH /api/dairy/small-stock/health/:id
dairyRouter.patch('/small-stock/health/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.eventDate     !== undefined) data.eventDate     = new Date(String(b.eventDate))
    if (b.eventType     !== undefined) data.eventType     = String(b.eventType)
    if (b.conditionName !== undefined) data.conditionName = b.conditionName ? String(b.conditionName) : null
    if (b.symptoms      !== undefined) data.symptoms      = b.symptoms      ? String(b.symptoms)      : null
    if (b.drugName      !== undefined) data.drugName      = b.drugName      ? String(b.drugName)      : null
    if (b.costKes       !== undefined) data.costKes       = b.costKes       ? Number(b.costKes)       : null
    if (b.notes         !== undefined) data.notes         = b.notes         ? String(b.notes)         : null
    const event = await prisma.smallStockHealthEvent.update({ where: { id: req.params.id }, data })
    res.json(event)
  } catch (err) { next(err) }
})

// ─── Milk receipts (Mborugu Dairy FCS cooperative) ────────────────────────

// POST /api/dairy/receipts/scan
// Body: { imageData: "data:image/jpeg;base64,..." }
// Parses the receipt photo with Claude vision and saves as pending.
dairyRouter.post('/receipts/scan', async (req, res, next) => {
  try {
    const { imageData } = req.body as { imageData: string }
    if (!imageData) { res.status(400).json({ error: 'imageData required' }); return }

    // Strip data URI prefix to get pure base64
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '')
    const mimeMatch = imageData.match(/^data:(image\/\w+);base64,/)
    const mediaType = (mimeMatch?.[1] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Extract data from this milk cooperative receipt. Return ONLY valid JSON with these fields:
{
  "receiptNo": "string or null",
  "supplierNo": "string or null",
  "supplierName": "string or null",
  "shift": "AM or PM or null",
  "quantityKg": number or null,
  "cumulativeKg": number or null,
  "station": "string or null",
  "receiptDate": "YYYY-MM-DD or null"
}
No explanation, just JSON.`,
          },
        ],
      }],
    })

    let parsed: Record<string, unknown> = {}
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      // If parsing fails, save with just image for manual fill
    }

    const receipt = await prisma.milkReceipt.create({
      data: {
        receiptNo:    parsed.receiptNo    ? String(parsed.receiptNo)    : null,
        supplierNo:   parsed.supplierNo   ? String(parsed.supplierNo)   : null,
        supplierName: parsed.supplierName ? String(parsed.supplierName) : null,
        shift:        parsed.shift        ? String(parsed.shift)        : null,
        quantityKg:   parsed.quantityKg   ? Number(parsed.quantityKg)   : null,
        cumulativeKg: parsed.cumulativeKg ? Number(parsed.cumulativeKg) : null,
        station:      parsed.station      ? String(parsed.station)      : null,
        receiptDate:  parsed.receiptDate  ? new Date(String(parsed.receiptDate)) : null,
        imageData,
        status: 'pending',
      },
    })

    res.status(201).json({ ...receipt, quantityKg: receipt.quantityKg ? Number(receipt.quantityKg) : null, cumulativeKg: receipt.cumulativeKg ? Number(receipt.cumulativeKg) : null })
  } catch (err) { next(err) }
})

// GET /api/dairy/receipts?status=pending
dairyRouter.get('/receipts', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : 'pending'
    const receipts = await prisma.milkReceipt.findMany({
      where: status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(receipts.map(r => ({
      ...r,
      quantityKg:   r.quantityKg   ? Number(r.quantityKg)   : null,
      cumulativeKg: r.cumulativeKg ? Number(r.cumulativeKg) : null,
      imageData: undefined, // don't send image in list
    })))
  } catch (err) { next(err) }
})

// PATCH /api/dairy/receipts/:id  — confirm or edit a pending receipt
// Body: { status?, receiptNo?, supplierNo?, supplierName?, shift?, quantityKg?, cumulativeKg?, station?, receiptDate?, notes? }
dairyRouter.patch('/receipts/:id', async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (b.receiptNo    !== undefined) data.receiptNo    = b.receiptNo    ? String(b.receiptNo)    : null
    if (b.supplierNo   !== undefined) data.supplierNo   = b.supplierNo   ? String(b.supplierNo)   : null
    if (b.supplierName !== undefined) data.supplierName = b.supplierName ? String(b.supplierName) : null
    if (b.shift        !== undefined) data.shift        = b.shift        ? String(b.shift)        : null
    if (b.quantityKg   !== undefined) data.quantityKg   = b.quantityKg   ? Number(b.quantityKg)   : null
    if (b.cumulativeKg !== undefined) data.cumulativeKg = b.cumulativeKg ? Number(b.cumulativeKg) : null
    if (b.station      !== undefined) data.station      = b.station      ? String(b.station)      : null
    if (b.receiptDate  !== undefined) data.receiptDate  = b.receiptDate  ? new Date(String(b.receiptDate)) : null
    if (b.notes        !== undefined) data.notes        = b.notes        ? String(b.notes)        : null
    if (b.status       !== undefined) {
      data.status = String(b.status)
      if (b.status === 'confirmed') {
        data.confirmedAt = new Date()
        data.imageData   = null  // drop image after confirmation
      }
    }
    const receipt = await prisma.milkReceipt.update({
      where: { id: req.params.id },
      data,
    })
    res.json({ ...receipt, quantityKg: receipt.quantityKg ? Number(receipt.quantityKg) : null, cumulativeKg: receipt.cumulativeKg ? Number(receipt.cumulativeKg) : null })
  } catch (err) { next(err) }
})
