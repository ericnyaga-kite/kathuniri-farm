import { Router } from 'express'
import { prisma } from '../db/client'
import { parseTeaSms } from '../services/teaSmsParser'

export const smsRouter = Router()

// ---------------------------------------------------------------------------
// SMS sender registry — add new sources here.
// Key: normalised phone (07xx format). Value: parser function.
// ---------------------------------------------------------------------------
type SmsParser = (raw: string, recordId: string, ts: Date) => Promise<void>

const SENDER_REGISTRY: Record<string, SmsParser> = {
  '0706484749': parseTeaSms,   // Cathy Tea — daily green leaf picking
  // '0712345678': parseMpesa, // example: add M-PESA notifications
}

function normPhone(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/^\+254/, '0').replace(/^254/, '0')
}

async function handleIncoming(sender: string, message: string, receivedAt: Date, source = 'live') {
  const phone = normPhone(sender)

  const parser = SENDER_REGISTRY[phone]
  if (!parser) {
    // No parser configured — park in holding for inspection/testing
    await prisma.smsHoldingRecord.create({
      data: { receivedAt, senderPhone: phone, rawSms: message, source },
    })
    return
  }

  const record = await prisma.teaSmsRecord.create({
    data: { receivedAt, senderPhone: phone, rawSms: message, parsed: false, source },
  })

  // Parse in background — respond fast to the Android app
  parser(message, record.id, receivedAt).catch(err => {
    console.error(`[SMS] Parse failed for ${phone}:`, err)
    prisma.teaSmsRecord.update({
      where: { id: record.id },
      data: { parseError: String(err) },
    }).catch(() => {})
  })
}

// ---------------------------------------------------------------------------
// POST /api/sms
// Called by the Kathuniri SMS Utility Android app on the farm manager's phone.
// Body: { secret, sender, message, receivedAt? }
// ---------------------------------------------------------------------------
smsRouter.post('/', async (req, res, next) => {
  try {
    const { secret, sender, message, receivedAt, source } = req.body as {
      secret: string; sender: string; message: string; receivedAt?: string; source?: string
    }

    if (secret !== process.env.SMS_UTILITY_SECRET) {
      return res.status(401).json({ error: 'Unauthorised' })
    }
    if (!sender || !message) {
      return res.status(400).json({ error: 'sender and message required' })
    }

    const ts = receivedAt ? new Date(receivedAt) : new Date()
    await handleIncoming(sender, message, ts, source ?? 'live')
    return res.json({ received: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/sms/bulk — import multiple historical SMS messages (same secret + sender format)
// Body: { secret, messages: [{ sender, message, receivedAt }] }
// Processes each one exactly like the single /api/sms endpoint.
// Skips duplicates (same sender + message + same day already stored).
smsRouter.post('/bulk', async (req, res, next) => {
  try {
    const { secret, messages, source: bulkSource } = req.body as {
      secret: string
      messages: Array<{ sender: string; message: string; receivedAt: string }>
      source?: string  // optional per-batch source; individual messages can override
    }

    if (secret !== process.env.SMS_UTILITY_SECRET) {
      return res.status(401).json({ error: 'Unauthorised' })
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' })
    }

    const results: { receivedAt: string; sender: string; status: 'stored' | 'duplicate' | 'error'; id?: string; error?: string }[] = []

    for (const msg of messages) {
      try {
        const phone = normPhone(msg.sender)
        const ts = new Date(msg.receivedAt)
        const dayStart = new Date(ts); dayStart.setHours(0, 0, 0, 0)
        const dayEnd   = new Date(ts); dayEnd.setHours(23, 59, 59, 999)

        // Skip if already stored (same sender, same message text, same day)
        const existing = await prisma.teaSmsRecord.findFirst({
          where: {
            senderPhone: phone,
            rawSms: msg.message,
            receivedAt: { gte: dayStart, lte: dayEnd },
          },
        })

        if (existing) {
          results.push({ receivedAt: msg.receivedAt, sender: phone, status: 'duplicate', id: existing.id })
          continue
        }

        await handleIncoming(msg.sender, msg.message, ts, bulkSource ?? 'historical')
        results.push({ receivedAt: msg.receivedAt, sender: phone, status: 'stored' })
      } catch (err) {
        results.push({ receivedAt: msg.receivedAt, sender: msg.sender, status: 'error', error: String(err) })
      }
    }

    return res.json({
      total: messages.length,
      stored: results.filter(r => r.status === 'stored').length,
      duplicates: results.filter(r => r.status === 'duplicate').length,
      errors: results.filter(r => r.status === 'error').length,
      results,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/sms/recent — last 20 parsed SMS records (owner use)
smsRouter.get('/recent', async (_req, res, next) => {
  try {
    const records = await prisma.teaSmsRecord.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 20,
      include: { deliveries: { include: { allocations: true } } },
    })
    res.json(records)
  } catch (err) {
    next(err)
  }
})

// GET /api/sms/holding — messages received but no parser configured
smsRouter.get('/holding', async (_req, res, next) => {
  try {
    const records = await prisma.smsHoldingRecord.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 50,
    })
    res.json(records)
  } catch (err) {
    next(err)
  }
})
