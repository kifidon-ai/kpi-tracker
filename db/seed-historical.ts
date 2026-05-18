/**
 * Historical activity import for Timmy and Mujeeb.
 * Run with: npm run db:seed-historical
 * Safe to re-run — deletes Mujeeb's hourly rows first, then re-inserts correct data.
 */
import { db } from './index'
import { reps, activity_daily } from './schema'
import { ilike, eq, gt } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// Timmy's hourly dials/conv/vm (Apr 8 – May 8)
const TIMMY_HOURLY = [
  // Apr 8
  { date: '2026-04-08', hour: 13, dials: 6,  conv: 3, vm: 0 },
  { date: '2026-04-08', hour: 14, dials: 7,  conv: 2, vm: 0 },
  { date: '2026-04-08', hour: 15, dials: 5,  conv: 2, vm: 0 },
  { date: '2026-04-08', hour: 16, dials: 2,  conv: 0, vm: 0 },
  { date: '2026-04-08', hour: 17, dials: 5,  conv: 3, vm: 0 },
  // Apr 13
  { date: '2026-04-13', hour: 12, dials: 1,  conv: 1, vm: 0 },
  { date: '2026-04-13', hour: 13, dials: 3,  conv: 1, vm: 0 },
  { date: '2026-04-13', hour: 14, dials: 2,  conv: 1, vm: 0 },
  // Apr 23
  { date: '2026-04-23', hour: 14, dials: 2,  conv: 0, vm: 0 },
  { date: '2026-04-23', hour: 15, dials: 9,  conv: 3, vm: 0 },
  { date: '2026-04-23', hour: 16, dials: 3,  conv: 1, vm: 0 },
  // Apr 24
  { date: '2026-04-24', hour: 12, dials: 3,  conv: 2, vm: 0 },
  { date: '2026-04-24', hour: 13, dials: 7,  conv: 1, vm: 0 },
  { date: '2026-04-24', hour: 14, dials: 5,  conv: 0, vm: 0 },
  { date: '2026-04-24', hour: 15, dials: 8,  conv: 1, vm: 0 },
  // Apr 27
  { date: '2026-04-27', hour: 10, dials: 8,  conv: 1, vm: 2 },
  { date: '2026-04-27', hour: 11, dials: 3,  conv: 1, vm: 1 },
  { date: '2026-04-27', hour: 12, dials: 3,  conv: 1, vm: 2 },
  { date: '2026-04-27', hour: 13, dials: 4,  conv: 0, vm: 2 },
  { date: '2026-04-27', hour: 15, dials: 6,  conv: 1, vm: 1 },
  { date: '2026-04-27', hour: 16, dials: 4,  conv: 3, vm: 1 },
  { date: '2026-04-27', hour: 17, dials: 2,  conv: 2, vm: 0 },
  // Apr 28
  { date: '2026-04-28', hour: 10, dials: 3,  conv: 1, vm: 2 },
  { date: '2026-04-28', hour: 11, dials: 3,  conv: 0, vm: 0 },
  { date: '2026-04-28', hour: 12, dials: 6,  conv: 0, vm: 4 },
  { date: '2026-04-28', hour: 13, dials: 4,  conv: 2, vm: 1 },
  { date: '2026-04-28', hour: 14, dials: 3,  conv: 1, vm: 2 },
  { date: '2026-04-28', hour: 15, dials: 6,  conv: 0, vm: 3 },
  { date: '2026-04-28', hour: 16, dials: 3,  conv: 1, vm: 0 },
  // Apr 29
  { date: '2026-04-29', hour: 14, dials: 3,  conv: 2, vm: 1 },
  { date: '2026-04-29', hour: 15, dials: 12, conv: 2, vm: 1 },
  { date: '2026-04-29', hour: 16, dials: 3,  conv: 1, vm: 1 },
  { date: '2026-04-29', hour: 17, dials: 3,  conv: 0, vm: 0 },
  // Apr 30
  { date: '2026-04-30', hour: 11, dials: 2,  conv: 2, vm: 0 },
  { date: '2026-04-30', hour: 12, dials: 1,  conv: 0, vm: 0 },
  { date: '2026-04-30', hour: 13, dials: 3,  conv: 2, vm: 1 },
  { date: '2026-04-30', hour: 14, dials: 10, conv: 0, vm: 4 },
  { date: '2026-04-30', hour: 15, dials: 2,  conv: 1, vm: 0 },
  { date: '2026-04-30', hour: 16, dials: 8,  conv: 4, vm: 2 },
  { date: '2026-04-30', hour: 17, dials: 8,  conv: 2, vm: 1 },
  // May 1
  { date: '2026-05-01', hour: 10, dials: 4,  conv: 1, vm: 0 },
  // May 4
  { date: '2026-05-04', hour: 10, dials: 1,  conv: 1, vm: 0 },
  { date: '2026-05-04', hour: 12, dials: 1,  conv: 0, vm: 0 },
  { date: '2026-05-04', hour: 14, dials: 2,  conv: 2, vm: 1 },
  { date: '2026-05-04', hour: 16, dials: 4,  conv: 3, vm: 0 },
  // May 5
  { date: '2026-05-05', hour: 11, dials: 3,  conv: 1, vm: 1 },
  { date: '2026-05-05', hour: 13, dials: 4,  conv: 2, vm: 0 },
  { date: '2026-05-05', hour: 14, dials: 5,  conv: 0, vm: 1 },
  // May 6
  { date: '2026-05-06', hour: 11, dials: 5,  conv: 2, vm: 0 },
  { date: '2026-05-06', hour: 12, dials: 5,  conv: 3, vm: 0 },
  { date: '2026-05-06', hour: 13, dials: 3,  conv: 0, vm: 2 },
  { date: '2026-05-06', hour: 14, dials: 7,  conv: 4, vm: 1 },
  { date: '2026-05-06', hour: 16, dials: 2,  conv: 1, vm: 0 },
  // May 7
  { date: '2026-05-07', hour: 11, dials: 1,  conv: 1, vm: 0 },
  { date: '2026-05-07', hour: 12, dials: 8,  conv: 0, vm: 1 },
  { date: '2026-05-07', hour: 13, dials: 3,  conv: 0, vm: 3 },
  { date: '2026-05-07', hour: 14, dials: 3,  conv: 1, vm: 1 },
  { date: '2026-05-07', hour: 15, dials: 7,  conv: 1, vm: 1 },
  // May 8
  { date: '2026-05-08', hour: 11, dials: 1,  conv: 1, vm: 0 },
]

// Mujeeb's correct hourly dials/conv/vm (May 4 – May 14)
const MUJEEB_HOURLY = [
  // May 4
  { date: '2026-05-04', hour: 12, dials: 3,  conv: 2, vm: 1 },
  { date: '2026-05-04', hour: 13, dials: 3,  conv: 1, vm: 0 },
  { date: '2026-05-04', hour: 14, dials: 4,  conv: 3, vm: 0 },
  { date: '2026-05-04', hour: 15, dials: 1,  conv: 1, vm: 0 },
  { date: '2026-05-04', hour: 16, dials: 8,  conv: 2, vm: 0 },
  // May 5
  { date: '2026-05-05', hour: 10, dials: 1,  conv: 1, vm: 0 },
  { date: '2026-05-05', hour: 11, dials: 3,  conv: 1, vm: 0 },
  { date: '2026-05-05', hour: 12, dials: 4,  conv: 0, vm: 0 },
  { date: '2026-05-05', hour: 13, dials: 4,  conv: 2, vm: 0 },
  { date: '2026-05-05', hour: 14, dials: 4,  conv: 1, vm: 0 },
  { date: '2026-05-05', hour: 15, dials: 5,  conv: 1, vm: 0 },
  // May 6
  { date: '2026-05-06', hour: 11, dials: 4,  conv: 2, vm: 2 },
  { date: '2026-05-06', hour: 12, dials: 2,  conv: 1, vm: 1 },
  { date: '2026-05-06', hour: 13, dials: 4,  conv: 1, vm: 2 },
  { date: '2026-05-06', hour: 14, dials: 2,  conv: 2, vm: 0 },
  { date: '2026-05-06', hour: 15, dials: 5,  conv: 2, vm: 0 },
  { date: '2026-05-06', hour: 16, dials: 4,  conv: 0, vm: 0 },
  // May 7
  { date: '2026-05-07', hour: 11, dials: 6,  conv: 1, vm: 0 },
  { date: '2026-05-07', hour: 12, dials: 1,  conv: 1, vm: 0 },
  { date: '2026-05-07', hour: 13, dials: 8,  conv: 1, vm: 0 },
  { date: '2026-05-07', hour: 14, dials: 3,  conv: 1, vm: 0 },
  { date: '2026-05-07', hour: 15, dials: 5,  conv: 2, vm: 0 },
  // May 8
  { date: '2026-05-08', hour: 11, dials: 7,  conv: 1, vm: 4 },
  { date: '2026-05-08', hour: 12, dials: 8,  conv: 1, vm: 2 },
  { date: '2026-05-08', hour: 13, dials: 1,  conv: 0, vm: 0 },
  { date: '2026-05-08', hour: 16, dials: 1,  conv: 0, vm: 0 },
  // May 11
  { date: '2026-05-11', hour:  9, dials: 5,  conv: 1, vm: 0 },
  { date: '2026-05-11', hour: 10, dials: 3,  conv: 2, vm: 0 },
  { date: '2026-05-11', hour: 11, dials: 8,  conv: 1, vm: 1 },
  { date: '2026-05-11', hour: 12, dials: 8,  conv: 1, vm: 0 },
  { date: '2026-05-11', hour: 13, dials: 13, conv: 1, vm: 2 },
  { date: '2026-05-11', hour: 14, dials: 8,  conv: 1, vm: 0 },
  { date: '2026-05-11', hour: 15, dials: 10, conv: 1, vm: 4 },
  { date: '2026-05-11', hour: 16, dials: 5,  conv: 0, vm: 0 },
  // May 12
  { date: '2026-05-12', hour:  9, dials: 2,  conv: 1, vm: 0 },
  { date: '2026-05-12', hour: 10, dials: 3,  conv: 0, vm: 2 },
  { date: '2026-05-12', hour: 11, dials: 5,  conv: 3, vm: 0 },
  { date: '2026-05-12', hour: 12, dials: 8,  conv: 2, vm: 2 },
  { date: '2026-05-12', hour: 14, dials: 5,  conv: 1, vm: 3 },
  { date: '2026-05-12', hour: 15, dials: 5,  conv: 0, vm: 0 },
  { date: '2026-05-12', hour: 16, dials: 8,  conv: 2, vm: 0 },
  // May 13
  { date: '2026-05-13', hour: 10, dials: 7,  conv: 2, vm: 1 },
  { date: '2026-05-13', hour: 11, dials: 4,  conv: 1, vm: 0 },
  { date: '2026-05-13', hour: 12, dials: 5,  conv: 2, vm: 0 },
  { date: '2026-05-13', hour: 13, dials: 4,  conv: 2, vm: 0 },
  { date: '2026-05-13', hour: 14, dials: 5,  conv: 1, vm: 0 },
  { date: '2026-05-13', hour: 15, dials: 2,  conv: 2, vm: 0 },
  { date: '2026-05-13', hour: 16, dials: 4,  conv: 1, vm: 0 },
  // May 14
  { date: '2026-05-14', hour: 10, dials: 5,  conv: 2, vm: 0 },
  { date: '2026-05-14', hour: 11, dials: 2,  conv: 1, vm: 0 },
  { date: '2026-05-14', hour: 13, dials: 2,  conv: 0, vm: 0 },
  { date: '2026-05-14', hour: 14, dials: 4,  conv: 0, vm: 0 },
  { date: '2026-05-14', hour: 15, dials: 5,  conv: 1, vm: 0 },
  { date: '2026-05-14', hour: 16, dials: 6,  conv: 2, vm: 0 },
]

// Discovery calls booked — daily totals at hour=0
const TIMMY_DISC  = [
  { date: '2026-04-27', disc: 3 },
  { date: '2026-04-28', disc: 2 },
  { date: '2026-04-29', disc: 1 },
  { date: '2026-04-30', disc: 3 },
  { date: '2026-05-04', disc: 3 },
  { date: '2026-05-05', disc: 1 },
  { date: '2026-05-07', disc: 2 },
]
const MUJEEB_DISC = [
  { date: '2026-05-05', disc: 2 },
  { date: '2026-05-06', disc: 2 },
  { date: '2026-05-07', disc: 2 },
  { date: '2026-05-11', disc: 1 },
  { date: '2026-05-13', disc: 4 },
  { date: '2026-05-14', disc: 2 },
]

// Demos scheduled — daily totals at hour=0
const TIMMY_DEMO  = [
  { date: '2026-05-11', demo: 3 },
  { date: '2026-05-12', demo: 1 },
  { date: '2026-05-14', demo: 1 },
  { date: '2026-05-15', demo: 1 },
  { date: '2026-05-21', demo: 1 },
]
const MUJEEB_DEMO = [
  { date: '2026-05-19', demo: 1 },
  { date: '2026-05-22', demo: 1 },
]

async function seed() {
  const [timmyRep] = await db.select({ id: reps.id }).from(reps).where(ilike(reps.name, '%timmy%'))
  const [mujeebRep] = await db.select({ id: reps.id }).from(reps).where(ilike(reps.name, '%mujeeb%'))

  if (!timmyRep) throw new Error('Timmy not found in reps — run npm run db:seed first')
  if (!mujeebRep) throw new Error('Mujeeb not found in reps — run npm run db:seed first')

  // Wipe Mujeeb's old hourly data (hour > 0) before reinserting correct values
  // hour = 0 rows hold disc/demo daily totals — leave those alone
  await db
    .delete(activity_daily)
    .where(sql`${activity_daily.rep_id} = ${mujeebRep.id} AND ${activity_daily.hour} > 0`)

  console.log('Cleared Mujeeb old hourly data')

  const row = (repId: string, date: string, hour: number, dials = 0, conv = 0, vm = 0, disc = 0, demo = 0) => ({
    id:     crypto.randomUUID(),
    rep_id: repId,
    date,
    hour,
    dials,
    conv,
    vm,
    disc,
    demo,
    onb:    0,
    closed: 0,
  })

  const rows = [
    ...TIMMY_HOURLY.map((h) => row(timmyRep.id,  h.date, h.hour, h.dials, h.conv, h.vm)),
    ...MUJEEB_HOURLY.map((h) => row(mujeebRep.id, h.date, h.hour, h.dials, h.conv, h.vm)),
    ...TIMMY_DISC.map((d)    => row(timmyRep.id,  d.date, 0, 0, 0, 0, d.disc)),
    ...MUJEEB_DISC.map((d)   => row(mujeebRep.id, d.date, 0, 0, 0, 0, d.disc)),
    ...TIMMY_DEMO.map((d)    => row(timmyRep.id,  d.date, 0, 0, 0, 0, 0, d.demo)),
    ...MUJEEB_DEMO.map((d)   => row(mujeebRep.id, d.date, 0, 0, 0, 0, 0, d.demo)),
  ]

  await db
    .insert(activity_daily)
    .values(rows)
    .onConflictDoUpdate({
      target: [activity_daily.rep_id, activity_daily.date, activity_daily.hour],
      set: {
        dials: sql`excluded.dials`,
        conv:  sql`excluded.conv`,
        vm:    sql`excluded.vm`,
        disc:  sql`excluded.disc`,
        demo:  sql`excluded.demo`,
      },
    })

  console.log(`Inserted ${rows.length} rows`)
  process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) })
