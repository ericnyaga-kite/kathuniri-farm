import { Router } from 'express'
import { prisma } from '../db/client'

export const staffRouter = Router()

// ─── Helper ──────────────────────────────────────────────────────────────────

function coerceStaff(s: Record<string, unknown>) {
  return {
    ...s,
    monthlySalary:   s.monthlySalary   != null ? Number(s.monthlySalary)   : null,
    dailyRate:       s.dailyRate        != null ? Number(s.dailyRate)        : null,
    pickerRatePerKg: s.pickerRatePerKg  != null ? Number(s.pickerRatePerKg)  : null,
  }
}

function coerceAdvance(a: Record<string, unknown>) {
  return {
    ...a,
    amountKes:       Number(a.amountKes),
    amountRecovered: Number(a.amountRecovered),
  }
}

function coercePayrollRecord(r: Record<string, unknown>) {
  return {
    ...r,
    grossSalary:      Number(r.grossSalary),
    advanceDeduction: Number(r.advanceDeduction),
    nhifDeduction:    Number(r.nhifDeduction),
    nssfDeduction:    Number(r.nssfDeduction),
    otherDeductions:  Number(r.otherDeductions),
    netPay:           Number(r.netPay),
  }
}

// ─── GET /api/staff ───────────────────────────────────────────────────────────
// All active staff ordered by fullName, with outstanding advance balance.

staffRouter.get('/', async (_req, res, next) => {
  try {
    const staffList = await prisma.staff.findMany({
      where: { active: true },
      orderBy: { fullName: 'asc' },
      include: {
        advances: {
          where: { fullyRecovered: false },
          select: { amountKes: true, amountRecovered: true },
        },
      },
    })

    const result = staffList.map(s => {
      const outstandingAdvanceKes = s.advances.reduce(
        (sum, adv) => sum + (Number(adv.amountKes) - Number(adv.amountRecovered)),
        0,
      )
      const { advances, ...rest } = s
      return {
        ...coerceStaff(rest as Record<string, unknown>),
        outstandingAdvanceKes: Math.round(outstandingAdvanceKes * 100) / 100,
      }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/staff/advances/outstanding ─────────────────────────────────────
// All advances where fullyRecovered=false, with staff name, ordered by advanceDate asc.
// NOTE: Must be registered before /:id so Express doesn't treat "advances" as an id.

staffRouter.get('/advances/outstanding', async (_req, res, next) => {
  try {
    const advances = await prisma.advance.findMany({
      where: { fullyRecovered: false },
      orderBy: { advanceDate: 'asc' },
      include: {
        staff: { select: { fullName: true } },
      },
    })

    const result = advances.map(adv => ({
      ...coerceAdvance(adv as unknown as Record<string, unknown>),
      outstandingBalance:
        Math.round((Number(adv.amountKes) - Number(adv.amountRecovered)) * 100) / 100,
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/staff/payroll/summary?year=YYYY&month=M ────────────────────────
// Monthly payroll totals + per-record list with staff names.
// NOTE: Must be registered before /:id.

staffRouter.get('/payroll/summary', async (req, res, next) => {
  try {
    const now = new Date()
    const year  = req.query.year  ? parseInt(req.query.year  as string) : now.getFullYear()
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1

    // Find the payroll run for this period (if any)
    const run = await prisma.monthlyPayrollRun.findFirst({
      where: { periodYear: year, periodMonth: month },
    })

    if (!run) {
      res.json({
        year,
        month,
        run: null,
        totals: { totalGross: 0, totalNet: 0, totalAdvancesDeducted: 0, staffPaidCount: 0 },
        records: [],
      })
      return
    }

    const records = await prisma.monthlyPayrollRecord.findMany({
      where: { payrollRunId: run.id },
      include: {
        staff: { select: { fullName: true, employmentType: true, paymentMethod: true } },
      },
      orderBy: { staff: { fullName: 'asc' } },
    })

    const totals = records.reduce(
      (acc, r) => {
        acc.totalGross            += Number(r.grossSalary)
        acc.totalNet              += Number(r.netPay)
        acc.totalAdvancesDeducted += Number(r.advanceDeduction)
        if (r.paymentDate) acc.staffPaidCount += 1
        return acc
      },
      { totalGross: 0, totalNet: 0, totalAdvancesDeducted: 0, staffPaidCount: 0 },
    )

    res.json({
      year,
      month,
      run: { id: run.id, status: run.status, periodMonth: run.periodMonth, periodYear: run.periodYear },
      totals: {
        totalGross:            Math.round(totals.totalGross * 100) / 100,
        totalNet:              Math.round(totals.totalNet * 100) / 100,
        totalAdvancesDeducted: Math.round(totals.totalAdvancesDeducted * 100) / 100,
        staffPaidCount:        totals.staffPaidCount,
      },
      records: records.map(r => ({
        ...coercePayrollRecord(r as unknown as Record<string, unknown>),
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/staff ──────────────────────────────────────────────────────────
staffRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>
    const staff = await prisma.staff.create({
      data: {
        fullName:        String(body.fullName),
        nationalId:      body.nationalId      ? String(body.nationalId)      : null,
        phone:           body.phone           ? String(body.phone)           : null,
        employmentType:  String(body.employmentType ?? 'permanent'),
        startDate:       body.startDate       ? new Date(String(body.startDate)) : null,
        monthlySalary:   body.monthlySalary   != null ? Number(body.monthlySalary)   : null,
        dailyRate:       body.dailyRate       != null ? Number(body.dailyRate)       : null,
        pickerRatePerKg: body.pickerRatePerKg != null ? Number(body.pickerRatePerKg) : null,
        paymentMethod:   String(body.paymentMethod ?? 'cash'),
        mpesaNumber:     body.mpesaNumber     ? String(body.mpesaNumber)     : null,
        active:          true,
      },
    })
    res.status(201).json(coerceStaff(staff as unknown as Record<string, unknown>))
  } catch (err) { next(err) }
})

// ─── PATCH /api/staff/:id ─────────────────────────────────────────────────────
staffRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (body.fullName        !== undefined) data.fullName        = String(body.fullName)
    if (body.nationalId      !== undefined) data.nationalId      = body.nationalId ? String(body.nationalId) : null
    if (body.phone           !== undefined) data.phone           = body.phone ? String(body.phone) : null
    if (body.employmentType  !== undefined) data.employmentType  = String(body.employmentType)
    if (body.startDate       !== undefined) data.startDate       = body.startDate ? new Date(String(body.startDate)) : null
    if (body.monthlySalary   !== undefined) data.monthlySalary   = body.monthlySalary != null ? Number(body.monthlySalary) : null
    if (body.dailyRate       !== undefined) data.dailyRate       = body.dailyRate != null ? Number(body.dailyRate) : null
    if (body.pickerRatePerKg !== undefined) data.pickerRatePerKg = body.pickerRatePerKg != null ? Number(body.pickerRatePerKg) : null
    if (body.paymentMethod   !== undefined) data.paymentMethod   = String(body.paymentMethod)
    if (body.mpesaNumber     !== undefined) data.mpesaNumber     = body.mpesaNumber ? String(body.mpesaNumber) : null
    if (body.active          !== undefined) data.active          = Boolean(body.active)
    const staff = await prisma.staff.update({ where: { id: req.params.id }, data })
    res.json(coerceStaff(staff as unknown as Record<string, unknown>))
  } catch (err) { next(err) }
})

// ─── POST /api/staff/payroll/runs ────────────────────────────────────────────
// Create a MonthlyPayrollRun (status=draft) if one doesn't exist for that month.
// NOTE: Must be registered before /:id.

staffRouter.post('/payroll/runs', async (req, res, next) => {
  try {
    const { periodMonth, periodYear } = req.body as {
      periodMonth: number
      periodYear: number
    }

    if (!periodMonth || !periodYear) {
      res.status(400).json({ error: 'periodMonth and periodYear are required' })
      return
    }

    const existing = await prisma.monthlyPayrollRun.findFirst({
      where: { periodMonth, periodYear },
    })

    if (existing) {
      res.json(existing)
      return
    }

    const run = await prisma.monthlyPayrollRun.create({
      data: { periodMonth, periodYear, status: 'draft' },
    })

    res.status(201).json(run)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/staff/:id ───────────────────────────────────────────────────────
// Staff detail with all advances (including deductions) and last 3 payroll records.

staffRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        advances: {
          orderBy: { advanceDate: 'desc' },
          include: {
            deductions: {
              orderBy: { deductionDate: 'desc' },
            },
          },
        },
        payrollRecords: {
          orderBy: { payrollRun: { periodYear: 'desc' } },
          take: 3,
          include: {
            payrollRun: { select: { periodMonth: true, periodYear: true, status: true } },
          },
        },
      },
    })

    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' })
      return
    }

    const outstandingAdvanceKes = staff.advances
      .filter(adv => !adv.fullyRecovered)
      .reduce((sum, adv) => sum + (Number(adv.amountKes) - Number(adv.amountRecovered)), 0)

    res.json({
      ...coerceStaff(staff as unknown as Record<string, unknown>),
      outstandingAdvanceKes: Math.round(outstandingAdvanceKes * 100) / 100,
      advances: staff.advances.map(adv => ({
        ...coerceAdvance(adv as unknown as Record<string, unknown>),
        outstandingBalance:
          Math.round((Number(adv.amountKes) - Number(adv.amountRecovered)) * 100) / 100,
        deductions: adv.deductions.map(d => ({
          ...d,
          amountDeducted: Number(d.amountDeducted),
        })),
      })),
      payrollRecords: staff.payrollRecords.map(r =>
        coercePayrollRecord(r as unknown as Record<string, unknown>),
      ),
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/staff/:id/advances ────────────────────────────────────────────
// Create an advance for the given staff member.

staffRouter.post('/:id/advances', async (req, res, next) => {
  try {
    const { id } = req.params
    const { advanceDate, amountKes, reason } = req.body as {
      advanceDate: string
      amountKes: number
      reason?: string
    }

    if (!advanceDate || !amountKes) {
      res.status(400).json({ error: 'advanceDate and amountKes are required' })
      return
    }

    if (amountKes <= 0) {
      res.status(400).json({ error: 'amountKes must be a positive number' })
      return
    }

    const staff = await prisma.staff.findUnique({ where: { id } })
    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' })
      return
    }

    const advance = await prisma.advance.create({
      data: {
        staffId:         id,
        advanceDate:     new Date(advanceDate),
        amountKes,
        reason:          reason ?? null,
        amountRecovered: 0,
        fullyRecovered:  false,
      },
    })

    res.status(201).json(coerceAdvance(advance as unknown as Record<string, unknown>))
  } catch (err) {
    next(err)
  }
})
