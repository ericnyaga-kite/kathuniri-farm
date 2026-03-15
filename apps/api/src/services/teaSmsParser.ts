import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db/client'

const anthropic = new Anthropic()

// Real SMS format from Cathy Tea (0706 484749):
//
// SINGLE ACCOUNT:
//   [account]-[today_kg]-[casual_kg]-[casual_pay] [Cash|Negative] [float_kes] [Centre] [Letter] [kg] [Letter] [kg] ...
//   Example: 247-65.4-44.5-625 Cash 1540 Mukinduriri A 56 B 9.4
//   Example: 244-138.7-121-1695 Negative 660 Kathuniri C 56 A 42 B 40.7
//   Example: 244-147.2-122-1710 Negative 1210 Kamwangi A 47 B 74 Mucucari A 26.2  (two centres)
//
// MULTI-ACCOUNT (separated by `(`):
//   [acct1]-[kg1]([acct2]-[kg2]([acctN]-[kgN]-[grand_total_kg]-[casual_kg]-[casual_pay] [Cash|Negative] [float] [areas...]
//   Example: 16-89.1(164-42.2(499-34.9-166.2-147.5-2065 Negative 2165 Mucucari B 10 Mutarakwe A 61 B 70 Mukinduriri A 25.
//
// Notes:
// - today_kg = kg delivered TODAY (not a running cumulative)
// - Letters (A, B, C) = queue/plot allocations at each centre
// - Cash = positive float, Negative = negative float
// - Float can be absent (treat as 0)
// - Centre name alone without a letter means all kg went there unallocated
// - Multiple centres can appear in one message

const SYSTEM_PROMPT = `You parse daily green leaf tea SMS messages from Cathy Tea (the picking supervisor) for Kathuniri Farm, Embu County, Kenya. KTDA Factory F064.

## FORMAT

SINGLE ACCOUNT:
[account_code]-[today_kg]-[casual_kg]-[casual_pay_kes] [Cash|Negative] [float_kes] [Centre] [Letter] [kg] [Letter] [kg]...

MULTI-ACCOUNT (accounts separated by "(" character):
[acct1]-[kg1]([acct2]-[kg2]([acctN]-[kgN]-[grand_total_kg]-[casual_kg]-[casual_pay_kes] [Cash|Negative] [float_kes] [areas...]

## REAL EXAMPLES

Single, one centre, two letters:
  247-65.4-44.5-625 Cash 1540 Mukinduriri A 56 B 9.4
  → account 247, today 65.4 kg (=56+9.4), casual 44.5 kg, casual pay KES 625, float +1540
  → Mukinduriri: A=56 kg, B=9.4 kg

Single, one centre, three letters:
  244-138.7-121-1695 Negative 660 Kathuniri C 56 A 42 B 40.7
  → account 244, today 138.7 kg, casual 121 kg, pay KES 1695, float -660
  → Kathuniri: C=56 kg, A=42 kg, B=40.7 kg

Single, two centres:
  244-147.2-122-1710 Negative 1210 Kamwangi A 47 B 74 Mucucari A 26.2
  → Kamwangi: A=47, B=74. Mucucari: A=26.2. Total=147.2 ✓

Single, centre name only (no letter):
  244-32.5-21.5-300 Negative 960 Shule 32.5
  → Shule: 32.5 kg (no letter breakdown)

Multi-account, three accounts:
  16-89.1(164-42.2(499-34.9-166.2-147.5-2065 Negative 2165 Mucucari B 10 Mutarakwe A 61 B 70 Mukinduriri A 25.
  → account 16: 89.1 kg, account 164: 42.2 kg, account 499: 34.9 kg
  → grand total: 166.2 kg (=89.1+42.2+34.9), casual 147.5 kg, pay KES 2065, float -2165

## KNOWN KTDA ACCOUNTS
- 7   → TR0030007 Mbogo Muganbi         (1,000 bushes)
- 16  → TR0030016 Agnes Rwamba Mbogo    (4,522 bushes)
- 164 → TR0030164 Linda K Nyaga         (2,000 bushes)
- 244 → TR0030244 Eric Muriithi Nyaga   (2,000 bushes)
- 247 → TR0030247 Stella M Nyaga        (1,804 bushes)
- 404 → TR0030404 Lilian Muthoni Nyaga  (1,991 bushes)
- 499 → TR0030499 Sandra Gatuiri Gikundi (1,000 bushes)

## KNOWN COLLECTION CENTRES
Mukinduriri, Kathuniri, Kathangariri, Kamwangi, Mucucari, Mutarakwe, Shule, Newtea

## RULES
- today_kg is THIS DAY's delivery only — not a monthly cumulative
- Verify: sum of all centre kg allocations should equal today_kg for that account
- Cash = positive float, Negative = negative float, absent = 0
- account_code trailing digits map to TR number (07 → TR0030007, 16 → TR0030016)
- In multi-account: casual_kg and float are SHARED across all accounts in the message

Respond ONLY with valid JSON, no markdown fences:
{
  "deliveryDate": "YYYY-MM-DD",
  "accounts": [
    {
      "smsCode": "244",
      "accountCode": "TR0030244",
      "todayKg": 138.7,
      "casualKg": 121.0,
      "casualPayKes": 1695,
      "supervisorFloatKes": -660,
      "centres": [
        {
          "name": "Kathuniri",
          "totalKg": 138.7,
          "allocations": [
            { "letter": "C", "kg": 56 },
            { "letter": "A", "kg": 42 },
            { "letter": "B", "kg": 40.7 }
          ]
        }
      ]
    }
  ],
  "confidence": 0.95,
  "warnings": []
}`

export async function parseTeaSms(
  rawSms: string,
  smsRecordId: string,
  receivedAt: Date,
): Promise<void> {
  const deliveryDate = receivedAt.toISOString().split('T')[0]

  type ParsedAccount = {
    smsCode: string
    accountCode: string
    todayKg: number
    casualKg: number
    casualPayKes: number
    supervisorFloatKes: number
    centres: Array<{
      name: string
      totalKg: number
      allocations: Array<{ letter: string; kg: number }>
    }>
  }

  let parsed: {
    deliveryDate: string
    accounts: ParsedAccount[]
    confidence: number
    warnings: string[]
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Today's date: ${deliveryDate}\n\nSMS:\n${rawSms}`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON found in response: ${raw.slice(0, 200)}`)
  parsed = JSON.parse(jsonMatch[0])

  const allCentres = await prisma.collectionCentre.findMany({ where: { active: true } })

  for (const acct of parsed.accounts) {
    const ktdaAccount = await prisma.ktdaAccount.findUnique({
      where: { accountCode: acct.accountCode },
    })

    for (const centre of acct.centres) {
      // Match centre by canonical name or alternate spellings
      const centreRecord = allCentres.find(c =>
        c.canonicalName.toLowerCase() === centre.name.toLowerCase() ||
        c.alternateSpellings.some(s => s.toLowerCase() === centre.name.toLowerCase())
      )

      const delivery = await prisma.teaSmsDelivery.create({
        data: {
          smsRecordId,
          deliveryDate: new Date(parsed.deliveryDate),
          centreId:       centreRecord?.id ?? undefined,
          centreRawName:  centre.name,
          todayKg:        centre.totalKg,
          cumulativeKg:   null,           // not in SMS — calculated by summing daily records
          casualKg:       acct.casualKg,
          casualPayKes:   acct.casualPayKes,
          supervisorFloat: acct.supervisorFloatKes,
          parseConfidence: parsed.confidence,
        },
      })

      // Create per-letter allocations
      if (ktdaAccount) {
        if (centre.allocations.length > 0) {
          await prisma.teaSmsAllocation.createMany({
            data: centre.allocations.map(a => ({
              deliveryId:   delivery.id,
              accountLetter: a.letter,
              ktdaAccountId: ktdaAccount.id,
              kgAllocated:   a.kg,
            })),
          })
        } else {
          // No letter breakdown — single allocation for the full centre kg
          await prisma.teaSmsAllocation.create({
            data: {
              deliveryId:    delivery.id,
              accountLetter: 'A',
              ktdaAccountId: ktdaAccount.id,
              kgAllocated:   centre.totalKg,
            },
          })
        }
      }
    }
  }

  await prisma.teaSmsRecord.update({
    where: { id: smsRecordId },
    data: { parsed: true },
  })
}
