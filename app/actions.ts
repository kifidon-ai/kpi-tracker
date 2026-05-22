'use server'

import { db } from '@/db'
import { activity_log_entries, closed_deals, clients } from '@/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export async function getActivityCountsAction(startISO: string, endISO: string) {
  const rows = await db
    .select({
      rep_id:     activity_log_entries.rep_id,
      metric_key: activity_log_entries.metric_key,
      total:      sql<number>`cast(sum(${activity_log_entries.delta}) as int)`,
    })
    .from(activity_log_entries)
    .where(and(
      gte(activity_log_entries.logged_at, startISO + 'T00:00:00.000Z'),
      lte(activity_log_entries.logged_at, endISO + 'T23:59:59.999Z'),
    ))
    .groupBy(activity_log_entries.rep_id, activity_log_entries.metric_key)

  const result: Record<string, Record<string, number>> = {}
  rows.forEach(({ rep_id, metric_key, total }) => {
    if (!result[rep_id]) result[rep_id] = {}
    result[rep_id][metric_key] = total ?? 0
  })
  return result
}

export async function logActivityAction(
  repId: string,
  metricKey: string,
  label: string,
  icon: string,
  color: string,
) {
  const [entry] = await db
    .insert(activity_log_entries)
    .values({ rep_id: repId, metric_key: metricKey, label, icon, color, delta: 1 })
    .returning()
  return { entry }
}

export async function decrementActivityAction(repId: string, metricKey: string, periodStartISO: string) {
  const rows = await db
    .select()
    .from(activity_log_entries)
    .where(and(
      eq(activity_log_entries.rep_id, repId),
      eq(activity_log_entries.metric_key, metricKey),
      gte(activity_log_entries.logged_at, periodStartISO + 'T00:00:00.000Z'),
    ))
    .orderBy(desc(activity_log_entries.logged_at))
    .limit(1)

  if (!rows.length) return { deleted: false, id: null }

  const row = rows[0]
  if (row.delta <= 1) {
    await db.delete(activity_log_entries).where(eq(activity_log_entries.id, row.id))
    return { deleted: true, id: row.id }
  }

  await db
    .update(activity_log_entries)
    .set({ delta: row.delta - 1 })
    .where(eq(activity_log_entries.id, row.id))
  return { deleted: false, id: null }
}

export async function getTrendAction(granularity: 'week' | 'day') {
  const windowDays = granularity === 'week' ? 42 : 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)

  const rows = await db
    .select({
      date:       sql<string>`(${activity_log_entries.logged_at} AT TIME ZONE 'UTC')::date::text`,
      metric_key: activity_log_entries.metric_key,
      total:      sql<number>`cast(sum(${activity_log_entries.delta}) as int)`,
    })
    .from(activity_log_entries)
    .where(gte(activity_log_entries.logged_at, cutoff.toISOString()))
    .groupBy(
      sql`(${activity_log_entries.logged_at} AT TIME ZONE 'UTC')::date::text`,
      activity_log_entries.metric_key,
    )
    .orderBy(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'UTC')::date::text`)

  return rows
}

export async function getDiscByHourAction() {
  const rows = await db
    .select({
      hour:  sql<number>`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`,
      total: sql<number>`cast(sum(${activity_log_entries.delta}) as int)`,
    })
    .from(activity_log_entries)
    .where(eq(activity_log_entries.metric_key, 'disc'))
    .groupBy(sql`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`)
    .orderBy(sql`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`)
  return rows
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
      delta: 1,
    })
    .returning()

  return { deal, client, entry }
}
