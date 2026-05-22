/**
 * One-shot insert: Timmy's May 21 activity, one row per tap (delta=1).
 * 10am–5pm ET = 14:00–21:00 UTC (EDT = UTC-4).
 * No deletes — appends only.
 */
import { db } from './index'
import { reps, activity_log_entries } from './schema'
import { ilike } from 'drizzle-orm'

const METRIC_INFO: Record<string, { label: string; icon: string; color: string }> = {
  dials:    { label: 'Dial logged',         icon: 'phone',    color: '#00D4FF' },
  conv:     { label: 'Conversation logged', icon: 'chat',     color: '#8B5CF6' },
  vm:       { label: 'Voicemail logged',    icon: 'voicemail',color: '#5A6685' },
  disc:     { label: 'Discovery booked',    icon: 'calendar', color: '#FFB800' },
  demo_att: { label: 'Demo attended',       icon: 'check',    color: '#E0357F' },
}

// Each entry: [UTC timestamp, metric_key]
// 19 dials, 8 conv, 7 vm, 5 disc, 1 demo_att = 40 total
const TAPS: [string, keyof typeof METRIC_INFO][] = [
  // 10am ET (14:xx UTC) — 4 dials, 2 conv, 1 vm, 2 disc
  ['2026-05-21T14:03:00+00:00', 'dials'],
  ['2026-05-21T14:04:00+00:00', 'conv'],
  ['2026-05-21T14:06:00+00:00', 'disc'],
  ['2026-05-21T14:11:00+00:00', 'dials'],
  ['2026-05-21T14:12:00+00:00', 'vm'],
  ['2026-05-21T14:19:00+00:00', 'dials'],
  ['2026-05-21T14:20:00+00:00', 'conv'],
  ['2026-05-21T14:22:00+00:00', 'disc'],
  ['2026-05-21T14:29:00+00:00', 'dials'],
  // 11am ET (15:xx UTC) — demo_att at :00, 3 dials, 1 conv, 1 vm
  ['2026-05-21T15:00:00+00:00', 'demo_att'],
  ['2026-05-21T15:08:00+00:00', 'dials'],
  ['2026-05-21T15:16:00+00:00', 'dials'],
  ['2026-05-21T15:17:00+00:00', 'conv'],
  ['2026-05-21T15:26:00+00:00', 'dials'],
  ['2026-05-21T15:27:00+00:00', 'vm'],
  // 12pm ET (16:xx UTC) — 2 dials, 1 conv, 1 vm (lighter, post-meeting)
  ['2026-05-21T16:10:00+00:00', 'dials'],
  ['2026-05-21T16:11:00+00:00', 'conv'],
  ['2026-05-21T16:22:00+00:00', 'dials'],
  ['2026-05-21T16:23:00+00:00', 'vm'],
  // 1pm ET (17:xx UTC) — 4 dials, 1 conv, 2 vm, 2 disc
  ['2026-05-21T17:04:00+00:00', 'dials'],
  ['2026-05-21T17:05:00+00:00', 'vm'],
  ['2026-05-21T17:12:00+00:00', 'dials'],
  ['2026-05-21T17:13:00+00:00', 'conv'],
  ['2026-05-21T17:15:00+00:00', 'disc'],
  ['2026-05-21T17:22:00+00:00', 'dials'],
  ['2026-05-21T17:23:00+00:00', 'vm'],
  ['2026-05-21T17:31:00+00:00', 'dials'],
  ['2026-05-21T17:32:00+00:00', 'disc'],
  // 2pm ET (18:xx UTC) — 3 dials, 1 conv, 1 vm, 1 disc
  ['2026-05-21T18:07:00+00:00', 'dials'],
  ['2026-05-21T18:08:00+00:00', 'vm'],
  ['2026-05-21T18:16:00+00:00', 'dials'],
  ['2026-05-21T18:17:00+00:00', 'conv'],
  ['2026-05-21T18:19:00+00:00', 'disc'],
  ['2026-05-21T18:28:00+00:00', 'dials'],
  // 3pm ET (19:xx UTC) — 2 dials, 1 conv, 1 vm
  ['2026-05-21T19:09:00+00:00', 'dials'],
  ['2026-05-21T19:10:00+00:00', 'conv'],
  ['2026-05-21T19:21:00+00:00', 'dials'],
  ['2026-05-21T19:22:00+00:00', 'vm'],
  // 4pm ET (20:xx UTC) — 1 dial, 1 conv
  ['2026-05-21T20:14:00+00:00', 'dials'],
  ['2026-05-21T20:15:00+00:00', 'conv'],
]

type LogEntry = typeof activity_log_entries.$inferInsert

async function run() {
  const [timmy] = await db.select({ id: reps.id }).from(reps).where(ilike(reps.name, '%timmy%'))
  if (!timmy) throw new Error('Timmy not found in reps')

  const entries: LogEntry[] = TAPS.map(([ts, key]) => {
    const info = METRIC_INFO[key]
    return { id: crypto.randomUUID(), rep_id: timmy.id, metric_key: key, label: info.label, icon: info.icon, color: info.color, delta: 1, logged_at: ts }
  })

  await db.insert(activity_log_entries).values(entries)

  const counts: Record<string, number> = {}
  entries.forEach((e) => { counts[e.metric_key] = (counts[e.metric_key] ?? 0) + 1 })
  console.log(`Inserted ${entries.length} entries:`, counts)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
