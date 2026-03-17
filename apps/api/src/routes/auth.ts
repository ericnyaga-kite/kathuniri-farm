import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { prisma } from '../db/client'

export const authRouter = Router()

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const OWNER_EMAIL  = process.env.OWNER_EMAIL ?? 'eric.nyaga@kiteholdings.biz'

// POST /api/auth/google
// Body: { credential } — the Google ID token from the sign-in button
authRouter.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body as { credential: string }
    if (!credential) return res.status(400).json({ error: 'credential required' })

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    if (!payload?.email) return res.status(401).json({ error: 'Invalid token' })

    const email = payload.email.toLowerCase()
    const name  = payload.name ?? email

    let role: 'owner' | 'viewer' | null = null
    if (email === OWNER_EMAIL.toLowerCase()) {
      role = 'owner'
    } else {
      const viewer = await prisma.viewerPermission.findUnique({ where: { email } })
      if (viewer) role = 'viewer'
    }

    if (!role) {
      return res.status(403).json({ error: 'Not authorised — contact the farm owner.' })
    }

    const token = jwt.sign(
      { id: email, email, name, role },
      process.env.JWT_SECRET ?? 'dev-secret',
      { expiresIn: '30d' }
    )

    res.json({ token, user: { id: email, name, role } })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/manager-pin — returns current manager PIN (no auth — needed by login page offline-first)
authRouter.get('/manager-pin', async (_req, res, next) => {
  try {
    const setting = await prisma.systemConfig.findUnique({ where: { key: 'manager_pin' } })
    res.json({ pin: setting?.value ?? '5678' })
  } catch (err) { next(err) }
})

// PATCH /api/auth/manager-pin — update PIN (owner only)
authRouter.patch('/manager-pin', requireOwner, async (req, res, next) => {
  try {
    const { pin } = req.body as { pin: string }
    if (!pin || !/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4–8 digits' })
    }
    await prisma.systemConfig.upsert({
      where:  { key: 'manager_pin' },
      update: { value: pin },
      create: { key: 'manager_pin', value: pin },
    })
    res.json({ updated: true })
  } catch (err) { next(err) }
})

// GET /api/auth/viewers — list approved viewer emails (owner only)
authRouter.get('/viewers', requireOwner, async (_req, res, next) => {
  try {
    const viewers = await prisma.viewerPermission.findMany({ orderBy: { addedAt: 'asc' } })
    res.json(viewers)
  } catch (err) { next(err) }
})

// POST /api/auth/viewers — add a viewer email (owner only)
authRouter.post('/viewers', requireOwner, async (req, res, next) => {
  try {
    const { email, name } = req.body as { email: string; name?: string }
    if (!email) return res.status(400).json({ error: 'email required' })
    const viewer = await prisma.viewerPermission.upsert({
      where:  { email: email.toLowerCase() },
      update: { name },
      create: { email: email.toLowerCase(), name },
    })
    res.status(201).json(viewer)
  } catch (err) { next(err) }
})

// DELETE /api/auth/viewers/:email — remove a viewer (owner only)
authRouter.delete('/viewers/:email', requireOwner, async (req, res, next) => {
  try {
    await prisma.viewerPermission.delete({ where: { email: req.params.email } })
    res.json({ removed: true })
  } catch (err) { next(err) }
})

export function requireOwner(req: any, res: any, next: any) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as any
    if (payload.role !== 'owner') return res.status(403).json({ error: 'Owner only' })
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
