import { Router } from 'express'
import { prisma } from '../db/client'
import { parseTeaSms } from '../services/teaSmsParser'

export const smsRouter = Router()

const CATHY_PHONE = '0706484749'   // Cathy Tea — the only authorised sender for tea SMS

// POST /api/sms
// Called by the Kathuniri SMS Utility Android app on the farm manager's phone.
// Body: { secret, sender, message, receivedAt? }
smsRouter.post('/', async (req, res, next) => {
  try {
    const { secret, sender, message, receivedAt } = req.body as {
      secret: string
      sender: string
      message: string
      receivedAt?: string
    }

    if (secret !== process.env.SMS_UTILITY_SECRET) {
      return res.status(401).json({ error: 'Unauthorised' })
    }

    if (!sender || !message) {
      return res.status(400).json({ error: 'sender and message required' })
    }

    const normalised = sender.replace(/\s+/g, '').replace(/^\+254/, '0').replace(/^254/, '0')
    const ts = receivedAt ? new Date(receivedAt) : new Date()

    // Store raw SMS
    const record = await prisma.teaSmsRecord.create({
      data: {
        receivedAt: ts,
        senderPhone: normalised,
        rawSms: message,
        parsed: false,
      },
    })

    // Identify and parse in background (don't await — respond fast)
    if (normalised === CATHY_PHONE) {
      parseTeaSms(message, record.id, ts).catch(err => {
        console.error('[SMS] Tea SMS parse failed:', err)
        prisma.teaSmsRecord.update({
          where: { id: record.id },
          data: { parseError: String(err) },
        }).catch(() => {})
      })
    } else {
      console.log(`[SMS] Unknown sender ${normalised} — stored, not parsed`)
    }

    return res.json({ received: true, id: record.id })
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
    const { secret, messages } = req.body as {
      secret: string
      messages: Array<{ sender: string; message: string; receivedAt: string }>
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
        const normalised = msg.sender.replace(/\s+/g, '').replace(/^\+254/, '0').replace(/^254/, '0')
        const ts = new Date(msg.receivedAt)
        const dayStart = new Date(ts); dayStart.setHours(0, 0, 0, 0)
        const dayEnd   = new Date(ts); dayEnd.setHours(23, 59, 59, 999)

        // Skip if already stored (same sender, same message text, same day)
        const existing = await prisma.teaSmsRecord.findFirst({
          where: {
            senderPhone: normalised,
            rawSms: msg.message,
            receivedAt: { gte: dayStart, lte: dayEnd },
          },
        })

        if (existing) {
          results.push({ receivedAt: msg.receivedAt, sender: normalised, status: 'duplicate', id: existing.id })
          continue
        }

        const record = await prisma.teaSmsRecord.create({
          data: { receivedAt: ts, senderPhone: normalised, rawSms: msg.message, parsed: false },
        })

        if (normalised === CATHY_PHONE) {
          parseTeaSms(msg.message, record.id, ts).catch(err => {
            console.error('[SMS bulk] Tea SMS parse failed:', err)
            prisma.teaSmsRecord.update({
              where: { id: record.id },
              data: { parseError: String(err) },
            }).catch(() => {})
          })
        }

        results.push({ receivedAt: msg.receivedAt, sender: normalised, status: 'stored', id: record.id })
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

// GET /api/sms/recent — last 20 SMS records (owner use)
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
