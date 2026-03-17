import { Router } from 'express'
import { prisma } from '../db/client'

export const payrollRouter = Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function coerceRecord(r: Record<string, unknown>) {
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

// ─── GET /api/payroll/runs?year=&month= ──────────────────────────────────────
// List payroll runs. If year+month supplied, returns that single run (or null).
// Otherwise returns the last 6 distinct runs.

payrollRouter.get('/runs', async (req, res, next) => {
  try {
    const { year, month } = req.query as { year?: string; month?: string }

    if (year && month) {
      const run = await prisma.monthlyPayrollRun.findFirst({
        where: { periodYear: parseInt(year), periodMonth: parseInt(month) },
      })
      res.json(run ?? null)
      return
    }

    const runs = await prisma.monthlyPayrollRun.findMany({
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: 6,
    })
    res.json(runs)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/payroll/runs/:id ────────────────────────────────────────────────
// Run detail with all records + staff info.

payrollRouter.get('/runs/:id', async (req, res, next) => {
  try {
    const run = await prisma.monthlyPayrollRun.findUnique({
      where: { id: req.params.id },
    })
    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' })
      return
    }

    const records = await prisma.monthlyPayrollRecord.findMany({
      where: { payrollRunId: run.id },
      include: {
        staff: {
          select: {
            fullName: true,
            employmentType: true,
            paymentMethod: true,
            mpesaNumber: true,
          },
        },
      },
      orderBy: { staff: { fullName: 'asc' } },
    })

    res.json({
      ...run,
      records: records.map(r => coerceRecord(r as unknown as Record<string, unknown>)),
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/payroll/runs ───────────────────────────────────────────────────
// Create a draft payroll run and auto-populate records for all permanent +
// contract staff members (monthlySalary > 0).

payrollRouter.post('/runs', async (req, res, next) => {
  try {
    const { periodMonth, periodYear } = req.body as {
      periodMonth: number
      periodYear: number
    }

    if (!periodMonth || !periodYear) {
      res.status(400).json({ error: 'periodMonth and periodYear are required' })
      return
    }

    // Return existing run if already created
    const existing = await prisma.monthlyPayrollRun.findFirst({
      where: { periodMonth, periodYear },
    })
    if (existing) {
      const records = await prisma.monthlyPayrollRecord.findMany({
        where: { payrollRunId: existing.id },
        include: {
          staff: {
            select: {
              fullName: true,
              employmentType: true,
              paymentMethod: true,
              mpesaNumber: true,
            },
          },
        },
        orderBy: { staff: { fullName: 'asc' } },
      })
      res.json({
        ...existing,
        records: records.map(r => coerceRecord(r as unknown as Record<string, unknown>)),
      })
      return
    }

    // Fetch permanent + contract staff with salary
    const staffList = await prisma.staff.findMany({
      where: {
        active: true,
        employmentType: { in: ['permanent', 'contract'] },
        monthlySalary: { not: null },
      },
      include: {
        advances: {
          where: { fullyRecovered: false },
          select: { amountKes: true, amountRecovered: true },
        },
      },
    })

    const run = await prisma.monthlyPayrollRun.create({
      data: { periodMonth, periodYear, status: 'draft' },
    })

    // Create one record per staff member
    for (const s of staffList) {
      const gross = Number(s.monthlySalary ?? 0)
      const advanceDeduction = s.advances.reduce(
        (sum, adv) => sum + (Number(adv.amountKes) - Number(adv.amountRecovered)),
        0,
      )
      const roundedAdvance = Math.round(advanceDeduction * 100) / 100
      const netPay = Math.max(0, gross - roundedAdvance)

      await prisma.monthlyPayrollRecord.create({
        data: {
          payrollRunId:    run.id,
          staffId:         s.id,
          grossSalary:     gross,
          advanceDeduction: roundedAdvance,
          nhifDeduction:   0,
          nssfDeduction:   0,
          otherDeductions: 0,
          netPay,
          paymentMethod:   s.paymentMethod,
          mpesaRef:        null,
          paymentDate:     null,
        },
      })
    }

    const records = await prisma.monthlyPayrollRecord.findMany({
      where: { payrollRunId: run.id },
      include: {
        staff: {
          select: {
            fullName: true,
            employmentType: true,
            paymentMethod: true,
            mpesaNumber: true,
          },
        },
      },
      orderBy: { staff: { fullName: 'asc' } },
    })

    res.status(201).json({
      ...run,
      records: records.map(r => coerceRecord(r as unknown as Record<string, unknown>)),
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/payroll/runs/:id/approve ──────────────────────────────────────
// Approve a draft run → status = 'approved'.

payrollRouter.post('/runs/:id/approve', async (req, res, next) => {
  try {
    const run = await prisma.monthlyPayrollRun.findUnique({
      where: { id: req.params.id },
    })
    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' })
      return
    }
    if (run.status !== 'draft') {
      res.status(400).json({ error: 'Run is not in draft status' })
      return
    }

    const updated = await prisma.monthlyPayrollRun.update({
      where: { id: run.id },
      data: { status: 'approved', approvedAt: new Date() },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/payroll/records/:id ──────────────────────────────────────────
// Update a payroll record (otherDeductions, paymentDate, mpesaRef, paymentMethod).

payrollRouter.patch('/records/:id', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (body.otherDeductions !== undefined) {
      data.otherDeductions = Number(body.otherDeductions)
    }
    if (body.paymentMethod !== undefined) {
      data.paymentMethod = String(body.paymentMethod)
    }
    if (body.mpesaRef !== undefined) {
      data.mpesaRef = body.mpesaRef ? String(body.mpesaRef) : null
    }
    if (body.paymentDate !== undefined) {
      data.paymentDate = body.paymentDate ? new Date(String(body.paymentDate)) : null
    }

    // Recalculate netPay if otherDeductions changed
    if (data.otherDeductions !== undefined) {
      const record = await prisma.monthlyPayrollRecord.findUnique({
        where: { id: req.params.id },
      })
      if (record) {
        const gross    = Number(record.grossSalary)
        const advance  = Number(record.advanceDeduction)
        const nhif     = Number(record.nhifDeduction)
        const nssf     = Number(record.nssfDeduction)
        const other    = Number(data.otherDeductions)
        data.netPay    = Math.max(0, gross - advance - nhif - nssf - other)
      }
    }

    const updated = await prisma.monthlyPayrollRecord.update({
      where: { id: req.params.id },
      data,
      include: {
        staff: {
          select: {
            fullName: true,
            employmentType: true,
            paymentMethod: true,
            mpesaNumber: true,
          },
        },
      },
    })

    res.json(coerceRecord(updated as unknown as Record<string, unknown>))
  } catch (err) {
    next(err)
  }
})
