import { Router } from 'express'
import { prisma } from '../db/client'

export const teaRouter = Router()

// GET /api/tea/sessions?centreId=&from=&to=
teaRouter.get('/sessions', async (req, res, next) => {
  try {
    const { centreId, from, to } = req.query as Record<string, string>
    const sessions = await prisma.pickingSession.findMany({
      where: {
        ...(centreId && { centreId }),
        sessionDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      },
      orderBy: { sessionDate: 'desc' },
      take: 50,
      include: { pickerRecords: true },
    })
    res.json(sessions)
  } catch (err) {
    next(err)
  }
})

// POST /api/tea/sessions — create a picking session + picker records
teaRouter.post('/sessions', async (req, res, next) => {
  try {
    const { sessionDate, centreId, pickers } = req.body as {
      sessionDate: string
      centreId: string
      pickers: Array<{ staffId: string; staffName?: string; kgPicked: number; ratePerKg: number }>
    }

    const totalKg = pickers.reduce((s, p) => s + p.kgPicked, 0)

    const session = await prisma.pickingSession.create({
      data: {
        sessionDate: new Date(sessionDate),
        centreId,
        pickerTotalKg: totalKg,
        reconciliationStatus: 'pending',
        pickerRecords: {
          create: pickers.map(p => ({
            staffId: p.staffId,
            kgPicked: p.kgPicked,
            ratePerKg: p.ratePerKg,
            grossPay: p.kgPicked * p.ratePerKg,
          })),
        },
      },
      include: { pickerRecords: true },
    })
    res.status(201).json(session)
  } catch (err) {
    next(err)
  }
})

// GET /api/tea/sms/deliveries?from=&to=
teaRouter.get('/sms/deliveries', async (req, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string>
    const deliveries = await prisma.teaSmsDelivery.findMany({
      where: {
        deliveryDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      },
      orderBy: { deliveryDate: 'desc' },
      take: 90,
      include: {
        centre: { select: { canonicalName: true } },
        allocations: { include: { ktdaAccount: { select: { accountCode: true, holderName: true } } } },
        smsRecord: { select: { rawSms: true, senderPhone: true, receivedAt: true, parsed: true, parseError: true } },
      },
    })
    res.json(deliveries)
  } catch (err) {
    next(err)
  }
})

// GET /api/tea/sms/records?limit= — raw SMS records with parse status
teaRouter.get('/sms/records', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 30
    const records = await prisma.teaSmsRecord.findMany({
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: {
        deliveries: {
          include: {
            centre: { select: { canonicalName: true } },
            allocations: { include: { ktdaAccount: { select: { accountCode: true, holderName: true } } } },
          },
        },
      },
    })
    res.json(records)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/tea/sms/deliveries/:id — owner corrects a parsed delivery
teaRouter.patch('/sms/deliveries/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      deliveryDate,
      cumulativeKg,
      todayKg,
      casualKg,
      casualPayKes,
      supervisorFloat,
      centreRawName,
      correctionNote,
    } = req.body as {
      deliveryDate?: string
      cumulativeKg?: number
      todayKg?: number
      casualKg?: number
      casualPayKes?: number
      supervisorFloat?: number
      centreRawName?: string
      correctionNote?: string
    }

    // If centre name changed, try to resolve it
    let centreId: string | undefined
    if (centreRawName) {
      const centre = await prisma.collectionCentre.findFirst({
        where: {
          OR: [
            { canonicalName: { equals: centreRawName, mode: 'insensitive' } },
            { alternateSpellings: { has: centreRawName } },
          ],
        },
      })
      centreId = centre?.id
    }

    const updated = await prisma.teaSmsDelivery.update({
      where: { id },
      data: {
        ...(deliveryDate    && { deliveryDate: new Date(deliveryDate) }),
        ...(cumulativeKg !== undefined && { cumulativeKg }),
        ...(todayKg      !== undefined && { todayKg }),
        ...(casualKg     !== undefined && { casualKg }),
        ...(casualPayKes !== undefined && { casualPayKes }),
        ...(supervisorFloat !== undefined && { supervisorFloat }),
        ...(centreRawName  && { centreRawName }),
        ...(centreId       && { centreId }),
        // Store correction note in parseConfidence field comment via notes
        parseConfidence: 1.0, // manually corrected = full confidence
      },
      include: {
        centre: { select: { canonicalName: true } },
        allocations: { include: { ktdaAccount: { select: { accountCode: true, holderName: true } } } },
        smsRecord: { select: { rawSms: true, receivedAt: true } },
      },
    })

    // Log correction as an alert for audit trail
    await prisma.alert.create({
      data: {
        alertCode: 'TEA_SMS_CORRECTED',
        priority: 'low',
        title: 'Tea SMS record corrected',
        body: correctionNote
          ? `Delivery ${id} corrected: ${correctionNote}`
          : `Delivery ${id} manually corrected by owner`,
        entityType: 'tea_sms_delivery',
        entityId: id,
        status: 'resolved',
        resolvedAt: new Date(),
      },
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// POST /api/tea/sms/deliveries — owner manually enters a delivery (no SMS)
teaRouter.post('/sms/deliveries', async (req, res, next) => {
  try {
    const {
      deliveryDate,
      centreRawName,
      cumulativeKg,
      todayKg,
      casualKg,
      casualPayKes,
      supervisorFloat,
      ktdaAccountId,
    } = req.body as {
      deliveryDate: string
      centreRawName: string
      cumulativeKg: number
      todayKg: number
      casualKg?: number
      casualPayKes?: number
      supervisorFloat?: number
      ktdaAccountId?: string
    }

    // Create a synthetic SMS record so the delivery has a parent
    const smsRecord = await prisma.teaSmsRecord.create({
      data: {
        receivedAt: new Date(),
        senderPhone: 'manual',
        rawSms: `Manual entry by owner: ${centreRawName} ${cumulativeKg}kg`,
        parsed: true,
      },
    })

    const centre = await prisma.collectionCentre.findFirst({
      where: { canonicalName: { equals: centreRawName, mode: 'insensitive' } },
    })

    const delivery = await prisma.teaSmsDelivery.create({
      data: {
        smsRecordId: smsRecord.id,
        deliveryDate: new Date(deliveryDate),
        centreId: centre?.id,
        centreRawName,
        cumulativeKg,
        todayKg,
        casualKg,
        casualPayKes,
        supervisorFloat,
        parseConfidence: 1.0,
        ...(ktdaAccountId && {
          allocations: {
            create: { accountCode: '-', ktdaAccountId, kgAllocated: todayKg },
          },
        }),
      },
      include: {
        centre: { select: { canonicalName: true } },
        allocations: { include: { ktdaAccount: { select: { accountCode: true, holderName: true } } } },
      },
    })
    res.status(201).json(delivery)
  } catch (err) {
    next(err)
  }
})

// GET /api/tea/accounts — KTDA account list
teaRouter.get('/accounts', async (_req, res, next) => {
  try {
    const accounts = await prisma.ktdaAccount.findMany({
      where: { active: true },
      orderBy: { accountCode: 'asc' },
    })
    res.json(accounts)
  } catch (err) {
    next(err)
  }
})

// GET /api/tea/production/summary?year=YYYY&month=M
// Returns the latest cumulative kg per account per centre for the given month.
// Falls back to current month if not specified.
// Also returns picking session totals from the manager's daily entries.
teaRouter.get('/production/summary', async (req, res, next) => {
  try {
    const now = new Date()
    const year  = req.query.year  ? parseInt(req.query.year  as string) : now.getFullYear()
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd   = new Date(year, month,     0, 23, 59, 59)

    // Get all SMS deliveries for the month, latest per account
    const deliveries = await prisma.teaSmsDelivery.findMany({
      where: { deliveryDate: { gte: monthStart, lte: monthEnd } },
      orderBy: { deliveryDate: 'desc' },
      include: {
        centre: { select: { canonicalName: true } },
        allocations: {
          include: {
            ktdaAccount: {
              select: { id: true, accountCode: true, holderName: true, bushesRegistered: true },
            },
          },
        },
        smsRecord: {
          select: {
            rawSms: true,
            receivedAt: true,
            senderPhone: true,
            parsed: true,
          },
        },
      },
    })

    // Get picking session totals (manager entries)
    const sessions = await prisma.pickingSession.findMany({
      where: { sessionDate: { gte: monthStart, lte: monthEnd } },
      include: {
        centre: { select: { canonicalName: true } },
        pickerRecords: { select: { kgPicked: true } },
      },
    })

    // Accumulate kg per account by summing all daily deliveries
    // (SMS gives today's kg only — no cumulative in the message)
    const accountMap = new Map<string, {
      accountCode: string
      holderName: string
      bushesRegistered: number | null
      totalKg: number
      centres: Set<string>
      lastDeliveryDate: string
      lastDeliveryId: string
      lastSmsRaw: string | null
      lastSmsReceivedAt: string | null
      lastSmsSenderPhone: string | null
      lastCorrected: boolean
    }>()

    for (const d of deliveries) {
      // Use todayKg from the delivery (the authoritative per-delivery total),
      // not the sum of letter allocations (which can be incorrect for multi-account SMS
      // where centre letter breakdowns are farm-wide, not per-account).
      const deliveryKg = Number(d.todayKg ?? 0)
      const isManual = d.smsRecord?.senderPhone === 'manual'
      const isCorrected = Number(d.parseConfidence) === 1.0 && !isManual
      const centreName = d.centre?.canonicalName ?? d.centreRawName ?? '—'

      // Collect distinct accounts for this delivery
      const seenAccounts = new Set<string>()
      for (const alloc of d.allocations) {
        const acct = alloc.ktdaAccount
        if (!acct || seenAccounts.has(acct.accountCode)) continue
        seenAccounts.add(acct.accountCode)

        const existing = accountMap.get(acct.accountCode)
        if (existing) {
          existing.totalKg += deliveryKg
          existing.centres.add(centreName)
          if (d.deliveryDate.toISOString() > existing.lastDeliveryDate) {
            existing.lastDeliveryDate    = d.deliveryDate.toISOString().split('T')[0]
            existing.lastDeliveryId      = d.id
            existing.lastSmsRaw          = d.smsRecord?.rawSms ?? null
            existing.lastSmsReceivedAt   = d.smsRecord?.receivedAt?.toISOString() ?? null
            existing.lastSmsSenderPhone  = d.smsRecord?.senderPhone ?? null
            existing.lastCorrected       = isCorrected
          }
        } else {
          accountMap.set(acct.accountCode, {
            accountCode:         acct.accountCode,
            holderName:          acct.holderName,
            bushesRegistered:    acct.bushesRegistered,
            totalKg:             deliveryKg,
            centres:             new Set([centreName]),
            lastDeliveryDate:    d.deliveryDate.toISOString().split('T')[0],
            lastDeliveryId:      d.id,
            lastSmsRaw:          d.smsRecord?.rawSms ?? null,
            lastSmsReceivedAt:   d.smsRecord?.receivedAt?.toISOString() ?? null,
            lastSmsSenderPhone:  d.smsRecord?.senderPhone ?? null,
            lastCorrected:       isCorrected,
          })
        }
      }
    }

    const accountSummaries = Array.from(accountMap.values()).map(a => {
      const bushes = a.bushesRegistered
      const isManual = a.lastSmsSenderPhone === 'manual'
      return {
        accountCode:      a.accountCode,
        holderName:       a.holderName,
        bushesRegistered: bushes,
        totalKg:          Math.round(a.totalKg * 10) / 10,
        centres:          Array.from(a.centres),
        lastDeliveryDate: a.lastDeliveryDate,
        kgPerBush:        bushes && bushes > 0 ? Math.round((a.totalKg / bushes) * 1000) / 1000 : null,
        source: {
          deliveryId:  a.lastDeliveryId,
          type:        isManual ? 'manual' : a.lastCorrected ? 'corrected' : 'sms' as 'sms' | 'manual' | 'corrected',
          rawSms:      a.lastSmsRaw,
          receivedAt:  a.lastSmsReceivedAt,
          senderPhone: a.lastSmsSenderPhone,
          corrected:   a.lastCorrected,
        },
      }
    }).sort((a, b) => a.accountCode.localeCompare(b.accountCode))

    // Area totals (group by centre)
    const areaMap = new Map<string, { centreName: string; totalKg: number; deliveryCount: number }>()
    for (const d of deliveries) {
      const name = d.centre?.canonicalName ?? d.centreRawName ?? 'Unknown'
      const existing = areaMap.get(name) ?? { centreName: name, totalKg: 0, deliveryCount: 0 }
      existing.totalKg += Number(d.todayKg ?? 0)
      existing.deliveryCount += 1
      areaMap.set(name, existing)
    }

    // Picking session totals (from manager entries, grouped by centre)
    const sessionMap = new Map<string, { centreName: string; totalKg: number; sessionCount: number }>()
    for (const s of sessions) {
      const name = s.centre?.canonicalName ?? 'Unknown'
      const total = s.pickerRecords.reduce((sum, r) => sum + Number(r.kgPicked), 0)
      const existing = sessionMap.get(name) ?? { centreName: name, totalKg: 0, sessionCount: 0 }
      existing.totalKg += total
      existing.sessionCount += 1
      sessionMap.set(name, existing)
    }

    res.json({
      year,
      month,
      accounts: accountSummaries,
      areaTotals: Array.from(areaMap.values()),
      pickingSessions: Array.from(sessionMap.values()),
      grandTotalKg: accountSummaries.reduce((s, a) => s + a.totalKg, 0),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/tea/monthly?accountId=&year=&month=
teaRouter.get('/monthly', async (req, res, next) => {
  try {
    const { accountId, year, month } = req.query as Record<string, string>
    const records = await prisma.ktdaMonthlyRecord.findMany({
      where: {
        ...(accountId && { ktdaAccountId: accountId }),
        ...(year && { periodYear: parseInt(year) }),
        ...(month && { periodMonth: parseInt(month) }),
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      include: { ktdaAccount: { select: { accountCode: true, holderName: true } } },
    })
    res.json(records)
  } catch (err) {
    next(err)
  }
})

// GET /api/tea/reconciliation?year=YYYY&month=M
// Groups deliveries by SMS record so multi-account messages appear as one day entry.
// Account side uses delivery.todayKg (authoritative per-account total).
// Centre side uses allocation.kgAllocated letter totals (farm-wide picking breakdown).
teaRouter.get('/reconciliation', async (req, res, next) => {
  try {
    const now = new Date()
    const year  = req.query.year  ? parseInt(req.query.year  as string) : now.getFullYear()
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd   = new Date(year, month,     0, 23, 59, 59)

    const deliveries = await prisma.teaSmsDelivery.findMany({
      where: { deliveryDate: { gte: monthStart, lte: monthEnd } },
      orderBy: { deliveryDate: 'asc' },
      include: {
        smsRecord: { select: { id: true, rawSms: true, receivedAt: true } },
        centre:    { select: { canonicalName: true } },
        allocations: {
          include: { ktdaAccount: { select: { id: true, accountCode: true, holderName: true } } },
        },
      },
    })

    const floatTopups = await prisma.supervisorFloatTopUp.findMany({
      where: { topupDate: { gte: monthStart, lte: monthEnd } },
      orderBy: { topupDate: 'asc' },
    })

    // Group deliveries by SMS record
    type SmsEntry = {
      smsRecordId: string
      date: string
      receivedAt: string | null
      rawSmsSnippet: string
      accounts: Map<string, { accountCode: string; holderName: string; todayKg: number }>
      centres: Map<string, { centreName: string; letters: Map<string, number> }>
      casualKg: number | null
      casualPayKes: number | null
      supervisorFloat: number | null
    }
    const smsMap = new Map<string, SmsEntry>()

    for (const d of deliveries) {
      const smsId = d.smsRecordId
      if (!smsMap.has(smsId)) {
        smsMap.set(smsId, {
          smsRecordId:   smsId,
          date:          d.deliveryDate.toISOString().split('T')[0],
          receivedAt:    d.smsRecord.receivedAt?.toISOString() ?? null,
          rawSmsSnippet: (d.smsRecord.rawSms ?? '').slice(0, 100),
          accounts:      new Map(),
          centres:       new Map(),
          casualKg:      null,
          casualPayKes:  null,
          supervisorFloat: null,
        })
      }
      const entry = smsMap.get(smsId)!

      // Casual / float — take from first delivery row of this SMS
      if (entry.casualKg === null && d.casualKg != null)          entry.casualKg      = Number(d.casualKg)
      if (entry.casualPayKes === null && d.casualPayKes != null)   entry.casualPayKes  = Number(d.casualPayKes)
      if (entry.supervisorFloat === null && d.supervisorFloat != null) entry.supervisorFloat = Number(d.supervisorFloat)

      // Accounts side — deduplicate by account; use delivery todayKg
      const seenAccounts = new Set<string>()
      for (const alloc of d.allocations) {
        const acct = alloc.ktdaAccount
        if (!acct || seenAccounts.has(acct.id)) continue
        seenAccounts.add(acct.id)
        if (!entry.accounts.has(acct.id)) {
          entry.accounts.set(acct.id, {
            accountCode: acct.accountCode,
            holderName:  acct.holderName,
            todayKg:     Number(d.todayKg ?? 0),
          })
        }
      }

      // Centres side — accumulate letter kg per centre
      const centreName = d.centre?.canonicalName ?? d.centreRawName ?? 'Unknown'
      if (!entry.centres.has(centreName)) {
        entry.centres.set(centreName, { centreName, letters: new Map() })
      }
      const centreEntry = entry.centres.get(centreName)!
      for (const alloc of d.allocations) {
        const letter = alloc.accountCode
        centreEntry.letters.set(letter, (centreEntry.letters.get(letter) ?? 0) + Number(alloc.kgAllocated))
      }
    }

    // Serialise to response shape
    const days = Array.from(smsMap.values()).map(entry => {
      const accountTotal = Array.from(entry.accounts.values()).reduce((s, a) => s + a.todayKg, 0)
      const centreTotal  = Array.from(entry.centres.values()).reduce((s, c) =>
        s + Array.from(c.letters.values()).reduce((cs, kg) => cs + kg, 0), 0)

      return {
        smsRecordId:    entry.smsRecordId,
        date:           entry.date,
        rawSmsSnippet:  entry.rawSmsSnippet,
        accounts:       Array.from(entry.accounts.values()),
        centres: Array.from(entry.centres.values()).map(c => ({
          centreName:  c.centreName,
          letters:     Array.from(c.letters.entries()).map(([letter, kg]) => ({ letter, kg: Math.round(kg * 10) / 10 })),
          centreTotal: Math.round(Array.from(c.letters.values()).reduce((s, kg) => s + kg, 0) * 10) / 10,
        })),
        accountTotal:    Math.round(accountTotal * 10) / 10,
        centreTotal:     Math.round(centreTotal  * 10) / 10,
        match:           Math.abs(accountTotal - centreTotal) < 0.5,
        casualKg:        entry.casualKg,
        casualPayKes:    entry.casualPayKes,
        supervisorFloat: entry.supervisorFloat,
      }
    })

    // Month totals
    const totalAccountKg    = days.reduce((s, d) => s + d.accountTotal, 0)
    const totalCentreKg     = days.reduce((s, d) => s + d.centreTotal,  0)
    const totalCasualKg     = days.reduce((s, d) => s + (d.casualKg ?? 0), 0)
    const totalCasualPayKes = days.reduce((s, d) => s + (d.casualPayKes ?? 0), 0)
    const totalFloatTopups  = floatTopups.reduce((s, t) => s + Number(t.amountKes), 0)

    // Current float = supervisorFloat from the most recent SMS day
    const latestDay = days.length > 0 ? days[days.length - 1] : null
    const currentFloatBalance = latestDay?.supervisorFloat ?? null

    res.json({
      year, month,
      days,
      totalAccountKg:    Math.round(totalAccountKg * 10) / 10,
      totalCentreKg:     Math.round(totalCentreKg  * 10) / 10,
      grandMatch:        Math.abs(totalAccountKg - totalCentreKg) < 0.5,
      totalCasualKg:     Math.round(totalCasualKg * 10) / 10,
      totalCasualPayKes: Math.round(totalCasualPayKes),
      currentFloatBalance,
      totalFloatTopups,
      floatTopups: floatTopups.map(t => ({
        id:        t.id,
        topupDate: t.topupDate.toISOString().split('T')[0],
        amountKes: Number(t.amountKes),
        note:      t.note,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/tea/float/topups — record a cash top-up given to the supervisor
teaRouter.post('/float/topups', async (req, res, next) => {
  try {
    const { topupDate, amountKes, note } = req.body as { topupDate: string; amountKes: number; note?: string }
    if (!amountKes || amountKes <= 0) {
      res.status(400).json({ error: 'amountKes must be a positive number' })
      return
    }
    const topup = await prisma.supervisorFloatTopUp.create({
      data: { topupDate: new Date(topupDate), amountKes, note: note ?? null },
    })
    res.status(201).json({
      ...topup,
      topupDate: topup.topupDate.toISOString().split('T')[0],
      amountKes: Number(topup.amountKes),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/tea/float/topups?year=&month= — list top-ups
teaRouter.get('/float/topups', async (req, res, next) => {
  try {
    const { year, month } = req.query as Record<string, string>
    let where = {}
    if (year && month) {
      const y = parseInt(year), m = parseInt(month)
      where = { topupDate: { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) } }
    }
    const topups = await prisma.supervisorFloatTopUp.findMany({
      where,
      orderBy: { topupDate: year && month ? 'asc' : 'desc' },
      ...(year && month ? {} : { take: 50 }),
    })
    res.json(topups.map(t => ({
      ...t,
      topupDate: t.topupDate.toISOString().split('T')[0],
      amountKes: Number(t.amountKes),
    })))
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/tea/picking/scan ───────────────────────────────────────────
// Accepts a base64 photo of a picking register, uses Claude vision to extract
// picker names and kg picked. Returns an array of { name, kg } rows.
// No data is saved — the manager reviews then submits via POST /api/tea/sessions.
import Anthropic from '@anthropic-ai/sdk'
const _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

teaRouter.post('/picking/scan', async (req, res, next) => {
  try {
    const { imageData } = req.body as { imageData: string }
    if (!imageData) { res.status(400).json({ error: 'imageData required' }); return }

    const base64    = imageData.replace(/^data:image\/\w+;base64,/, '')
    const mimeMatch = imageData.match(/^data:(image\/\w+);base64,/)
    const mediaType = (mimeMatch?.[1] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

    const response = await _anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: `This is a handwritten tea picking register from a Kenyan farm. Each row shows a picker's name and the kilograms of tea they picked today. Extract ALL rows and return ONLY valid JSON:
{
  "date": "YYYY-MM-DD or null",
  "sector": "area/sector name if visible or null",
  "pickers": [
    { "name": "picker name", "kg": number }
  ]
}
Include every row you can read. If a value is unclear use your best guess. No explanation, just JSON.`,
          },
        ],
      }],
    })

    let parsed: { date?: string | null; sector?: string | null; pickers?: { name: string; kg: number }[] } = {}
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      res.status(422).json({ error: 'Could not parse register', pickers: [] })
      return
    }

    res.json({
      date:    parsed.date    ?? null,
      sector:  parsed.sector  ?? null,
      pickers: (parsed.pickers ?? []).filter(p => p.name && p.kg > 0),
    })
  } catch (err) { next(err) }
})
