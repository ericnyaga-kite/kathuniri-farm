import { Router } from 'express'
import { prisma } from '../db/client'

export const expensesRouter = Router()

// ─── Helper ───────────────────────────────────────────────────────────────────

function coerceExpense(e: Record<string, unknown>) {
  return {
    ...e,
    amountKes: Number(e.amountKes),
  }
}

// ─── GET /api/expenses?enterprise=&year=&month= ───────────────────────────────

expensesRouter.get('/', async (req, res, next) => {
  try {
    const { enterprise, year, month } = req.query as {
      enterprise?: string
      year?: string
      month?: string
    }

    const where: Record<string, unknown> = {}

    if (enterprise) {
      where.enterprise = enterprise
    }

    if (year && month) {
      const y = parseInt(year)
      const m = parseInt(month)
      const start = new Date(y, m - 1, 1)
      const end   = new Date(y, m, 1)
      where.expenseDate = { gte: start, lt: end }
    } else if (year) {
      const y = parseInt(year)
      where.expenseDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }
    }

    const expenses = await prisma.expenseRecord.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
    })

    res.json(expenses.map(e => coerceExpense(e as unknown as Record<string, unknown>)))
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/expenses ───────────────────────────────────────────────────────

expensesRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>

    if (!body.expenseDate || !body.enterprise || !body.account || !body.amountKes) {
      res.status(400).json({ error: 'expenseDate, enterprise, account and amountKes are required' })
      return
    }

    const expense = await prisma.expenseRecord.create({
      data: {
        expenseDate:   new Date(String(body.expenseDate)),
        enterprise:    String(body.enterprise),
        account:       String(body.account),
        amountKes:     Number(body.amountKes),
        description:   body.description   ? String(body.description)   : null,
        vendor:        body.vendor        ? String(body.vendor)        : null,
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
        mpesaRef:      body.mpesaRef      ? String(body.mpesaRef)      : null,
        approved:      false,
      },
    })

    res.status(201).json(coerceExpense(expense as unknown as Record<string, unknown>))
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/expenses/:id ──────────────────────────────────────────────────

expensesRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (body.approved !== undefined)      data.approved      = Boolean(body.approved)
    if (body.approvedBy !== undefined)    data.approvedBy    = body.approvedBy ? String(body.approvedBy) : null
    if (body.amountKes !== undefined)     data.amountKes     = Number(body.amountKes)
    if (body.description !== undefined)   data.description   = body.description ? String(body.description) : null
    if (body.vendor !== undefined)        data.vendor        = body.vendor ? String(body.vendor) : null
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod ? String(body.paymentMethod) : null
    if (body.mpesaRef !== undefined)      data.mpesaRef      = body.mpesaRef ? String(body.mpesaRef) : null

    const expense = await prisma.expenseRecord.update({
      where: { id: req.params.id },
      data,
    })

    res.json(coerceExpense(expense as unknown as Record<string, unknown>))
  } catch (err) {
    next(err)
  }
})
