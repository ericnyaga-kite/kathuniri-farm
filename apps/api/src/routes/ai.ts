import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { chat } from '../services/aiAssistant'
import { prisma } from '../db/client'

export const aiRouter = Router()

const chatSchema = z.object({
  query: z.string().min(1).max(1000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
})

// POST /api/ai/chat
aiRouter.post('/chat', async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  try {
    const answer = await chat(parsed.data.query, parsed.data.history)
    res.json({ answer })
  } catch (err) {
    console.error('AI chat error:', err)
    res.status(500).json({ error: 'Failed to get response' })
  }
})

// GET /api/ai/insights — today's active insights
aiRouter.get('/insights', async (_req: Request, res: Response) => {
  const insights = await prisma.aiInsight.findMany({
    where: { status: 'active' },
    orderBy: [{ generatedDate: 'desc' }, { confidence: 'asc' }],
    take: 20,
  })
  res.json(insights)
})

// PATCH /api/ai/insights/:id/dismiss
aiRouter.patch('/insights/:id/dismiss', async (req: Request, res: Response) => {
  const { id } = req.params
  const insight = await prisma.aiInsight.update({
    where: { id },
    data: { status: 'dismissed', dismissedAt: new Date() },
  })
  res.json(insight)
})
