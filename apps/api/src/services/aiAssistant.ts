import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db/client'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Context builders ────────────────────────────────────────────────────────
// Each builder fetches the minimal data needed to answer a class of question.

async function buildFarmSummaryContext(): Promise<string> {
  const [cows, milkLast7, ktdaAccounts, openAlerts, recentExpenses] = await Promise.all([
    prisma.cow.findMany({ where: { active: true } }),
    prisma.milkProduction.findMany({
      where: { productionDate: { gte: new Date(Date.now() - 7 * 86400000) } },
      orderBy: { productionDate: 'desc' },
    }),
    prisma.ktdaAccount.findMany({ where: { active: true } }),
    prisma.alert.findMany({ where: { status: 'active' }, take: 10 }),
    prisma.expenseRecord.findMany({
      where: { expenseDate: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { expenseDate: 'desc' },
      take: 30,
    }),
  ])

  return JSON.stringify({ cows, milkLast7, ktdaAccounts, openAlerts, recentExpenses }, null, 2)
}

async function buildDairyContext(cowName?: string): Promise<string> {
  const whereClause = cowName
    ? { name: { contains: cowName, mode: 'insensitive' as const } }
    : {}

  const [cows, production, health, deliveries] = await Promise.all([
    prisma.cow.findMany({ where: { ...whereClause, active: true } }),
    prisma.milkProduction.findMany({
      where: { productionDate: { gte: new Date(Date.now() - 90 * 86400000) } },
      orderBy: { productionDate: 'desc' },
    }),
    prisma.healthEvent.findMany({
      include: { treatments: true },
      where: { eventDate: { gte: new Date('2024-01-01') } },
      orderBy: { eventDate: 'desc' },
    }),
    prisma.milkDelivery.findMany({
      where: { deliveryDate: { gte: new Date(Date.now() - 30 * 86400000) } },
      include: { buyer: true },
    }),
  ])

  return JSON.stringify({ cows, production, health, deliveries }, null, 2)
}

async function buildFinanceContext(): Promise<string> {
  const since = new Date(Date.now() - 365 * 86400000)
  const [expenses, mpesa, ktdaRecords, rentPayments] = await Promise.all([
    prisma.expenseRecord.findMany({
      where: { expenseDate: { gte: since } },
      orderBy: { expenseDate: 'desc' },
    }),
    prisma.mpesaTransaction.findMany({
      where: { transactionAt: { gte: since } },
      orderBy: { transactionAt: 'desc' },
    }),
    prisma.ktdaMonthlyRecord.findMany({
      include: { ktdaAccount: true },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: 24,
    }),
    prisma.rentPayment.findMany({
      where: { paymentDate: { gte: since } },
      include: { room: true },
      orderBy: { paymentDate: 'desc' },
    }),
  ])

  return JSON.stringify({ expenses, mpesa, ktdaRecords, rentPayments }, null, 2)
}

// ─── Query classifier ────────────────────────────────────────────────────────

function classifyQuery(query: string): 'dairy' | 'finance' | 'tea' | 'general' {
  const q = query.toLowerCase()
  if (/cow|ndama|milk|maziwa|vet|mastitis|treatment|health/.test(q)) return 'dairy'
  if (/cost|expense|revenue|pay|rent|money|kes|sh|profit|loss|spend/.test(q)) return 'finance'
  if (/tea|chai|ktda|kg|kilo|account|picking|factory/.test(q)) return 'tea'
  return 'general'
}

// ─── Main chat function ──────────────────────────────────────────────────────

export async function chat(
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> {
  const queryType = classifyQuery(query)

  let context: string
  if (queryType === 'dairy') {
    const cowMatch = query.match(/ndama\s*\w+|cow\s*\w+/i)
    context = await buildDairyContext(cowMatch?.[0])
  } else if (queryType === 'finance') {
    context = await buildFinanceContext()
  } else {
    context = await buildFarmSummaryContext()
  }

  const systemPrompt = `You are a farm management assistant for Kathuniri Farm in Embu County, Kenya.
You have access to the farm's data provided below. Answer questions clearly and concisely.
Use KES for monetary amounts. Use kg for weights. Reference specific animals, accounts, and dates when relevant.
If data is missing or insufficient to answer, say so clearly.
Today's date: ${new Date().toISOString().split('T')[0]}

FARM DATA:
${context}`

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: query },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')
  return content.text
}

// ─── Proactive insights engine ───────────────────────────────────────────────

export async function generateDailyInsights(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  // Don't regenerate if already done today
  const existing = await prisma.aiInsight.findFirst({
    where: { generatedDate: new Date(today) },
  })
  if (existing) return

  const [context, summaryContext] = await Promise.all([
    buildDairyContext(),
    buildFinanceContext(),
  ])

  const prompt = `You are analysing data for Kathuniri Farm, Embu County, Kenya.
Today: ${today}

Based on the farm data below, generate 3–6 proactive insights the owner should know about.
Focus on: health patterns, production trends, financial anomalies, overdue actions, risks.

For each insight return a JSON object:
{
  "category": "health|production|financial|tea|rental|crop|staff|weather",
  "title": "short title (max 8 words)",
  "body": "clear explanation with specific numbers from the data (2-3 sentences)",
  "confidence": "high|medium|low",
  "suggestedAction": "one sentence action or null",
  "supportingData": { key figures used }
}

Return a JSON array of insight objects only. No other text.

DAIRY DATA:
${context}

FINANCE DATA:
${summaryContext}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  let insights: {
    category: string
    title: string
    body: string
    confidence: string
    suggestedAction?: string
    supportingData?: Record<string, unknown>
  }[]

  try {
    insights = JSON.parse(text)
  } catch {
    console.error('Failed to parse insights JSON:', text)
    return
  }

  await prisma.aiInsight.createMany({
    data: insights.map(insight => ({
      generatedDate: new Date(today),
      category: insight.category,
      title: insight.title,
      body: insight.body,
      confidence: insight.confidence,
      suggestedAction: insight.suggestedAction ?? null,
      supportingData: insight.supportingData ?? undefined,
    })),
  })

  console.log(`Generated ${insights.length} insights for ${today}`)
}
