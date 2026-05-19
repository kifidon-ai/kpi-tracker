'use server'

import { db } from '@/db'
import { activity_log_entries, activity_daily, closed_deals, clients } from '@/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export async function getActivityDailyAction() {
  return db.select().from(activity_daily)
}

export async function getWeeklyCountsAction(startISO: string, endISO?: string) {
  const rows = await db
    .select({ rep_id: activity_log_entries.rep_id, metric_key: activity_log_entries.metric_key })
    .from(activity_log_entries)
    .where(
      endISO
        ? and(gte(activity_log_entries.logged_at, startISO + 'T00:00:00+00'), lte(activity_log_entries.logged_at, endISO + 'T23:59:59+00'))
        : gte(activity_log_entries.logged_at, startISO + 'T00:00:00+00')
    )

  const counts: Record<string, Record<string, number>> = {}
  rows.forEach(({ rep_id, metric_key }) => {
    if (!counts[rep_id]) counts[rep_id] = {}
    counts[rep_id][metric_key] = (counts[rep_id][metric_key] ?? 0) + 1
  })
  return counts
}

// Columns in activity_daily that can be incremented/decremented via log tiles
const DAILY_COLS = new Set(['dials', 'conv', 'vm', 'disc', 'demo', 'onb', 'closed'])

const incMap: Record<string, unknown> = {
  dials:  sql`${activity_daily.dials}  + 1`,
  conv:   sql`${activity_daily.conv}   + 1`,
  vm:     sql`${activity_daily.vm}     + 1`,
  disc:   sql`${activity_daily.disc}   + 1`,
  demo:   sql`${activity_daily.demo}   + 1`,
  onb:    sql`${activity_daily.onb}    + 1`,
  closed: sql`${activity_daily.closed} + 1`,
}

const decMap: Record<string, unknown> = {
  dials:  sql`GREATEST(0, ${activity_daily.dials}  - 1)`,
  conv:   sql`GREATEST(0, ${activity_daily.conv}   - 1)`,
  vm:     sql`GREATEST(0, ${activity_daily.vm}     - 1)`,
  disc:   sql`GREATEST(0, ${activity_daily.disc}   - 1)`,
  demo:   sql`GREATEST(0, ${activity_daily.demo}   - 1)`,
  onb:    sql`GREATEST(0, ${activity_daily.onb}    - 1)`,
  closed: sql`GREATEST(0, ${activity_daily.closed} - 1)`,
}

export async function logActivityAction(
  repId: string,
  metricKey: string,
  label: string,
  icon: string,
  color: string,
) {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const hour = now.getUTCHours()

  const [entry] = await db
    .insert(activity_log_entries)
    .values({ rep_id: repId, metric_key: metricKey, label, icon, color })
    .returning()

  let dailyRow = null
  if (DAILY_COLS.has(metricKey)) {
    const base: Record<string, unknown> = {
      rep_id: repId, date: dateStr, hour,
      dials: 0, conv: 0, vm: 0, disc: 0, demo: 0, onb: 0, closed: 0,
    }
    base[metricKey] = 1
    ;[dailyRow] = await db
      .insert(activity_daily)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values(base as any)
      .onConflictDoUpdate({
        target: [activity_daily.rep_id, activity_daily.date, activity_daily.hour],
        set: { [metricKey]: incMap[metricKey] },
      })
      .returning()
  }

  return { entry, dailyRow }
}

export async function decrementActivityAction(
  repId: string,
  metricKey: string,
  weekStartISO: string,
) {
  const rows = await db
    .select({ id: activity_log_entries.id, logged_at: activity_log_entries.logged_at })
    .from(activity_log_entries)
    .where(
      and(
        eq(activity_log_entries.rep_id, repId),
        eq(activity_log_entries.metric_key, metricKey),
        gte(activity_log_entries.logged_at, weekStartISO + 'T00:00:00+00'),
      )
    )
    .orderBy(desc(activity_log_entries.logged_at))
    .limit(1)

  if (!rows.length) return { deleted: false, id: null, dailyRow: null }

  await db.delete(activity_log_entries).where(eq(activity_log_entries.id, rows[0].id))

  let dailyRow = null
  if (DAILY_COLS.has(metricKey)) {
    const t = new Date(rows[0].logged_at)
    const dateStr = t.toISOString().slice(0, 10)
    const hour = t.getUTCHours()
    ;[dailyRow] = await db
      .update(activity_daily)
      .set({ [metricKey]: decMap[metricKey] })
      .where(and(
        eq(activity_daily.rep_id, repId),
        eq(activity_daily.date, dateStr),
        eq(activity_daily.hour, hour),
      ))
      .returning()
  }

  return { deleted: true, id: rows[0].id, dailyRow }
}

export async function logClosedDealAction(data: {
  repId: string
  companyName: string
  monthlyPrice: number
  closedDate: string
}) {
  const [deal] = await db
    .insert(closed_deals)
    .values({
      rep_id: data.repId,
      company_name: data.companyName,
      monthly_price: data.monthlyPrice,
      closed_date: data.closedDate,
    })
    .returning()

  const [client] = await db
    .insert(clients)
    .values({
      name: data.companyName,
      mrr: data.monthlyPrice,
      since_date: data.closedDate,
      owner_id: data.repId,
      plan: 'Starter',
      status: 'active',
    })
    .returning()

  const [entry] = await db
    .insert(activity_log_entries)
    .values({
      rep_id: data.repId,
      metric_key: 'closed',
      label: `Closed ${data.companyName}`,
      icon: 'trophy',
      color: '#00E5A0',
    })
    .returning()

  return { deal, client, entry }
}
