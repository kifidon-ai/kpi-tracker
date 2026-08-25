import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { db } from '@/db'
import {
  activity_log_entries,
  calendar,
  clients,
  closed_deals,
  reps,
} from '@/db/schema'
import { ALL_METRICS } from '@/lib/constants'
import {
  addCalendarEntryOnlyAction,
  decrementActivityAction,
  editCalendarEventAction,
  getActivityCountsAction,
  getAttendanceTrendAction,
  getAttendedConversionsAction,
  getCalendarEventsForDateRangeAction,
  getCalendarEventsForDateRangeAllRepsAction,
  getDiscByHourAction,
  getDiscShowRateByDowAction,
  getHourlyTrendAction,
  getPendingOnboardingsAction,
  getShowRatesAction,
  getTrendAction,
  logActivityAction,
  logCalendarEventAction,
  logClosedDealAction,
  removeCalendarEventAction,
  rescheduleCalendarEventAction,
  updateCalendarEventStatusAction,
} from '@/app/actions'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'

function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

/** Every write returns this shape so Jeffrey can reverse from the tool result. */
function writeResult(payload: {
  write: string
  args: Record<string, unknown>
  before: unknown
  after: unknown
  undo: { tool: string; args: Record<string, unknown> } | null
}) {
  return jsonResult(payload)
}

function metricMeta(metricKey: string) {
  const meta = ALL_METRICS.find((m) => m.k === metricKey)
  if (!meta) {
    throw new Error(
      `Unknown metric_key ${metricKey}. Valid: ${ALL_METRICS.map((m) => m.k).join(', ')}`,
    )
  }
  return meta
}

async function getMeeting(eventId: string) {
  const [row] = await db.select().from(calendar).where(and(eq(calendar.id, eventId), isNull(calendar.deleted_at))).limit(1)
  return row ?? null
}

async function getActivity(entryId: string) {
  const [row] = await db
    .select()
    .from(activity_log_entries)
    .where(and(eq(activity_log_entries.id, entryId), isNull(activity_log_entries.deleted_at)))
    .limit(1)
  return row ?? null
}

/** America/New_York calendar day from an ISO timestamp. */
function nyDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const repId = z.string().min(1)
const meetingType = z.enum(['disc', 'demo', 'onb'])
const meetingStatus = z.enum(['scheduled', 'attended', 'no_show'])
const intent = z.enum(['low', 'medium', 'high'])

export function registerKpiTools(server: McpServer) {
  server.tool(
    'list_reps',
    'List sales reps (id, name, initials, role, active). Use rep ids in other tools.',
    async () => {
      const rows = await db
        .select({
          id: reps.id,
          name: reps.name,
          initials: reps.initials,
          role: reps.role,
          is_active: reps.is_active,
          color: reps.color,
        })
        .from(reps)
        .orderBy(asc(reps.name))
      return jsonResult(rows)
    },
  )

  server.tool(
    'list_clients',
    'List clients for Team Performance gauges (MRR, ARR, active count). Includes cancel_date and owner_id.',
    async () => {
      const rows = await db
        .select({
          id: clients.id,
          name: clients.name,
          mrr: clients.mrr,
          since_date: clients.since_date,
          cancel_date: clients.cancel_date,
          owner_id: clients.owner_id,
          status: clients.status,
          plan: clients.plan,
        })
        .from(clients)
        .orderBy(desc(clients.mrr))
      return jsonResult(rows)
    },
  )

  server.tool(
    'get_activity_counts',
    'Activity log totals by rep and metric for a date range (America/New_York calendar days). Same data as Team Performance pipeline counts.',
    { start_date: dateStr, end_date: dateStr },
    async ({ start_date, end_date }) =>
      jsonResult(await getActivityCountsAction(start_date, end_date)),
  )

  server.tool(
    'get_show_rates',
    'Meeting show rates by rep and activity type. Omit dates for all past meetings before today; pass both for a period.',
    {
      start_date: dateStr.optional(),
      end_date: dateStr.optional(),
    },
    async ({ start_date, end_date }) =>
      jsonResult(await getShowRatesAction(start_date, end_date)),
  )

  server.tool(
    'get_pending_onboardings',
    'Scheduled (not yet attended/no-show) onboarding meetings in a date range — feeds gauge projections.',
    { start_date: dateStr, end_date: dateStr },
    async ({ start_date, end_date }) =>
      jsonResult(await getPendingOnboardingsAction(start_date, end_date)),
  )

  server.tool(
    'get_conversions',
    'Attended-stage conversion funnel per rep: disc→demo, demo→onb, onb→closed.',
    async () => jsonResult(await getAttendedConversionsAction()),
  )

  server.tool(
    'get_meetings',
    'List calendar meetings in a date range. Optional rep_id and activity_type (disc|demo|onb).',
    {
      start_date: dateStr,
      end_date: dateStr,
      rep_id: repId.optional(),
      activity_type: meetingType.optional(),
    },
    async ({ start_date, end_date, rep_id, activity_type }) => {
      const rows = rep_id
        ? await getCalendarEventsForDateRangeAction(rep_id, start_date, end_date)
        : await getCalendarEventsForDateRangeAllRepsAction(start_date, end_date)
      const filtered = activity_type
        ? rows.filter((r) => r.activity_type === activity_type)
        : rows
      return jsonResult(filtered)
    },
  )

  server.tool(
    'get_activity_trend',
    'Daily activity totals by metric across a date range (Team Performance trend chart).',
    { start_date: dateStr, end_date: dateStr },
    async ({ start_date, end_date }) =>
      jsonResult(await getTrendAction(start_date, end_date)),
  )

  server.tool(
    'get_hourly_trend',
    'Hourly activity totals for a single America/New_York calendar day.',
    { date: dateStr },
    async ({ date }) => jsonResult(await getHourlyTrendAction(date)),
  )

  server.tool(
    'get_attendance_trend',
    'Daily attended/no-show meeting counts across a date range.',
    { start_date: dateStr, end_date: dateStr },
    async ({ start_date, end_date }) =>
      jsonResult(await getAttendanceTrendAction(start_date, end_date)),
  )

  server.tool(
    'get_meetings_by_hour',
    'Historical meeting bookings grouped by hour-of-day (discovery focus on Team Performance).',
    async () => jsonResult(await getDiscByHourAction()),
  )

  server.tool(
    'get_show_rate_by_dow',
    'Show rates by day-of-week for disc/demo/onb (Team Performance DOW chart).',
    async () => jsonResult(await getDiscShowRateByDowAction()),
  )

  server.tool(
    'log_activity',
    'Append +1 to the activity log. Returns write/before/after/undo — keep the result to reverse later.',
    {
      rep_id: repId,
      metric_key: z.string().min(1),
      logged_at: z.string().datetime({ offset: true }).optional(),
    },
    async ({ rep_id, metric_key, logged_at }) => {
      const meta = metricMeta(metric_key)
      const args = { rep_id, metric_key, logged_at: logged_at ?? null }
      const { entry } = await logActivityAction(
        rep_id,
        meta.k,
        logged_at,
      )
      return writeResult({
        write: 'log_activity',
        args,
        before: null,
        after: { entry },
        undo: {
          tool: 'delete_activity',
          args: { entry_id: entry.id },
        },
      })
    },
  )

  server.tool(
    'decrement_activity',
    'Remove the most recent activity log for a rep/metric within a period (and linked calendar row if any). Returns the deleted row in after.',
    {
      rep_id: repId,
      metric_key: z.string().min(1),
      period_start: dateStr,
      period_end: dateStr.optional(),
    },
    async ({ rep_id, metric_key, period_start, period_end }) => {
      metricMeta(metric_key)
      const args = { rep_id, metric_key, period_start, period_end: period_end ?? null }
      const candidates = await db
        .select()
        .from(activity_log_entries)
        .where(
          and(
            eq(activity_log_entries.rep_id, rep_id),
            eq(activity_log_entries.metric_key, metric_key),
          ),
        )
        .orderBy(desc(activity_log_entries.logged_at))
        .limit(50)
      const before =
        candidates.find((row) => {
          const d = nyDate(row.logged_at)
          if (d < period_start) return false
          if (period_end && d > period_end) return false
          return true
        }) ?? null

      const result = await decrementActivityAction(
        rep_id,
        metric_key,
        period_start,
        period_end,
      )
      return writeResult({
        write: 'decrement_activity',
        args,
        before: before ? { entry: before } : null,
        after: result,
        undo: before
          ? {
              tool: 'log_activity',
              args: {
                rep_id: before.rep_id,
                metric_key: before.metric_key,
                logged_at: before.logged_at,
              },
            }
          : null,
      })
    },
  )

  server.tool(
    'delete_activity',
    'Delete one activity log row by id (precise undo for log_activity). If linked to a calendar meeting, deletes that meeting too.',
    { entry_id: z.string().uuid() },
    async ({ entry_id }) => {
      const before = await getActivity(entry_id)
      if (!before) {
        return writeResult({
          write: 'delete_activity',
          args: { entry_id },
          before: null,
          after: { deleted: false },
          undo: null,
        })
      }
      const calendarId = before.calendar_id
      const now = new Date().toISOString()
      await db.update(activity_log_entries).set({ deleted_at: now }).where(eq(activity_log_entries.id, entry_id))
      if (calendarId) {
        try {
          await db.update(calendar).set({ deleted_at: now }).where(eq(calendar.id, calendarId))
        } catch { /* ignore */ }
      }
      return writeResult({
        write: 'delete_activity',
        args: { entry_id },
        before: { entry: before },
        after: { deleted: true, calendar_id: calendarId },
        undo: {
          tool: 'log_activity',
          args: {
            rep_id: before.rep_id,
            metric_key: before.metric_key,
            logged_at: before.logged_at,
          },
        },
      })
    },
  )

  server.tool(
    'create_meeting',
    'Create a disc/demo/onb meeting. Returns write/before/after/undo with event (+ activity entry when count_as_booked).',
    {
      rep_id: repId,
      company_name: z.string().min(1),
      activity_type: meetingType,
      scheduled_date: dateStr,
      intent: intent.default('medium'),
      monthly_price: z.number().positive().optional(),
      count_as_booked: z.boolean().default(true),
      logged_at: z.string().datetime({ offset: true }).optional(),
    },
    async (args) => {
      const payload = {
        repId: args.rep_id,
        companyName: args.company_name,
        activityType: args.activity_type,
        scheduledDate: args.scheduled_date,
        intent: args.intent,
        monthlyPrice: args.monthly_price,
        loggedAt: args.logged_at,
      }
      const after = args.count_as_booked
        ? await logCalendarEventAction(payload)
        : await addCalendarEntryOnlyAction(payload)
      const eventId = after.event.id
      return writeResult({
        write: 'create_meeting',
        args: { ...args },
        before: null,
        after,
        undo: {
          tool: 'delete_meeting',
          args: { event_id: eventId },
        },
      })
    },
  )

  server.tool(
    'delete_meeting',
    'Delete a calendar meeting and any linked activity log row. Precise undo for create_meeting.',
    { event_id: z.string().uuid() },
    async ({ event_id }) => {
      const before = await getMeeting(event_id)
      if (!before) {
        return writeResult({
          write: 'delete_meeting',
          args: { event_id },
          before: null,
          after: { deleted: false },
          undo: null,
        })
      }
      await removeCalendarEventAction(event_id)
      return writeResult({
        write: 'delete_meeting',
        args: { event_id },
        before: { event: before },
        after: { deleted: true },
        undo: {
          tool: 'create_meeting',
          args: {
            rep_id: before.rep_id,
            company_name: 'Unknown', // client_id is available but name not fetched
            activity_type: before.activity_type,
            scheduled_date: before.scheduled_date,
            intent: before.intent,
            count_as_booked: true,
          },
        },
      })
    },
  )

  server.tool(
    'update_meeting_status',
    'Set meeting status. Returns before/after so status can be restored via undo.',
    {
      event_id: z.string().uuid(),
      status: meetingStatus,
    },
    async ({ event_id, status }) => {
      const before = await getMeeting(event_id)
      const { event } = await updateCalendarEventStatusAction(event_id, status)
      return writeResult({
        write: 'update_meeting_status',
        args: { event_id, status },
        before: before ? { event: before } : null,
        after: { event },
        undo: before
          ? {
              tool: 'update_meeting_status',
              args: { event_id, status: before.status },
            }
          : null,
      })
    },
  )

  server.tool(
    'reschedule_meeting',
    'Reschedule a meeting. Returns before/after; undo restores prior date via edit_meeting (reschedule_count is not decremented).',
    {
      event_id: z.string().uuid(),
      new_date: dateStr,
    },
    async ({ event_id, new_date }) => {
      const before = await getMeeting(event_id)
      const { event } = await rescheduleCalendarEventAction(event_id, new_date)
      return writeResult({
        write: 'reschedule_meeting',
        args: { event_id, new_date },
        before: before ? { event: before } : null,
        after: { event },
        undo: before
          ? {
              tool: 'edit_meeting',
              args: {
                event_id,
                scheduled_date: before.scheduled_date,
                intent: before.intent,
              },
            }
          : null,
      })
    },
  )

  server.tool(
    'edit_meeting',
    'Edit meeting intent and/or scheduled_date. Returns before/after for undo.',
    {
      event_id: z.string().uuid(),
      intent: intent.optional(),
      scheduled_date: dateStr.optional(),
    },
    async ({ event_id, intent: nextIntent, scheduled_date }) => {
      const before = await getMeeting(event_id)
      const { event } = await editCalendarEventAction(event_id, {
        intent: nextIntent,
        scheduledDate: scheduled_date,
      })
      return writeResult({
        write: 'edit_meeting',
        args: {
          event_id,
          intent: nextIntent ?? null,
          scheduled_date: scheduled_date ?? null,
        },
        before: before ? { event: before } : null,
        after: { event },
        undo: before
          ? {
              tool: 'edit_meeting',
              args: {
                event_id,
                intent: before.intent,
                scheduled_date: before.scheduled_date,
              },
            }
          : null,
      })
    },
  )

  server.tool(
    'log_closed_deal',
    'Log closed-won (deal + client + activity). Returns all created rows and undo via delete_closed_deal.',
    {
      rep_id: repId,
      company_name: z.string().min(1),
      monthly_price: z.number().positive(),
      closed_date: dateStr,
    },
    async ({ rep_id, company_name, monthly_price, closed_date }) => {
      const args = { rep_id, company_name, monthly_price, closed_date }
      const after = await logClosedDealAction({
        repId: rep_id,
        companyName: company_name,
        monthlyPrice: monthly_price,
        closedDate: closed_date,
      })
      return writeResult({
        write: 'log_closed_deal',
        args,
        before: null,
        after,
        undo: {
          tool: 'delete_closed_deal',
          args: {
            deal_id: after.deal.id,
            client_id: after.client.id,
            entry_id: after.entry.id,
          },
        },
      })
    },
  )

  server.tool(
    'delete_closed_deal',
    'Delete a closed deal, its client row, and closed activity entry (undo for log_closed_deal).',
    {
      deal_id: z.string().uuid(),
      client_id: z.string().uuid(),
      entry_id: z.string().uuid(),
    },
    async ({ deal_id, client_id, entry_id }) => {
      const [deal] = await db.select().from(closed_deals).where(eq(closed_deals.id, deal_id)).limit(1)
      const [client] = await db.select().from(clients).where(eq(clients.id, client_id)).limit(1)
      const entry = await getActivity(entry_id)
      const before = { deal: deal ?? null, client: client ?? null, entry }

      if (entry_id) {
        await db.delete(activity_log_entries).where(eq(activity_log_entries.id, entry_id))
      }
      if (deal_id) {
        await db.delete(closed_deals).where(eq(closed_deals.id, deal_id))
      }
      if (client_id) {
        await db.delete(clients).where(eq(clients.id, client_id))
      }

      return writeResult({
        write: 'delete_closed_deal',
        args: { deal_id, client_id, entry_id },
        before,
        after: { deleted: true },
        undo:
          deal && client && entry
            ? {
                tool: 'log_closed_deal',
                args: {
                  rep_id: entry.rep_id,
                  company_name: client.name,
                  monthly_price: client.mrr,
                  closed_date: deal.closed_date,
                },
              }
            : null,
      })
    },
  )
}
