'use server'

import { db } from '@/db'
import { activity_log_entries, closed_deals, clients, tasks, calendar, targets, metrics } from '@/db/schema'
import { eq, and, gte, lte, desc, sql, asc, lt, ne, or, inArray, isNotNull, isNull, gt } from 'drizzle-orm'

export async function getActivityCountsAction(startISO: string, endISO: string) {
  const rows = await db
    .select({
      rep_id:     activity_log_entries.rep_id,
      metric_key: activity_log_entries.metric_key,
      total:      sql<number>`cast(sum(${activity_log_entries.delta}) as int)`,
    })
    .from(activity_log_entries)
    .where(and(
      isNull(activity_log_entries.deleted_at),
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
  loggedAt?: string,
) {
  const [entry] = await db
    .insert(activity_log_entries)
    .values({
      rep_id: repId,
      metric_key: metricKey,
      delta: 1,
      ...(loggedAt ? { logged_at: loggedAt } : {}),
    })
    .returning()
  return { entry }
}

export async function decrementActivityAction(
  repId: string,
  metricKey: string,
  periodStartISO: string,
  periodEndISO?: string,
) {
  const filters = [
    eq(activity_log_entries.rep_id, repId),
    eq(activity_log_entries.metric_key, metricKey),
    isNull(activity_log_entries.deleted_at),
    gte(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date`, periodStartISO),
  ]
  if (periodEndISO) {
    filters.push(
      lte(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date`, periodEndISO),
    )
  }

  const rows = await db
    .select()
    .from(activity_log_entries)
    .where(and(...filters))
    .orderBy(desc(activity_log_entries.logged_at))
    .limit(1)

  if (!rows.length) return { deleted: false, id: null, calendarId: null as string | null }

  const row = rows[0]
  const calendarId = row.calendar_id ?? null
  const now = new Date().toISOString()

  if (row.delta <= 1) {
    await db.update(activity_log_entries).set({ deleted_at: now }).where(eq(activity_log_entries.id, row.id))
  } else {
    await db
      .update(activity_log_entries)
      .set({ delta: row.delta - 1 })
      .where(eq(activity_log_entries.id, row.id))
  }

  // Disc/demo bookings are tied to a calendar row — soft-delete that too
  if (calendarId) {
    try {
      await db.update(calendar).set({ deleted_at: now }).where(eq(calendar.id, calendarId))
    } catch { /* ignore */ }
  }

  return { deleted: true, id: row.id, calendarId }
}

export async function updateTargetsAction(
  period: string,
  updates: Record<string, number>,
) {
  const [target] = await db
    .update(targets)
    .set(updates)
    .where(eq(targets.period, period))
    .returning()
  return target
}

export async function getTrendAction(startISO: string, endISO: string) {
  const rows = await db
    .select({
      date:       sql<string>`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date::text`,
      metric_key: activity_log_entries.metric_key,
      total:      sql<number>`cast(sum(${activity_log_entries.delta}) as int)`,
    })
    .from(activity_log_entries)
    .where(and(
      isNull(activity_log_entries.deleted_at),
      gte(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date`, startISO),
      lte(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date`, endISO),
    ))
    .groupBy(
      sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date::text`,
      activity_log_entries.metric_key,
    )
    .orderBy(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date::text`)

  return rows
}

/** Activity totals by hour (ET) for a single day. */
export async function getHourlyTrendAction(dateISO: string) {
  const rows = await db
    .select({
      hour:       sql<number>`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`,
      metric_key: activity_log_entries.metric_key,
      total:      sql<number>`cast(sum(${activity_log_entries.delta}) as int)`,
    })
    .from(activity_log_entries)
    .where(and(
      isNull(activity_log_entries.deleted_at),
      eq(sql`(${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::date`, dateISO),
    ))
    .groupBy(
      sql`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`,
      activity_log_entries.metric_key,
    )
    .orderBy(sql`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`)

  return rows
}

export async function getAttendanceTrendAction(startISO: string, endISO: string) {
  try {
    return await db
      .select({
        date: calendar.scheduled_date,
        activity_type: calendar.activity_type,
        total: sql<number>`cast(count(*) as int)`,
      })
      .from(calendar)
      .where(and(
        isNull(calendar.deleted_at),
        gte(calendar.scheduled_date, startISO),
        lte(calendar.scheduled_date, endISO),
        eq(calendar.status, 'attended'),
        inArray(calendar.activity_type, ['disc', 'demo', 'onb']),
      ))
      .groupBy(calendar.scheduled_date, calendar.activity_type)
      .orderBy(calendar.scheduled_date)
  } catch {
    return []
  }
}

export async function getDiscByHourAction() {
  const rows = await db
    .select({
      hour:  sql<number>`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`,
      total: sql<number>`cast(sum(${activity_log_entries.delta}) as int)`,
    })
    .from(activity_log_entries)
    .where(and(
      isNull(activity_log_entries.deleted_at),
      eq(activity_log_entries.metric_key, 'disc'),
    ))
    .groupBy(sql`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`)
    .orderBy(sql`extract(hour from ${activity_log_entries.logged_at} AT TIME ZONE 'America/New_York')::int`)
  return rows
}

/** Disc/demo/onboarding show rate (attended / booked) by day of week. DOW: 0=Sun … 6=Sat. */
export async function getDiscShowRateByDowAction() {
  try {
    const rows = await db
      .select({
        activity_type: calendar.activity_type,
        dow:           sql<number>`extract(dow from ${calendar.scheduled_date})::int`,
        total:         sql<number>`cast(count(*) as int)`,
        attended:      sql<number>`cast(sum(case when ${calendar.status} = 'attended' then 1 else 0 end) as int)`,
      })
      .from(calendar)
      .where(and(
        isNull(calendar.deleted_at),
        inArray(calendar.activity_type, ['disc', 'demo', 'onb']),
        lt(calendar.scheduled_date, sql`CURRENT_DATE`),
      ))
      .groupBy(calendar.activity_type, sql`extract(dow from ${calendar.scheduled_date})::int`)
      .orderBy(calendar.activity_type, sql`extract(dow from ${calendar.scheduled_date})::int`)
    return rows
  } catch { return [] }
}

export async function logClosedDealAction(data: {
  repId: string
  companyName: string
  monthlyPrice: number
  closedDate: string
}) {
  // Create client first
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

  // Create activity log entry for the closed metric
  const [entry] = await db
    .insert(activity_log_entries)
    .values({
      rep_id: data.repId,
      metric_key: 'closed',
      delta: 1,
    })
    .returning()

  // Create closed deal linking client and activity log
  const [deal] = await db
    .insert(closed_deals)
    .values({
      client_id: client.id,
      activity_log_id: entry.id,
      closed_date: data.closedDate,
    })
    .returning()

  return { deal, client, entry }
}

export async function updateClientCancelDateAction(clientId: string, cancelDate: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  const status =
    cancelDate && cancelDate <= today ? 'cancelled' : 'active'

  const [client] = await db
    .update(clients)
    .set({
      cancel_date: cancelDate,
      status,
    })
    .where(eq(clients.id, clientId))
    .returning()

  return { client }
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
        isNull(calendar.deleted_at),
        eq(calendar.rep_id, repId),
        eq(calendar.activity_type, activityType),
        gte(calendar.scheduled_date, startISO),
        lte(calendar.scheduled_date, endISO),
      ))
      .orderBy(desc(calendar.scheduled_date))
  } catch { return [] }
}

export async function deleteCalendarEventAction(eventId: string, repId: string, _metricKey: string, _periodStartISO: string) {
  const now = new Date().toISOString()
  try {
    await db.update(activity_log_entries).set({ deleted_at: now }).where(and(eq(activity_log_entries.calendar_id, eventId), isNull(activity_log_entries.deleted_at)))
  } catch { /* ignore */ }
  try {
    await db.update(calendar).set({ deleted_at: now }).where(and(eq(calendar.id, eventId), eq(calendar.rep_id, repId)))
  } catch { /* table may not exist yet */ }
  return { ok: true }
}

export async function logCalendarEventAction(data: {
  repId: string
  companyName?: string
  clientId?: string
  activityType: string
  scheduledDate: string
  intent: string
  monthlyPrice?: number
  loggedAt?: string
}) {
  const metricKeyMap = {
    disc: 'disc',
    demo: 'demo',
    onb: 'onb',
  }
  const metricKey = metricKeyMap[data.activityType as keyof typeof metricKeyMap] || data.activityType

  let clientId = data.clientId

  // If companyName provided without clientId, try to find or create client
  if (data.companyName && !clientId) {
    try {
      const existing = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.name, data.companyName))
        .limit(1)

      if (existing.length > 0) {
        clientId = existing[0].id
      } else {
        // Create new client if not found
        const [newClient] = await db
          .insert(clients)
          .values({
            name: data.companyName,
            owner_id: data.repId,
            mrr: data.monthlyPrice ?? 0,
            plan: 'Starter',
            status: 'active',
          })
          .returning()
        clientId = newClient.id
      }
    } catch {
      // If lookup fails, we'll proceed without it
      throw new Error('Unable to create/find client for booking')
    }
  }

  if (!clientId) {
    throw new Error('clientId or companyName required for calendar booking')
  }

  // Calendar first so we can link the activity log via calendar_id
  const [event] = await db
    .insert(calendar)
    .values({
      rep_id:         data.repId,
      client_id:      clientId,
      activity_type:  data.activityType,
      scheduled_date: data.scheduledDate,
      intent:         data.intent,
      status:         'scheduled',
    })
    .returning()

  const [entry] = await db
    .insert(activity_log_entries)
    .values({
      rep_id:      data.repId,
      metric_key:  metricKey,
      delta:       1,
      calendar_id: event.id,
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
        isNull(calendar.deleted_at),
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
        isNull(calendar.deleted_at),
        eq(calendar.rep_id, repId),
        gte(calendar.scheduled_date, startISO),
        lte(calendar.scheduled_date, endISO),
      ))
      .orderBy(desc(calendar.scheduled_date))
  } catch { return [] }
}

export async function getCalendarEventsForDateRangeAllRepsAction(startISO: string, endISO: string) {
  try {
    return await db
      .select()
      .from(calendar)
      .where(and(
        isNull(calendar.deleted_at),
        gte(calendar.scheduled_date, startISO),
        lte(calendar.scheduled_date, endISO),
      ))
      .orderBy(desc(calendar.scheduled_date))
  } catch { return [] }
}

export async function getCalendarCompaniesAction() {
  try {
    const rows = await db
      .selectDistinct({ company_name: clients.name })
      .from(calendar)
      .innerJoin(clients, eq(calendar.client_id, clients.id))
      .where(isNull(calendar.deleted_at))
      .orderBy(asc(clients.name))
    return rows.map((r) => r.company_name)
  } catch { return [] }
}

/** Pending onboarding meetings in a date range (still scheduled only — not attended/no-show). */
export async function getPendingOnboardingsAction(startISO: string, endISO: string) {
  try {
    return await db
      .select({
        company_name:   clients.name,
        monthly_price:  clients.mrr,
        scheduled_date: calendar.scheduled_date,
        status:         calendar.status,
      })
      .from(calendar)
      .innerJoin(clients, eq(calendar.client_id, clients.id))
      .where(and(
        isNull(calendar.deleted_at),
        eq(calendar.activity_type, 'onb'),
        gte(calendar.scheduled_date, startISO),
        lte(calendar.scheduled_date, endISO),
        eq(calendar.status, 'scheduled'),
      ))
      .orderBy(asc(calendar.scheduled_date))
  } catch {
    return []
  }
}

/** Latest onboarding deal price per company (lowercased key → monthly price). */
export async function getOnboardingPricesAction() {
  try {
    const rows = await db
      .select({
        company_name:  clients.name,
        monthly_price: clients.mrr,
        scheduled_date: calendar.scheduled_date,
        created_at:    calendar.created_at,
      })
      .from(calendar)
      .innerJoin(clients, eq(calendar.client_id, clients.id))
      .where(and(
        isNull(calendar.deleted_at),
        eq(calendar.activity_type, 'onb'),
        isNotNull(clients.mrr),
        gt(clients.mrr, 0),
      ))
      .orderBy(desc(calendar.scheduled_date), desc(calendar.created_at))

    const map: Record<string, number> = {}
    for (const r of rows) {
      const key = r.company_name.toLowerCase()
      if (map[key] === undefined && r.monthly_price != null) {
        map[key] = r.monthly_price
      }
    }
    return map
  } catch {
    return {}
  }
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

export async function getShowRatesAction(startISO?: string, endISO?: string) {
  try {
    // Default (no bounds): all calendar entries scheduled before today.
    // With bounds: entries scheduled within the given period.
    const dateFilter = startISO && endISO
      ? and(
          gte(calendar.scheduled_date, startISO),
          lte(calendar.scheduled_date, endISO),
        )
      : lt(calendar.scheduled_date, sql`CURRENT_DATE`)
    const rows = await db
      .select({
        rep_id:        calendar.rep_id,
        activity_type: calendar.activity_type,
        total:         sql<number>`cast(count(*) as int)`,
        attended:      sql<number>`cast(sum(case when ${calendar.status} = 'attended' then 1 else 0 end) as int)`,
      })
      .from(calendar)
      .where(and(isNull(calendar.deleted_at), dateFilter))
      .groupBy(calendar.rep_id, calendar.activity_type)
    return rows
  } catch { return [] }
}

export async function addCalendarEntryOnlyAction(data: {
  repId: string
  companyName?: string
  clientId?: string
  activityType: string
  scheduledDate: string
  intent: string
  status?: string
}) {
  let clientId = data.clientId

  // If companyName provided without clientId, try to find or create client
  if (data.companyName && !clientId) {
    try {
      const existing = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.name, data.companyName))
        .limit(1)

      if (existing.length > 0) {
        clientId = existing[0].id
      } else {
        // Create new client if not found
        const [newClient] = await db
          .insert(clients)
          .values({
            name: data.companyName,
            owner_id: data.repId,
            plan: 'Starter',
            status: 'active',
          })
          .returning()
        clientId = newClient.id
      }
    } catch {
      throw new Error('Unable to create/find client for calendar entry')
    }
  }

  if (!clientId) {
    throw new Error('clientId or companyName required for calendar entry')
  }

  const [event] = await db
    .insert(calendar)
    .values({
      rep_id:         data.repId,
      client_id:      clientId,
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
    // Include past meetings always; include today and future meetings only if resolved (attended / no_show)
    const resolved = or(eq(calendar.status, 'attended'), eq(calendar.status, 'no_show'))
    const pastOrResolved = or(lt(calendar.scheduled_date, sql`CURRENT_DATE`), and(gte(calendar.scheduled_date, sql`CURRENT_DATE`), resolved))

    const allDisc = await db.select().from(calendar).where(and(isNull(calendar.deleted_at), eq(calendar.activity_type, 'disc'), pastOrResolved))
    const attendedDisc = await db
      .select()
      .from(calendar)
      .where(and(isNull(calendar.deleted_at), eq(calendar.activity_type, 'disc'), eq(calendar.status, 'attended'), pastOrResolved))

    const allDemos = await db.select().from(calendar).where(and(isNull(calendar.deleted_at), eq(calendar.activity_type, 'demo'), pastOrResolved))
    const attendedDemos = await db
      .select()
      .from(calendar)
      .where(and(isNull(calendar.deleted_at), eq(calendar.activity_type, 'demo'), eq(calendar.status, 'attended'), pastOrResolved))

    const allOnb = await db.select().from(calendar).where(and(isNull(calendar.deleted_at), eq(calendar.activity_type, 'onb'), pastOrResolved))
    const attendedOnb = await db
      .select()
      .from(calendar)
      .where(and(isNull(calendar.deleted_at), eq(calendar.activity_type, 'onb'), eq(calendar.status, 'attended'), pastOrResolved))

    // All demos/onboardings ever (including future) to check conversions from prior stages
    const allDemosIncludingFuture = await db.select().from(calendar).where(and(isNull(calendar.deleted_at), eq(calendar.activity_type, 'demo')))
    const allOnbIncludingFuture = await db.select().from(calendar).where(and(isNull(calendar.deleted_at), eq(calendar.activity_type, 'onb')))

    // Closed deals with rep and client info
    const closedDealsData = await db
      .select({
        deal_id: closed_deals.id,
        client_id: closed_deals.client_id,
        rep_id: activity_log_entries.rep_id,
      })
      .from(closed_deals)
      .innerJoin(activity_log_entries, eq(closed_deals.activity_log_id, activity_log_entries.id))

    const result: Record<string, {
      discBooked: number
      discAttended: number
      discToDemoConversions: number
      demoBooked: number
      demoAttended: number
      demoToOnbConversions: number
      onbBooked: number
      onbAttended: number
      onbToClosedConversions: number
    }> = {}

    // Collect all rep IDs (filter out nulls)
    const repIds = new Set<string>()
    allDisc.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })
    allDemos.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })
    attendedDemos.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })
    allOnb.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })
    closedDealsData.forEach((d) => { if (d.rep_id) repIds.add(d.rep_id) })

    for (const repId of repIds) {
      const repAllDisc = allDisc.filter((d) => d.rep_id === repId)
      const repAttendedDisc = attendedDisc.filter((d) => d.rep_id === repId)
      const repAllDemos = allDemos.filter((d) => d.rep_id === repId)
      const repAttendedDemos = attendedDemos.filter((d) => d.rep_id === repId)
      const repAllDemosIncludingFuture = allDemosIncludingFuture.filter((d) => d.rep_id === repId)
      const repAllOnb = allOnb.filter((d) => d.rep_id === repId)
      const repAttendedOnb = attendedOnb.filter((d) => d.rep_id === repId)
      const repAllOnbIncludingFuture = allOnbIncludingFuture.filter((d) => d.rep_id === repId)
      const repClosed = closedDealsData.filter((d) => d.rep_id === repId)

      // Count attended disc that led to a demo booking anytime (including future demos) — same client
      let discToDemoCount = 0
      for (const disc of repAttendedDisc) {
        const hasDemo = repAllDemosIncludingFuture.some(
          (demo) => demo.client_id === disc.client_id && demo.scheduled_date >= disc.scheduled_date,
        )
        if (hasDemo) discToDemoCount++
      }

      // Count attended demo that led to an onboarding booking (same client, on/after demo)
      let demoToOnbCount = 0
      for (const demo of repAttendedDemos) {
        const hasOnb = repAllOnbIncludingFuture.some(
          (onb) => onb.client_id === demo.client_id && onb.scheduled_date >= demo.scheduled_date,
        )
        if (hasOnb) demoToOnbCount++
      }

      // Count attended onboarding that led to a closed deal (same client)
      let onbToClosedCount = 0
      for (const onb of repAttendedOnb) {
        const hasClosed = repClosed.some((deal) => deal.client_id === onb.client_id)
        if (hasClosed) onbToClosedCount++
      }

      result[repId] = {
        discBooked: repAllDisc.length,
        discAttended: repAttendedDisc.length,
        discToDemoConversions: discToDemoCount,
        demoBooked: repAllDemos.length,
        demoAttended: repAttendedDemos.length,
        demoToOnbConversions: demoToOnbCount,
        onbBooked: repAllOnb.length,
        onbAttended: repAttendedOnb.length,
        onbToClosedConversions: onbToClosedCount,
      }
    }

    return result
  } catch {
    return {}
  }
}

export async function removeCalendarEventAction(eventId: string) {
  const now = new Date().toISOString()
  try {
    await db.update(activity_log_entries).set({ deleted_at: now }).where(and(eq(activity_log_entries.calendar_id, eventId as unknown as string), isNull(activity_log_entries.deleted_at)))
  } catch { /* may not exist */ }
  await db.update(calendar).set({ deleted_at: now }).where(eq(calendar.id, eventId))
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

