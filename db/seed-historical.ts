/**
 * Historical activity import for Timmy and Mujeeb.
 * Run with: npm run db:seed-historical
 * Deletes ALL activity_log_entries for both reps, then re-inserts all historical data.
 * Each hourly row becomes one log entry per non-zero metric with delta = count.
 */
import { db } from './index'
import { reps, activity_log_entries } from './schema'
import { ilike, eq, and, lte } from 'drizzle-orm'

const METRIC_INFO: Record<string, { label: string; icon: string; color: string }> = {
  dials: { label: 'Dial logged',         icon: 'phone',    color: '#00D4FF' },
  conv:  { label: 'Conversation logged', icon: 'chat',     color: '#8B5CF6' },
  vm:    { label: 'Voicemail logged',    icon: 'voicemail',color: '#5A6685' },
  disc:  { label: 'Discovery booked',   icon: 'calendar', color: '#FFB800' },
  demo:  { label: 'Demo booked',        icon: 'present',  color: '#FF3D9A' },
}

// Timmy's hourly data (Apr 8 – May 8). disc embedded at the hour it was booked.
const TIMMY_HOURLY = [
  // Apr 8
  { date: '2026-04-08', hour: 13, dials: 6,  conv: 3, vm: 0, disc: 0 },
  { date: '2026-04-08', hour: 14, dials: 7,  conv: 2, vm: 0, disc: 0 },
  { date: '2026-04-08', hour: 15, dials: 5,  conv: 2, vm: 0, disc: 2 },
  { date: '2026-04-08', hour: 16, dials: 2,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-04-08', hour: 17, dials: 5,  conv: 3, vm: 0, disc: 1 },
  // Apr 13
  { date: '2026-04-13', hour: 12, dials: 1,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-04-13', hour: 13, dials: 3,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-04-13', hour: 14, dials: 2,  conv: 1, vm: 0, disc: 1 },
  // Apr 23
  { date: '2026-04-23', hour: 14, dials: 2,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-04-23', hour: 15, dials: 9,  conv: 3, vm: 0, disc: 0 },
  { date: '2026-04-23', hour: 16, dials: 3,  conv: 1, vm: 0, disc: 0 },
  // Apr 24
  { date: '2026-04-24', hour: 12, dials: 3,  conv: 2, vm: 0, disc: 0 },
  { date: '2026-04-24', hour: 13, dials: 7,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-04-24', hour: 14, dials: 5,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-04-24', hour: 15, dials: 8,  conv: 1, vm: 0, disc: 0 },
  // Apr 27
  { date: '2026-04-27', hour: 10, dials: 8,  conv: 1, vm: 2, disc: 0 },
  { date: '2026-04-27', hour: 11, dials: 3,  conv: 1, vm: 1, disc: 1 },
  { date: '2026-04-27', hour: 12, dials: 3,  conv: 1, vm: 2, disc: 0 },
  { date: '2026-04-27', hour: 13, dials: 4,  conv: 0, vm: 2, disc: 0 },
  { date: '2026-04-27', hour: 15, dials: 6,  conv: 1, vm: 1, disc: 1 },
  { date: '2026-04-27', hour: 16, dials: 4,  conv: 3, vm: 1, disc: 0 },
  { date: '2026-04-27', hour: 17, dials: 2,  conv: 2, vm: 0, disc: 1 },
  // Apr 28
  { date: '2026-04-28', hour: 10, dials: 3,  conv: 1, vm: 2, disc: 0 },
  { date: '2026-04-28', hour: 11, dials: 3,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-04-28', hour: 12, dials: 6,  conv: 0, vm: 4, disc: 0 },
  { date: '2026-04-28', hour: 13, dials: 4,  conv: 2, vm: 1, disc: 1 },
  { date: '2026-04-28', hour: 14, dials: 3,  conv: 1, vm: 2, disc: 0 },
  { date: '2026-04-28', hour: 15, dials: 6,  conv: 0, vm: 3, disc: 0 },
  { date: '2026-04-28', hour: 16, dials: 3,  conv: 1, vm: 0, disc: 1 },
  // Apr 29
  { date: '2026-04-29', hour: 14, dials: 3,  conv: 2, vm: 1, disc: 1 },
  { date: '2026-04-29', hour: 15, dials: 12, conv: 2, vm: 1, disc: 0 },
  { date: '2026-04-29', hour: 16, dials: 3,  conv: 1, vm: 1, disc: 0 },
  { date: '2026-04-29', hour: 17, dials: 3,  conv: 0, vm: 0, disc: 0 },
  // Apr 30
  { date: '2026-04-30', hour: 11, dials: 2,  conv: 2, vm: 0, disc: 1 },
  { date: '2026-04-30', hour: 12, dials: 1,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-04-30', hour: 13, dials: 3,  conv: 2, vm: 1, disc: 1 },
  { date: '2026-04-30', hour: 14, dials: 10, conv: 0, vm: 4, disc: 0 },
  { date: '2026-04-30', hour: 15, dials: 2,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-04-30', hour: 16, dials: 8,  conv: 4, vm: 2, disc: 0 },
  { date: '2026-04-30', hour: 17, dials: 8,  conv: 2, vm: 1, disc: 0 },
  // May 1
  { date: '2026-05-01', hour: 10, dials: 4,  conv: 1, vm: 0, disc: 0 },
  // May 4
  { date: '2026-05-04', hour: 10, dials: 1,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-05-04', hour: 12, dials: 1,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-05-04', hour: 14, dials: 2,  conv: 2, vm: 1, disc: 1 },
  { date: '2026-05-04', hour: 16, dials: 4,  conv: 3, vm: 0, disc: 1 },
  // May 5
  { date: '2026-05-05', hour: 11, dials: 3,  conv: 1, vm: 1, disc: 0 },
  { date: '2026-05-05', hour: 13, dials: 4,  conv: 2, vm: 0, disc: 1 },
  { date: '2026-05-05', hour: 14, dials: 5,  conv: 0, vm: 1, disc: 0 },
  // May 6
  { date: '2026-05-06', hour: 11, dials: 5,  conv: 2, vm: 0, disc: 0 },
  { date: '2026-05-06', hour: 12, dials: 5,  conv: 3, vm: 0, disc: 0 },
  { date: '2026-05-06', hour: 13, dials: 3,  conv: 0, vm: 2, disc: 0 },
  { date: '2026-05-06', hour: 14, dials: 7,  conv: 4, vm: 1, disc: 0 },
  { date: '2026-05-06', hour: 16, dials: 2,  conv: 1, vm: 0, disc: 0 },
  // May 7
  { date: '2026-05-07', hour: 11, dials: 1,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-05-07', hour: 12, dials: 8,  conv: 0, vm: 1, disc: 0 },
  { date: '2026-05-07', hour: 13, dials: 3,  conv: 0, vm: 3, disc: 0 },
  { date: '2026-05-07', hour: 14, dials: 3,  conv: 1, vm: 1, disc: 0 },
  { date: '2026-05-07', hour: 15, dials: 7,  conv: 1, vm: 1, disc: 1 },
  // May 8
  { date: '2026-05-08', hour: 11, dials: 1,  conv: 1, vm: 0, disc: 0 },
]

// Mujeeb's hourly data (May 4 – May 14). disc embedded at the actual hour.
const MUJEEB_HOURLY = [
  // May 4
  { date: '2026-05-04', hour: 12, dials: 3,  conv: 2, vm: 1, disc: 0 },
  { date: '2026-05-04', hour: 13, dials: 3,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-04', hour: 14, dials: 4,  conv: 3, vm: 0, disc: 0 },
  { date: '2026-05-04', hour: 15, dials: 1,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-04', hour: 16, dials: 8,  conv: 2, vm: 0, disc: 0 },
  // May 5
  { date: '2026-05-05', hour: 10, dials: 1,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-05-05', hour: 11, dials: 3,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-05-05', hour: 12, dials: 4,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-05-05', hour: 13, dials: 4,  conv: 2, vm: 0, disc: 0 },
  { date: '2026-05-05', hour: 14, dials: 4,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-05', hour: 15, dials: 5,  conv: 1, vm: 0, disc: 0 },
  // May 6
  { date: '2026-05-06', hour: 11, dials: 4,  conv: 2, vm: 2, disc: 0 },
  { date: '2026-05-06', hour: 12, dials: 2,  conv: 1, vm: 1, disc: 1 },
  { date: '2026-05-06', hour: 13, dials: 4,  conv: 1, vm: 2, disc: 0 },
  { date: '2026-05-06', hour: 14, dials: 2,  conv: 2, vm: 0, disc: 1 },
  { date: '2026-05-06', hour: 15, dials: 5,  conv: 2, vm: 0, disc: 0 },
  { date: '2026-05-06', hour: 16, dials: 4,  conv: 0, vm: 0, disc: 0 },
  // May 7
  { date: '2026-05-07', hour:  9, dials: 0,  conv: 0, vm: 0, disc: 1 },
  { date: '2026-05-07', hour: 11, dials: 6,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-07', hour: 12, dials: 1,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-05-07', hour: 13, dials: 8,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-07', hour: 14, dials: 3,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-07', hour: 15, dials: 5,  conv: 2, vm: 0, disc: 0 },
  // May 8
  { date: '2026-05-08', hour: 11, dials: 7,  conv: 1, vm: 4, disc: 0 },
  { date: '2026-05-08', hour: 12, dials: 8,  conv: 1, vm: 2, disc: 0 },
  { date: '2026-05-08', hour: 13, dials: 1,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-05-08', hour: 16, dials: 1,  conv: 0, vm: 0, disc: 0 },
  // May 11
  { date: '2026-05-11', hour:  9, dials: 5,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-05-11', hour: 10, dials: 3,  conv: 2, vm: 0, disc: 0 },
  { date: '2026-05-11', hour: 11, dials: 8,  conv: 1, vm: 1, disc: 0 },
  { date: '2026-05-11', hour: 12, dials: 8,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-11', hour: 13, dials: 13, conv: 1, vm: 2, disc: 0 },
  { date: '2026-05-11', hour: 14, dials: 8,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-11', hour: 15, dials: 10, conv: 1, vm: 4, disc: 0 },
  { date: '2026-05-11', hour: 16, dials: 5,  conv: 0, vm: 0, disc: 0 },
  // May 12
  { date: '2026-05-12', hour:  9, dials: 2,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-12', hour: 10, dials: 3,  conv: 0, vm: 2, disc: 0 },
  { date: '2026-05-12', hour: 11, dials: 5,  conv: 3, vm: 0, disc: 0 },
  { date: '2026-05-12', hour: 12, dials: 8,  conv: 2, vm: 2, disc: 0 },
  { date: '2026-05-12', hour: 14, dials: 5,  conv: 1, vm: 3, disc: 0 },
  { date: '2026-05-12', hour: 15, dials: 5,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-05-12', hour: 16, dials: 8,  conv: 2, vm: 0, disc: 0 },
  // May 13
  { date: '2026-05-13', hour: 10, dials: 7,  conv: 2, vm: 1, disc: 0 },
  { date: '2026-05-13', hour: 11, dials: 4,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-13', hour: 12, dials: 5,  conv: 2, vm: 0, disc: 1 },
  { date: '2026-05-13', hour: 13, dials: 4,  conv: 2, vm: 0, disc: 0 },
  { date: '2026-05-13', hour: 14, dials: 5,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-13', hour: 15, dials: 2,  conv: 2, vm: 0, disc: 1 },
  { date: '2026-05-13', hour: 16, dials: 4,  conv: 1, vm: 0, disc: 2 },
  // May 14
  { date: '2026-05-14', hour: 10, dials: 5,  conv: 2, vm: 0, disc: 1 },
  { date: '2026-05-14', hour: 11, dials: 2,  conv: 1, vm: 0, disc: 1 },
  { date: '2026-05-14', hour: 13, dials: 2,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-05-14', hour: 14, dials: 4,  conv: 0, vm: 0, disc: 0 },
  { date: '2026-05-14', hour: 15, dials: 5,  conv: 1, vm: 0, disc: 0 },
  { date: '2026-05-14', hour: 16, dials: 6,  conv: 2, vm: 0, disc: 0 },
]

// Demos — at noon UTC on the scheduled date
const TIMMY_DEMO = [
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

// Ghosted / no-show timestamps (UTC, EST = UTC-5)
const TIMMY_GHOSTED = [
  '2026-05-08T16:00:00+00:00',
  '2026-05-12T17:00:00+00:00',
  '2026-05-15T17:00:00+00:00',
  '2026-05-20T17:00:00+00:00',
]
const MUJEEB_GHOSTED = [
  '2026-05-13T19:00:00+00:00',
  '2026-05-20T15:00:00+00:00',
]

type LogEntry = typeof activity_log_entries.$inferInsert

function hourlyToEntries(repId: string, rows: typeof TIMMY_HOURLY): LogEntry[] {
  const entries: LogEntry[] = []
  for (const row of rows) {
    const ts = `${row.date}T${String(row.hour).padStart(2, '0')}:00:00+00:00`
    for (const key of ['dials', 'conv', 'vm', 'disc'] as const) {
      const count = row[key]
      if (count > 0) {
        entries.push({ id: crypto.randomUUID(), rep_id: repId, metric_key: key, delta: count, logged_at: ts })
      }
    }
  }
  return entries
}

function demoToEntries(repId: string, rows: { date: string; demo: number }[]): LogEntry[] {
  return rows.map((d) => ({
    id: crypto.randomUUID(), rep_id: repId, metric_key: 'demo',
    delta: d.demo, logged_at: `${d.date}T12:00:00+00:00`,
  }))
}

function ghostedToEntries(repId: string, timestamps: string[]): LogEntry[] {
  return timestamps.map((ts) => ({
    id: crypto.randomUUID(), rep_id: repId, metric_key: 'ghosted',
    delta: 1, logged_at: ts,
  }))
}

async function seed() {
  const [timmyRep] = await db.select({ id: reps.id }).from(reps).where(ilike(reps.name, '%timmy%'))
  const [mujeebRep] = await db.select({ id: reps.id }).from(reps).where(ilike(reps.name, '%mujeeb%'))

  if (!timmyRep) throw new Error('Timmy not found in reps — run npm run db:seed first')
  if (!mujeebRep) throw new Error('Mujeeb not found in reps — run npm run db:seed first')

  // Only wipe historical entries (up to May 14) — never touch recent live data
  const HISTORICAL_CUTOFF = '2026-05-14T23:59:59.999Z'
  await db.delete(activity_log_entries).where(
    and(eq(activity_log_entries.rep_id, timmyRep.id), lte(activity_log_entries.logged_at, HISTORICAL_CUTOFF))
  )
  await db.delete(activity_log_entries).where(
    and(eq(activity_log_entries.rep_id, mujeebRep.id), lte(activity_log_entries.logged_at, HISTORICAL_CUTOFF))
  )
  console.log('Cleared historical activity_log_entries for Timmy and Mujeeb (up to May 14)')

  const entries: LogEntry[] = [
    ...hourlyToEntries(timmyRep.id,  TIMMY_HOURLY),
    ...hourlyToEntries(mujeebRep.id, MUJEEB_HOURLY),
    ...demoToEntries(timmyRep.id,    TIMMY_DEMO),
    ...demoToEntries(mujeebRep.id,   MUJEEB_DEMO),
    ...ghostedToEntries(timmyRep.id,  TIMMY_GHOSTED),
    ...ghostedToEntries(mujeebRep.id, MUJEEB_GHOSTED),
  ]

  await db.insert(activity_log_entries).values(entries)
  console.log(`Inserted ${entries.length} activity_log_entries`)

  process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) })
