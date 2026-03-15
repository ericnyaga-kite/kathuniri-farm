import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Kathuniri Farm database...')

  // ─── COLLECTION CENTRE ───────────────────────────────────────────────────
  const centres = [
    {
      canonicalName: 'Mukinduriri',
      alternateSpellings: ['MUKINDURIRI', 'mukinduriri', 'Mukinduri'],
    },
    {
      canonicalName: 'Kathuniri',
      alternateSpellings: ['KATHUNIRI', 'kathuniri', 'Kathangariri', 'KATHANGARIRI', 'Kathangari'],
    },
    {
      canonicalName: 'Kamwangi',
      alternateSpellings: ['KAMWANGI', 'kamwangi'],
    },
    {
      canonicalName: 'Mucucari',
      alternateSpellings: ['MUCUCARI', 'mucucari', 'Mucucari'],
    },
    {
      canonicalName: 'Mutarakwe',
      alternateSpellings: ['MUTARAKWE', 'mutarakwe'],
    },
    {
      canonicalName: 'Shule',
      alternateSpellings: ['SHULE', 'shule'],
    },
    {
      canonicalName: 'Newtea',
      alternateSpellings: ['NEWTEA', 'newtea', 'New Tea'],
    },
  ]

  for (const centre of centres) {
    await prisma.collectionCentre.upsert({
      where: { canonicalName: centre.canonicalName },
      update: {},
      create: { ...centre, pickingCycleDays: 14, active: true },
    })
    console.log(`✓ Collection centre: ${centre.canonicalName}`)
  }

  // ─── KTDA ACCOUNTS ────────────────────────────────────────────────────────
  // Factory F064 — Kathangariri. SMS codes are last digits of account number.
  const ktdaAccounts = [
    { accountCode: 'TR0030007', holderName: 'Mbogo Muganbi',          bushesRegistered: 1000 },
    { accountCode: 'TR0030016', holderName: 'Agnes Rwamba Mbogo',     bushesRegistered: 4522 },
    { accountCode: 'TR0030164', holderName: 'Linda K Nyaga',          bushesRegistered: 2000 },
    { accountCode: 'TR0030244', holderName: 'Eric Muriithi Nyaga',    bushesRegistered: 2000 },
    { accountCode: 'TR0030247', holderName: 'Stella M Nyaga',         bushesRegistered: 1804 },
    { accountCode: 'TR0030404', holderName: 'Lilian Muthoni Nyaga',   bushesRegistered: 1991 },
    { accountCode: 'TR0030499', holderName: 'Sandra Gatuiri Gikundi', bushesRegistered: 1000 },
  ]

  for (const acct of ktdaAccounts) {
    await prisma.ktdaAccount.upsert({
      where: { accountCode: acct.accountCode },
      update: {},
      create: { ...acct, active: true },
    })
    console.log(`✓ KTDA account: ${acct.accountCode} — ${acct.holderName}`)
  }

  // ─── MILK BUYERS ─────────────────────────────────────────────────────────
  const milkBuyers = [
    { canonicalName: 'Duka',  paymentType: 'daily_cash',   pricePerLitre: 50 },
    { canonicalName: 'Hotel', paymentType: 'daily_cash',   pricePerLitre: 55 },
    { canonicalName: 'Fred',  paymentType: 'monthly_mpesa', pricePerLitre: 50 },
  ]

  for (const buyer of milkBuyers) {
    await prisma.milkBuyer.upsert({
      where: { canonicalName: buyer.canonicalName },
      update: {},
      create: { ...buyer, active: true },
    })
    console.log(`✓ Milk buyer: ${buyer.canonicalName}`)
  }

  // ─── COWS ─────────────────────────────────────────────────────────────────
  const ndamaI = await prisma.cow.upsert({
    where: { id: 'cow-ndama-1' },
    update: {},
    create: {
      id: 'cow-ndama-1',
      name: 'Ndama I',
      breed: 'Ayrshire cross',
      status: 'milking',
      active: true,
    },
  })

  const ndamaII = await prisma.cow.upsert({
    where: { id: 'cow-ndama-2' },
    update: {},
    create: {
      id: 'cow-ndama-2',
      name: 'Ndama II',
      breed: 'Ayrshire cross',
      status: 'milking',
      active: true,
    },
  })
  console.log(`✓ Cow: ${ndamaI.name}`)
  console.log(`✓ Cow: ${ndamaII.name}`)

  // Ndama I current mastitis treatment — Gentamycin
  // Final dose: 2026-03-14. Withdrawal: 7 days → ends 2026-03-21.
  // Milk NOT saleable until 21 March 2026.
  const ndamaIHealthEvent = await prisma.healthEvent.upsert({
    where: { id: 'he-ndama1-mastitis-2026' },
    update: {},
    create: {
      id: 'he-ndama1-mastitis-2026',
      cowId: 'cow-ndama-1',
      eventDate: new Date('2026-03-07'),
      eventType: 'illness',
      conditionName: 'Mastitis',
      notes: 'Right quarter affected. Vet: Stephen Otieno (0704200115).',
    },
  })

  await prisma.treatment.upsert({
    where: { id: 'tx-ndama1-gentamycin-2026' },
    update: {},
    create: {
      id: 'tx-ndama1-gentamycin-2026',
      healthEventId: ndamaIHealthEvent.id,
      drugName: 'Gentamycin',
      dosageRoute: 'IM injection',
      durationDays: 7,
      withdrawalPeriodDays: 7,
      withdrawalEndsDate: new Date('2026-03-21'),
      costKes: 0, // part of vet visit cost — enter separately
    },
  })
  console.log(`✓ Ndama I: Gentamycin treatment (withdrawal ends 2026-03-21)`)

  // Ndama II — mastitis history Feb 2026
  const ndamaIIHealthEvent = await prisma.healthEvent.upsert({
    where: { id: 'he-ndama2-mastitis-2026-02' },
    update: {},
    create: {
      id: 'he-ndama2-mastitis-2026-02',
      cowId: 'cow-ndama-2',
      eventDate: new Date('2026-02-01'),
      eventType: 'illness',
      conditionName: 'Mastitis',
      notes: 'Mastitis Feb 2026 — treatment details to be entered from vet notebook.',
    },
  })
  console.log(`✓ Ndama II: Mastitis event (Feb 2026)`)

  // ─── SMALL STOCK ─────────────────────────────────────────────────────────
  const smallStock = [
    { id: 'ss-bull-1',  species: 'bull',   sex: 'male',   name: 'Bull',   status: 'active' },
    { id: 'ss-ram-1',   species: 'sheep',  sex: 'male',   name: 'RAM',    status: 'active' },
    { id: 'ss-ewe-1',   species: 'sheep',  sex: 'female', name: 'Ewe 1',  status: 'active' },
    { id: 'ss-ewe-2',   species: 'sheep',  sex: 'female', name: 'Ewe 2',  status: 'active' },
    { id: 'ss-ewe-3',   species: 'sheep',  sex: 'female', name: 'Ewe 3',  status: 'active' },
    { id: 'ss-ewe-4',   species: 'sheep',  sex: 'female', name: 'Ewe 4',  status: 'active' },
  ]

  for (const animal of smallStock) {
    await prisma.smallStock.upsert({
      where: { id: animal.id },
      update: {},
      create: { ...animal, active: true },
    })
    console.log(`✓ Small stock: ${animal.name} (${animal.species})`)
  }

  // ─── RENTAL ROOMS ─────────────────────────────────────────────────────────
  // 8 rooms, rent due 5th, electricity KES 30/unit
  for (let i = 1; i <= 8; i++) {
    await prisma.rentalRoom.upsert({
      where: { roomNumber: i },
      update: {},
      create: {
        roomNumber: i,
        monthlyRentKes: 3000,     // placeholder — update with actual rents
        electricityRatePerUnit: 30,
        occupancyStatus: 'occupied',
        rentDueDay: 5,
        active: true,
      },
    })
    console.log(`✓ Rental room: ${i}`)
  }

  // ─── PLOTS ───────────────────────────────────────────────────────────────
  const plots = [
    { canonicalName: 'I-Plot 1',   plotType: 'crop', notes: 'I-plots (irrigated)' },
    { canonicalName: 'I-Plot 2',   plotType: 'crop', notes: 'I-plots (irrigated)' },
    { canonicalName: 'E-Plot 1',   plotType: 'crop', notes: 'E-plots (rain-fed)' },
    { canonicalName: 'E-Plot 2',   plotType: 'crop', notes: 'E-plots (rain-fed)' },
    { canonicalName: 'Demo Farm',  plotType: 'crop', notes: 'AITEC cabbage demonstration farm' },
  ]

  for (const plot of plots) {
    await prisma.plot.upsert({
      where: { canonicalName: plot.canonicalName },
      update: {},
      create: { ...plot, active: true },
    })
    console.log(`✓ Plot: ${plot.canonicalName}`)
  }

  // ─── STAFF — VET ─────────────────────────────────────────────────────────
  await prisma.staff.upsert({
    where: { id: 'staff-stephen-otieno' },
    update: {},
    create: {
      id: 'staff-stephen-otieno',
      fullName: 'Stephen Otieno',
      phone: '0704200115',
      employmentType: 'casual',
      paymentMethod: 'mpesa',
      mpesaNumber: '0704200115',
      active: true,
    },
  })
  console.log(`✓ Staff: Stephen Otieno (Vet)`)

  console.log('\nSeed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
