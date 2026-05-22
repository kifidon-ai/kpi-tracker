/**
 * One-shot insert: Mujeeb's May 21 activity, one row per tap (delta=1).
 * Deletes any Mujeeb entries already logged on May 21 before re-inserting.
 * 10am–5pm ET = 14:00–21:00 UTC (EDT = UTC-4).
 */
import { db } from './index'
import { reps, activity_log_entries } from './schema'
import { ilike, and, eq, gte, lt } from 'drizzle-orm'

const METRIC_INFO: Record<string, { label: string; icon: string; color: string }> = {
  dials:    { label: 'Dial logged',         icon: 'phone',    color: '#00D4FF' },
  conv:     { label: 'Conversation logged', icon: 'chat',     color: '#8B5CF6' },
  vm:       { label: 'Voicemail logged',    icon: 'voicemail',color: '#5A6685' },
  disc:     { label: 'Discovery booked',    icon: 'calendar', color: '#FFB800' },
  disc_att: { label: 'Discovery attended',  icon: 'check',    color: '#F2A300' },
  demo:     { label: 'Demo booked',         icon: 'present',  color: '#FF3D9A' },
}

// Each entry: [UTC timestamp, metric_key]
// Dials every ~5-7 min; vm/conv right after a dial; disc after a conv; meetings at scheduled times
const TAPS: [string, keyof typeof METRIC_INFO][] = [
  // 10am ET (14:xx UTC)
  ['2026-05-21T14:02:00+00:00', 'dials'],
  ['2026-05-21T14:07:00+00:00', 'dials'],
  ['2026-05-21T14:08:00+00:00', 'vm'],
  ['2026-05-21T14:12:00+00:00', 'dials'],
  ['2026-05-21T14:13:00+00:00', 'conv'],
  ['2026-05-21T14:17:00+00:00', 'dials'],
  ['2026-05-21T14:22:00+00:00', 'dials'],
  ['2026-05-21T14:28:00+00:00', 'dials'],
  ['2026-05-21T14:29:00+00:00', 'conv'],
  ['2026-05-21T14:31:00+00:00', 'disc'],
  ['2026-05-21T14:34:00+00:00', 'dials'],
  ['2026-05-21T14:40:00+00:00', 'dials'],
  ['2026-05-21T14:46:00+00:00', 'dials'],
  ['2026-05-21T14:53:00+00:00', 'dials'],
  // 11am ET (15:xx UTC)
  ['2026-05-21T15:01:00+00:00', 'dials'],
  ['2026-05-21T15:06:00+00:00', 'dials'],
  ['2026-05-21T15:07:00+00:00', 'vm'],
  ['2026-05-21T15:12:00+00:00', 'dials'],
  ['2026-05-21T15:13:00+00:00', 'conv'],
  ['2026-05-21T15:18:00+00:00', 'dials'],
  ['2026-05-21T15:24:00+00:00', 'dials'],
  ['2026-05-21T15:25:00+00:00', 'conv'],
  ['2026-05-21T15:27:00+00:00', 'disc'],
  ['2026-05-21T15:30:00+00:00', 'dials'],
  ['2026-05-21T15:37:00+00:00', 'dials'],
  ['2026-05-21T15:44:00+00:00', 'dials'],
  ['2026-05-21T15:51:00+00:00', 'dials'],
  // 12pm ET (16:xx UTC)
  ['2026-05-21T16:03:00+00:00', 'dials'],
  ['2026-05-21T16:12:00+00:00', 'dials'],
  ['2026-05-21T16:21:00+00:00', 'dials'],
  ['2026-05-21T16:22:00+00:00', 'conv'],
  ['2026-05-21T16:31:00+00:00', 'dials'],
  ['2026-05-21T16:41:00+00:00', 'dials'],
  ['2026-05-21T16:51:00+00:00', 'dials'],
  // 1pm ET (17:xx UTC) — disc_att at 1:00 (scheduled meeting)
  ['2026-05-21T17:00:00+00:00', 'disc_att'],
  ['2026-05-21T17:08:00+00:00', 'dials'],
  ['2026-05-21T17:14:00+00:00', 'dials'],
  ['2026-05-21T17:15:00+00:00', 'vm'],
  ['2026-05-21T17:21:00+00:00', 'dials'],
  ['2026-05-21T17:28:00+00:00', 'dials'],
  ['2026-05-21T17:29:00+00:00', 'conv'],
  ['2026-05-21T17:31:00+00:00', 'disc'],
  ['2026-05-21T17:35:00+00:00', 'dials'],
  ['2026-05-21T17:42:00+00:00', 'dials'],
  ['2026-05-21T17:49:00+00:00', 'dials'],
  ['2026-05-21T17:55:00+00:00', 'dials'],
  // 2pm ET (18:xx UTC) — demo booked early in the hour
  ['2026-05-21T18:05:00+00:00', 'demo'],
  ['2026-05-21T18:10:00+00:00', 'dials'],
  ['2026-05-21T18:16:00+00:00', 'dials'],
  ['2026-05-21T18:23:00+00:00', 'dials'],
  ['2026-05-21T18:24:00+00:00', 'conv'],
  ['2026-05-21T18:26:00+00:00', 'disc'],
  ['2026-05-21T18:29:00+00:00', 'dials'],
  ['2026-05-21T18:35:00+00:00', 'dials'],
  ['2026-05-21T18:41:00+00:00', 'dials'],
  ['2026-05-21T18:47:00+00:00', 'dials'],
  ['2026-05-21T18:51:00+00:00', 'dials'],
  ['2026-05-21T18:55:00+00:00', 'dials'],
  ['2026-05-21T18:58:00+00:00', 'dials'],
  // 3pm ET (19:xx UTC)
  ['2026-05-21T19:04:00+00:00', 'dials'],
  ['2026-05-21T19:11:00+00:00', 'dials'],
  ['2026-05-21T19:19:00+00:00', 'dials'],
  ['2026-05-21T19:27:00+00:00', 'dials'],
  ['2026-05-21T19:28:00+00:00', 'conv'],
  ['2026-05-21T19:34:00+00:00', 'dials'],
  ['2026-05-21T19:41:00+00:00', 'dials'],
  ['2026-05-21T19:48:00+00:00', 'dials'],
  ['2026-05-21T19:55:00+00:00', 'dials'],
  // 4pm ET (20:xx UTC)
  ['2026-05-21T20:03:00+00:00', 'dials'],
  ['2026-05-21T20:10:00+00:00', 'dials'],
  ['2026-05-21T20:18:00+00:00', 'dials'],
  ['2026-05-21T20:27:00+00:00', 'dials'],
  ['2026-05-21T20:36:00+00:00', 'dials'],
  ['2026-05-21T20:44:00+00:00', 'dials'],
  ['2026-05-21T20:52:00+00:00', 'dials'],
]

type LogEntry = typeof activity_log_entries.$inferInsert

async function run() {
  const [mujeeb] = await db.select({ id: reps.id }).from(reps).where(ilike(reps.name, '%mujeeb%'))
  if (!mujeeb) throw new Error('Mujeeb not found in reps')

  // Delete any Mujeeb entries already on May 21 (the previous 22 wrong ones)
  await db.delete(activity_log_entries).where(
    and(
      eq(activity_log_entries.rep_id, mujeeb.id),
      gte(activity_log_entries.logged_at, '2026-05-21T00:00:00+00:00'),
      lt(activity_log_entries.logged_at,  '2026-05-22T00:00:00+00:00'),
    )
  )

  const entries: LogEntry[] = TAPS.map(([ts, key]) => {
    const info = METRIC_INFO[key]
    return { id: crypto.randomUUID(), rep_id: mujeeb.id, metric_key: key, label: info.label, icon: info.icon, color: info.color, delta: 1, logged_at: ts }
  })

  await db.insert(activity_log_entries).values(entries)

  // Verify counts
  const counts: Record<string, number> = {}
  entries.forEach((e) => { counts[e.metric_key] = (counts[e.metric_key] ?? 0) + 1 })
  console.log(`Inserted ${entries.length} entries:`, counts)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
