'use server'

import { db } from '@/db'
import { activity_log_entries, closed_deals, clients, tasks, daily_checklist, calendar } from '@/db/schema'
import { eq, and, gte, lte, desc, sql, asc } from 'drizzle-orm'

export async function getActivityCountsAction(startISO: string, endISO: string) {
  const rows = await db
    .select({
      rep_id:     activity_log_entries.rep_id,
      metric_key: activity_log_entries.metric_key,
      total:      sql<number>`cast(sum(${activity_log_entries.delta}) as int)`,
    })
    .from(activity_log_entries)
    .where(and(
      gte(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date`, startISO),
      lte(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date`, endISO),
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
  loggedAt?: string,
) {
  const [entry] = await db
    .insert(activity_log_entries)
    .values({
      rep_id: repId,
      metric_key: metricKey,
      label,
      icon,
      color,
      delta: 1,
      ...(loggedAt ? { logged_at: loggedAt } : {}),
    })
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
      gte(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date`, periodStartISO),
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

export async function createTaskAction(data: {
  title: string
  description?: string
  assigneeIds?: string[]
  createdById: string
  deadline?: string | null
  status?: string
}) {
  const status = data.status ?? 'todo'
  const maxPos = await db
    .select({ max: sql<number>`coalesce(max(${tasks.position}), -1)` })
    .from(tasks)
    .where(eq(tasks.status, status))

  const [task] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description || null,
      assignee_ids: data.assigneeIds ?? [],
      created_by_id: data.createdById,
      deadline: data.deadline || null,
      status,
      position: (maxPos[0]?.max ?? -1) + 1,
    })
    .returning()

  return { task }
}

export async function updateTaskAction(
  taskId: string,
  data: {
    title?: string
    description?: string | null
    assigneeIds?: string[]
    deadline?: string | null
    status?: string
    position?: number
  },
) {
  const [task] = await db
    .update(tasks)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.assigneeIds !== undefined ? { assignee_ids: data.assigneeIds } : {}),
      ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
      updated_at: new Date().toISOString(),
    })
    .where(eq(tasks.id, taskId))
    .returning()

  return { task }
}

export async function deleteTaskAction(taskId: string) {
  await db.delete(tasks).where(eq(tasks.id, taskId))
  return { ok: true }
}

export async function getTasksAction() {
  try {
    return await db
      .select()
      .from(tasks)
      .orderBy(asc(tasks.status), asc(tasks.position), desc(tasks.created_at))
  } catch {
    return []
  }
}

export async function getCalendarEventsForPeriodAction(
  repId: string,
  activityType: string,
  startISO: string,
  endISO: string,
) {
  try {
    return await db
      .select()
      .from(calendar)
      .where(and(
        eq(calendar.rep_id, repId),
        eq(calendar.activity_type, activityType),
        gte(calendar.scheduled_date, startISO),
        lte(calendar.scheduled_date, endISO),
      ))
      .orderBy(desc(calendar.scheduled_date))
  } catch { return [] }
}

export async function deleteCalendarEventAction(eventId: string, repId: string, metricKey: string, periodStartISO: string) {
  try {
    await db.delete(calendar).where(and(eq(calendar.id, eventId), eq(calendar.rep_id, repId)))
  } catch { /* table may not exist yet */ }
  await decrementActivityAction(repId, metricKey, periodStartISO)
  return { ok: true }
}

export async function logCalendarEventAction(data: {
  repId: string
  companyName: string
  activityType: string
  scheduledDate: string
  intent: string
  loggedAt?: string
}) {
  const def = data.activityType === 'disc'
    ? { label: `Discovery booked · ${data.companyName}`, icon: 'calendar', color: '#FFD700', metricKey: 'disc' }
    : { label: `Demo booked · ${data.companyName}`,      icon: 'present',  color: '#00E5A0', metricKey: 'demo' }

  let event = null
  try {
    const [row] = await db
      .insert(calendar)
      .values({
        rep_id:         data.repId,
        company_name:   data.companyName,
        activity_type:  data.activityType,
        scheduled_date: data.scheduledDate,
        intent:         data.intent,
        status:         'scheduled',
      })
      .returning()
    event = row
  } catch { /* table may not exist yet — still log the activity */ }

  const [entry] = await db
    .insert(activity_log_entries)
    .values({
      rep_id:      data.repId,
      metric_key:  def.metricKey,
      label:       def.label,
      icon:        def.icon,
      color:       def.color,
      delta:       1,
      calendar_id: event?.id,
      ...(data.loggedAt ? { logged_at: data.loggedAt } : {}),
    })
    .returning()

  return { event, entry }
}

export async function getCalendarEventsAction(repId: string, dateISO: string) {
  try {
    return await db
      .select()
      .from(calendar)
      .where(and(
        eq(calendar.rep_id, repId),
        eq(calendar.scheduled_date, dateISO),
      ))
      .orderBy(asc(calendar.created_at))
  } catch { return [] }
}

export async function getCalendarEventsForDateRangeAction(repId: string, startISO: string, endISO: string) {
  try {
    return await db
      .select()
      .from(calendar)
      .where(and(
        eq(calendar.rep_id, repId),
        gte(calendar.scheduled_date, startISO),
        lte(calendar.scheduled_date, endISO),
      ))
      .orderBy(desc(calendar.scheduled_date))
  } catch { return [] }
}

export async function getCalendarCompaniesAction() {
  try {
    const rows = await db
      .selectDistinct({ company_name: calendar.company_name })
      .from(calendar)
      .orderBy(asc(calendar.company_name))
    return rows.map((r) => r.company_name)
  } catch { return [] }
}

export async function updateCalendarEventStatusAction(
  eventId: string,
  status: string,
) {
  const [event] = await db
    .update(calendar)
    .set({ status })
    .where(eq(calendar.id, eventId))
    .returning()
  return { event }
}

export async function rescheduleCalendarEventAction(
  eventId: string,
  newDate: string,
) {
  const [event] = await db
    .update(calendar)
    .set({
      scheduled_date:   newDate,
      status:           'scheduled',
      reschedule_count: sql`${calendar.reschedule_count} + 1`,
    })
    .where(eq(calendar.id, eventId))
    .returning()
  return { event }
}

export async function getShowRatesAction() {
  try {
    const rows = await db
      .select({
        rep_id:        calendar.rep_id,
        activity_type: calendar.activity_type,
        total:         sql<number>`cast(count(*) as int)`,
        attended:      sql<number>`cast(sum(case when ${calendar.status} = 'attended' then 1 else 0 end) as int)`,
      })
      .from(calendar)
      .groupBy(calendar.rep_id, calendar.activity_type)
    return rows
  } catch { return [] }
}

export async function addCalendarEntryOnlyAction(data: {
  repId: string
  companyName: string
  activityType: string
  scheduledDate: string
  intent: string
  status?: string
}) {
  const [event] = await db
    .insert(calendar)
    .values({
      rep_id:         data.repId,
      company_name:   data.companyName,
      activity_type:  data.activityType,
      scheduled_date: data.scheduledDate,
      intent:         data.intent,
      status:         data.status ?? 'scheduled',
    })
    .returning()
  return { event }
}

export async function getAttendedConversionsAction() {
  try {
    const allDisc = await db.select().from(calendar).where(eq(calendar.activity_type, 'disc'))
    const attendedDisc = await db
      .select()
      .from(calendar)
      .where(and(eq(calendar.activity_type, 'disc'), eq(calendar.status, 'attended')))

    const allDemos = await db.select().from(calendar).where(eq(calendar.activity_type, 'demo'))
    const attendedDemos = await db
      .select()
      .from(calendar)
      .where(and(eq(calendar.activity_type, 'demo'), eq(calendar.status, 'attended')))

    const closedDeals = await db.select().from(closed_deals)

    const result: Record<string, {
      discBooked: number
      discAttended: number
      discToDemoConversions: number
      demoBooked: number
      demoAttended: number
      demoToClosedConversions: number
    }> = {}

    // Collect all rep IDs (filter out nulls)
    const repIds = new Set<string>()
    allDisc.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })
    allDemos.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })
    attendedDemos.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })
    closedDeals.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })

    for (const repId of repIds) {
      const repAllDisc = allDisc.filter((d) => d.rep_id === repId)
      const repAttendedDisc = attendedDisc.filter((d) => d.rep_id === repId)
      const repAllDemos = allDemos.filter((d) => d.rep_id === repId)
      const repAttendedDemos = attendedDemos.filter((d) => d.rep_id === repId)
      const repClosed = closedDeals.filter((d) => d.rep_id === repId)

      // Count attended disc that led to a demo booking (same company, later date)
      let discToDemoCount = 0
      for (const disc of repAttendedDisc) {
        const hasDemo = repAllDemos.some(
          (demo) => demo.company_name === disc.company_name && demo.scheduled_date > disc.scheduled_date,
        )
        if (hasDemo) discToDemoCount++
      }

      // Count attended demo that led to a closed deal (same company)
      let demoToClosedCount = 0
      for (const demo of repAttendedDemos) {
        const hasClosed = repClosed.some((deal) => deal.company_name === demo.company_name)
        if (hasClosed) demoToClosedCount++
      }

      result[repId] = {
        discBooked: repAllDisc.length,
        discAttended: repAttendedDisc.length,
        discToDemoConversions: discToDemoCount,
        demoBooked: repAllDemos.length,
        demoAttended: repAttendedDemos.length,
        demoToClosedConversions: demoToClosedCount,
      }
    }

    return result
  } catch {
    return {}
  }
}

export async function removeCalendarEventAction(eventId: string) {
  try {
    await db.delete(activity_log_entries).where(eq(activity_log_entries.calendar_id, eventId as unknown as string))
  } catch { /* may not exist */ }
  await db.delete(calendar).where(eq(calendar.id, eventId))
  return { ok: true }
}

export async function editCalendarEventAction(eventId: string, data: { intent?: string; scheduledDate?: string }) {
  const [event] = await db
    .update(calendar)
    .set({
      ...(data.intent        ? { intent: data.intent }                     : {}),
      ...(data.scheduledDate ? { scheduled_date: data.scheduledDate } : {}),
    })
    .where(eq(calendar.id, eventId))
    .returning()
  return { event }
}

export async function getDailyChecklistAction(dateKey: string) {
  try {
    return await db
      .select({ item_id: daily_checklist.item_id, rep_id: daily_checklist.rep_id })
      .from(daily_checklist)
      .where(eq(daily_checklist.date_key, dateKey))
  } catch {
    return []
  }
}

export async function checkDailyItemAction(dateKey: string, itemId: string, repId: string) {
  await db
    .insert(daily_checklist)
    .values({ date_key: dateKey, item_id: itemId, rep_id: repId })
    .onConflictDoNothing()
  return { ok: true }
}

export async function uncheckDailyItemAction(dateKey: string, itemId: string, repId: string) {
  await db
    .delete(daily_checklist)
    .where(and(
      eq(daily_checklist.date_key, dateKey),
      eq(daily_checklist.item_id, itemId),
      eq(daily_checklist.rep_id, repId),
    ))
  return { ok: true }
}
