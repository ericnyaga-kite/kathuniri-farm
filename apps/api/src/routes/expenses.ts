import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db/client'

export const expensesRouter = Router()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
        expenseDate:    new Date(String(body.expenseDate)),
        enterprise:     String(body.enterprise),
        account:        String(body.account),
        amountKes:      Number(body.amountKes),
        description:    body.description    ? String(body.description)    : null,
        vendor:         body.vendor         ? String(body.vendor)         : null,
        receiptImageId: body.receiptImageId ? String(body.receiptImageId) : null,
        paymentMethod:  body.paymentMethod  ? String(body.paymentMethod)  : null,
        mpesaRef:       body.mpesaRef       ? String(body.mpesaRef)       : null,
        approved:       false,
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

// ─── POST /api/expenses/scan ──────────────────────────────────────────────────
// Body: { imageBase64: string }  — bare base64 or with data: prefix
// Calls Claude Haiku vision to extract receipt data. Does NOT save to DB.
// Returns extracted JSON for manager review.

expensesRouter.post('/scan', async (req, res, next) => {
  try {
    const { imageBase64 } = req.body as { imageBase64?: string }

    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 is required' })
      return
    }

    // Strip data URI prefix to get pure base64
    const base64    = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/)
    const mediaType = (mimeMatch?.[1] ?? 'image/jpeg') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp'
      | 'image/gif'

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `You are reading a purchase receipt or invoice from a Kenyan shop/supplier.
Extract the following in JSON:
{
  "vendor": "shop or supplier name",
  "date": "YYYY-MM-DD or null if unclear",
  "items": [{ "name": "item description", "qty": number, "unitPrice": number, "total": number }],
  "totalAmount": number,
  "paymentMethod": "cash|mpesa|credit|unknown",
  "mpesaRef": "ref code if visible or null",
  "suggestedEnterprise": "tea|dairy|rental|crops|staff|general"
}
Return ONLY valid JSON.`,
            },
          ],
        },
      ],
    })

    const rawText =
      response.content[0].type === 'text' ? response.content[0].text : '{}'

    let extracted: Record<string, unknown> = {}
    try {
      extracted = JSON.parse(rawText.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      // Return raw text so client can display a parse-error message
      res.status(422).json({ error: 'Could not parse Claude response', raw: rawText })
      return
    }

    res.json(extracted)
  } catch (err) {
    next(err)
  }
})
