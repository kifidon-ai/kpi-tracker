'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Rep, Client, ActivityLogEntry, Target, CalendarEvent, CalendarIntent } from '@/lib/types'
import { METRIC_GROUPS, ALL_METRICS, KEY_METRICS } from '@/lib/constants'
import { relativeTime, getPeriodBounds, getPeriodLabel, loggedAtEndOfDayET, type LiveRange } from '@/lib/helpers'
import { Icon } from './ui/Icon'
import { Avatar } from './ui/Avatar'
import { Card, Pill, SectionTitle, TargetBar, Segmented } from './ui/primitives'
import { ActivityPipelineCard } from './ActivityPipelineCard'
import { ClosedDealModal } from './ClosedDealModal'
import { CalendarEventModal } from './CalendarEventModal'
import { DayCalendar } from './DayCalendar'
import {
  getActivityCountsAction,
  logActivityAction,
  decrementActivityAction,
  logClosedDealAction,
  logCalendarEventAction,
  getCalendarCompaniesAction,
  getCalendarEventsForDateRangeAction,
  getCalendarEventsForDateRangeAllRepsAction,
} from '@/app/actions'

interface LiveTrackerProps {
  reps: Rep[]
  feed: ActivityLogEntry[]
  targets: Target[]
  defaultRepId?: string
  isSuperUser?: boolean
  onDealClosed?: (client: Client) => void
}


export function LiveTracker({ reps, feed, targets, defaultRepId, onDealClosed }: LiveTrackerProps) {
  const [activeRep, setActiveRep] = useState<string>(defaultRepId ?? 'team')

  useEffect(() => {
    if (defaultRepId) setActiveRep(defaultRepId)
  }, [defaultRepId])

  const [countsByRep, setCountsByRep] = useState<Record<string, Record<string, number>>>({})
  const [now, setNow] = useState(new Date())
  const [showClosedModal, setShowClosedModal] = useState(false)
  const [calendarModal, setCalendarModal] = useState<'disc' | 'demo' | null>(null)
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [calendarCompanies, setCalendarCompanies] = useState<string[]>([])
  const [range, setRange] = useState<LiveRange>('day')
  const [offset, setOffset] = useState(0)

  const bounds = useMemo(() => getPeriodBounds(range, offset), [range, offset])
  const isHistorical = offset > 0
  const label = getPeriodLabel(range, offset, bounds)

  const startISO = bounds.start.toISOString().slice(0, 10)
  const endISO   = bounds.end.toISOString().slice(0, 10)

  useEffect(() => {
    let cancelled = false
    getActivityCountsAction(startISO, endISO).then((res) => {
      if (!cancelled) setCountsByRep(res)
    })
    return () => { cancelled = true }
  }, [startISO, endISO])

  // Load calendar companies and today's events
  useEffect(() => {
    getCalendarCompaniesAction().then(setCalendarCompanies)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (activeRep === 'team') {
      getCalendarEventsForDateRangeAllRepsAction(startISO, endISO).then((events) => {
        if (!cancelled) setTodayEvents(events)
      })
    } else if (activeRep) {
      getCalendarEventsForDateRangeAction(activeRep, startISO, endISO).then((events) => {
        if (!cancelled) setTodayEvents(events)
      })
    } else {
      setTodayEvents([])
    }
    return () => { cancelled = true }
  }, [activeRep, startISO, endISO])

  function handleRangeChange(v: string) {
    setRange(v as LiveRange)
    setOffset(0)
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const filteredFeed = useMemo(() => {
    const start = new Date(bounds.start); start.setHours(0, 0, 0, 0)
    const end   = new Date(bounds.end);   end.setHours(23, 59, 59, 999)
    return feed.filter((e) => {
      const utcDate = new Date(e.logged_at)
      const etDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      return etDate >= start && etDate <= end
    })
  }, [feed, bounds])

  const isTeam = activeRep === 'team'
  const rep = reps.find((r) => r.id === activeRep) ?? null
  const activeReps = reps.filter((r) => r.is_active)

  const counts = isTeam
    ? activeReps.reduce<Record<string, number>>((acc, r) => {
        const rc = countsByRep[r.id] ?? {}
        ALL_METRICS.forEach((m) => { acc[m.k] = (acc[m.k] ?? 0) + (rc[m.k] ?? 0) })
        return acc
      }, {})
    : (countsByRep[activeRep] ?? {})

  const teamCounts = activeReps.reduce<Record<string, number>>((acc, r) => {
    const rc = countsByRep[r.id] ?? {}
    ALL_METRICS.forEach((m) => { acc[m.k] = (acc[m.k] ?? 0) + (rc[m.k] ?? 0) })
    return acc
  }, {})

  const perPersonTarget = targets.find((t) => t.period === 'per_person') ?? null
  const periodMult = range === 'day' ? 0.2 : range === 'month' ? 4 : 1

  function getTarget(key: string, forTeam: boolean): number {
    if (!perPersonTarget) return 0
    const weekly = (perPersonTarget as Record<string, unknown>)[key] as number ?? 0
    const repMult = forTeam ? activeReps.length : 1
    return Math.round(weekly * repMult * periodMult * 10) / 10
  }

  const effectiveTargets: Record<string, number> = Object.fromEntries(
    ALL_METRICS.map((m) => [m.k, getTarget(m.k, isTeam)])
  )
  const teamTargets: Record<string, number> = Object.fromEntries(
    ALL_METRICS.map((m) => [m.k, getTarget(m.k, true)])
  )

  const logActivity = useCallback(async (metricKey: string) => {
    if (isTeam || !rep) return
    const def = ALL_METRICS.find((m) => m.k === metricKey)
    if (!def) return
    // When viewing a past period, backdate the entry to that period so it
    // counts toward the historical date (e.g. adding a demo to "yesterday").
    const loggedAt = isHistorical ? loggedAtEndOfDayET(endISO) : undefined
    setCountsByRep((prev) => ({
      ...prev,
      [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: ((prev[activeRep] ?? {})[metricKey] ?? 0) + 1 },
    }))
    try {
      await logActivityAction(activeRep, def.k, def.label + ' logged', def.icon, def.color, loggedAt)
    } catch {
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: Math.max(0, ((prev[activeRep] ?? {})[metricKey] ?? 0) - 1) },
      }))
    }
  }, [isTeam, rep, activeRep, isHistorical, endISO])

  const decrement = useCallback(async (metricKey: string) => {
    if (isTeam || !rep) return
    const current = (countsByRep[activeRep] ?? {})[metricKey] ?? 0
    if (current <= 0) return

    // Undo the most recent activity log in this period. For disc/demo that also
    // deletes the linked calendar row (via calendar_id), not "meetings scheduled today".
    setCountsByRep((prev) => ({
      ...prev,
      [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: current - 1 },
    }))
    const result = await decrementActivityAction(activeRep, metricKey, startISO, endISO)
    if (!result.deleted && !result.id) {
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: current },
      }))
      return
    }
    if (result.calendarId) {
      setTodayEvents((prev) => prev.filter((e) => e.id !== result.calendarId))
    }
  }, [isTeam, rep, activeRep, countsByRep, startISO, endISO])

  const logClosedDeal = useCallback(async (data: { companyName: string; monthlyPrice: number; closedDate: string }) => {
    setShowClosedModal(false)
    if (!rep) return
    try {
      const result = await logClosedDealAction({
        repId: activeRep,
        companyName: data.companyName,
        monthlyPrice: data.monthlyPrice,
        closedDate: data.closedDate,
      })
      onDealClosed?.(result.client)
    } catch {
      // no optimistic state to roll back
    }
  }, [rep, activeRep, onDealClosed])

  const logCalendarEvent = useCallback(async (data: { companyName: string; scheduledDate: string; intent: CalendarIntent }) => {
    if (!rep || !calendarModal) return
    const type = calendarModal
    setCalendarModal(null)

    // Optimistic count update
    setCountsByRep((prev) => ({
      ...prev,
      [activeRep]: { ...(prev[activeRep] ?? {}), [type]: ((prev[activeRep] ?? {})[type] ?? 0) + 1 },
    }))

    // Count against when the booking was logged (today / historical period),
    // not the meeting's scheduled date — otherwise future bookings vanish on refresh.
    const loggedAt = isHistorical ? loggedAtEndOfDayET(endISO) : undefined

    try {
      await logCalendarEventAction({
        repId:         activeRep,
        companyName:   data.companyName,
        activityType:  type,
        scheduledDate: data.scheduledDate,
        intent:        data.intent,
        loggedAt,
      })

      // Refresh meetings list whenever the scheduled date falls in the viewed range
      if (data.scheduledDate >= startISO && data.scheduledDate <= endISO) {
        getCalendarEventsForDateRangeAction(activeRep, startISO, endISO).then(setTodayEvents)
      }

      getCalendarCompaniesAction().then(setCalendarCompanies)
    } catch {
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), [type]: Math.max(0, ((prev[activeRep] ?? {})[type] ?? 0) - 1) },
      }))
    }
  }, [rep, activeRep, calendarModal, startISO, endISO, isHistorical])

  function handleInc(metricKey: string) {
    if (metricKey === 'closed') { setShowClosedModal(true); return }
    if (metricKey === 'disc')   { setCalendarModal('disc'); return }
    if (metricKey === 'demo')   { setCalendarModal('demo'); return }
    logActivity(metricKey)
  }

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  void now

  return (
    <div className="flex flex-col gap-[18px]">

      {/* Rep selector */}
      <Card padding={16} style={{ position: 'sticky', top: '120px', zIndex: 9, background: 'var(--bg-1)' }}>
        <div className="flex justify-between items-center flex-wrap gap-3.5">
          <div>
            <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">
              {isHistorical ? 'Historical view' : `Live tracker · ${todayStr}`}
            </div>
            <div className="text-lg font-bold mt-1">
              {isTeam ? 'Whole team' : rep?.name}
              <span className="text-[13px] font-normal text-ink-2 ml-2">
                {isTeam ? '· read-only' : isHistorical ? '· historical' : `· ${rep?.role}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOffset((o) => o + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-line transition-colors text-base leading-none"
              >←</button>
              <span className="text-[12px] text-ink-2 font-medium w-[130px] text-center">{label}</span>
              <button
                onClick={() => setOffset((o) => o - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-line transition-colors text-base leading-none"
              >→</button>
            </div>
            <Segmented
              value={range}
              onChange={handleRangeChange}
              options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
            />
          </div>
        </div>
        <div className="mt-3.5 flex gap-1 bg-bg-2 p-1 rounded-[10px] border border-line flex-wrap">
          <button
            onClick={() => setActiveRep('team')}
            className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[7px] transition-all"
            style={{
              background: isTeam ? '#00D4FF22' : 'transparent',
              border: isTeam ? '1px solid #00D4FF66' : '1px solid transparent',
            }}
          >
            <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)' }}>
              <Icon name="team" size={12} color="#0A0E1A" />
            </div>
            <span className="text-[12px] font-semibold" style={{ color: isTeam ? '#00D4FF' : 'var(--ink-2)' }}>Team</span>
          </button>
          {activeReps.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRep(r.id)}
              className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[7px] transition-all"
              style={{
                background: activeRep === r.id ? r.color + '22' : 'transparent',
                border: activeRep === r.id ? `1px solid ${r.color}66` : '1px solid transparent',
              }}
            >
              <Avatar rep={r} size={22} />
              <span className="text-[12px] font-semibold" style={{ color: activeRep === r.id ? r.color : 'var(--ink-2)' }}>
                {r.name.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Key metrics */}
      <Card>
        <div className="flex justify-between items-start mb-3">
          <SectionTitle>
            {isTeam ? 'Team activity' : `${rep?.name.split(' ')[0]}'s activity`}
            <span className="text-[11px] font-normal text-ink-3 ml-2">{label.toLowerCase()}</span>
          </SectionTitle>
        </div>

        <ActivityPipelineCard
          title={isTeam ? 'Team vs goal' : `${rep?.name.split(' ')[0]} vs goal`}
          metrics={KEY_METRICS.map((k) => {
            const def = ALL_METRICS.find((m) => m.k === k)!
            return {
              key: k,
              label: def.label,
              short: def.short,
              value: (counts[k] as number) ?? 0,
              color: def.color,
              target: effectiveTargets[k] ?? 1,
            }
          })}
          showConversionRates={true}
        />
      </Card>

      {/* Log Activity + Feed */}
      <div className="grid grid-cols-[3fr_1fr] gap-[18px] items-start">
        <Card padding={0}>
          <div className="px-5 py-4 border-b border-line flex justify-between items-center">
            <div>
              <div className="text-[13px] font-bold">Log activity</div>
              <div className="text-[10.5px] text-ink-3 mt-0.5">
                {isTeam ? 'read-only · pick a rep to log' : `tap +1 to log for ${rep?.name.split(' ')[0]}`}
              </div>
            </div>
            {!isTeam && rep && <Avatar rep={rep} size={32} />}
          </div>

          {isHistorical && !isTeam && (
            <div className="mx-4 mt-3.5 px-3.5 py-2.5 rounded-lg flex items-center gap-2 text-[11px] text-ink-2"
              style={{ background: '#FFB80011', border: '1px solid #FFB80044' }}>
              <Icon name="log" size={13} color="#FFB800" />
              <span>Editing {label.toLowerCase()} — changes are saved to that period.</span>
            </div>
          )}
          {!isHistorical && isTeam && (
            <div className="mx-4 mt-3.5 px-3.5 py-2.5 rounded-lg flex items-center gap-2 text-[11px] text-ink-2"
              style={{ background: '#00D4FF11', border: '1px solid #00D4FF44' }}>
              <Icon name="team" size={13} color="#00D4FF" />
              <span>Switch to a rep to log activity.</span>
            </div>
          )}

          <div className="flex gap-4 p-4">
            {METRIC_GROUPS.map((group) => (
              <div key={group.group} className="flex-1 flex flex-col gap-2.5">
                <div className="pb-2.5 mb-0.5 border-b-2 border-line-2">
                  <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-ink-1">{group.group}</div>
                </div>
                {group.items.map((def) => {
                  const v = (counts[def.k] as number) ?? 0
                  const t = effectiveTargets[def.k]
                  return (
                    <LogTile
                      key={def.k}
                      def={def}
                      value={v}
                      target={t}
                      disabled={isTeam}
                      onInc={() => handleInc(def.k)}
                      onDec={() => decrement(def.k)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </Card>

        {/* Activity feed */}
        <Card padding={0} style={{ position: 'sticky', top: 120 }}>
          <div className="px-[18px] py-4 flex justify-between items-center border-b border-line">
            <div className="text-[13px] font-bold">Activity feed</div>
            <Pill color={isHistorical ? '#8B5CF6' : '#00D4FF'}>{isHistorical ? `${filteredFeed.length} events` : 'live'}</Pill>
          </div>
          <div className="max-h-[620px] overflow-y-auto px-3.5 pb-3.5 pt-1">
            {filteredFeed.length === 0 && (
              <div className="py-10 px-3 text-center text-ink-3 text-[12px]">
                No activity yet — start tapping +1.
              </div>
            )}
            {filteredFeed.map((item) => {
              const r = reps.find((x) => x.id === item.rep_id)
              return (
                <div key={item.id} className="grid items-center gap-2 py-2.5 px-0.5 border-b border-line"
                  style={{ gridTemplateColumns: '28px 22px 1fr auto' }}>
                  <div className="w-7 h-7 rounded-[7px] inline-flex items-center justify-center"
                    style={{ background: item.color + '22' }}>
                    <Icon name={item.icon} size={14} color={item.color} />
                  </div>
                  <Avatar rep={r ?? null} size={20} />
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-semibold truncate">{item.label}</div>
                    <div className="text-[10px] text-ink-3">{r?.name.split(' ')[0]}</div>
                  </div>
                  <div className="mono text-[10px] text-ink-3">{relativeTime(item.logged_at)}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Day calendar — shows the selected rep's meetings, or the whole team's */}
      <DayCalendar
        events={todayEvents}
        reps={reps}
        repId={activeRep}
        companies={calendarCompanies}
        startDate={startISO}
        endDate={endISO}
        allowAdd={!isTeam}
        onEventsChange={setTodayEvents}
        onCompaniesUpdate={setCalendarCompanies}
      />

      {showClosedModal && rep && (
        <ClosedDealModal
          rep={rep}
          companies={calendarCompanies}
          onSave={logClosedDeal}
          onCancel={() => setShowClosedModal(false)}
        />
      )}

      {calendarModal && rep && (
        <CalendarEventModal
          rep={rep}
          activityType={calendarModal}
          companies={calendarCompanies}
          defaultDate={isHistorical ? endISO : undefined}
          onSave={logCalendarEvent}
          onCancel={() => setCalendarModal(null)}
        />
      )}

    </div>
  )
}

// --- Log tile ---
interface LogTileProps {
  def: { k: string; label: string; short: string; icon: string; color: string }
  value: number
  target?: number
  disabled: boolean
  onInc: () => void
  onDec: () => void
}

function LogTile({ def, value, target, disabled, onInc, onDec }: LogTileProps) {
  return (
    <div
      className="rounded-[11px] p-3 flex flex-col gap-2 justify-between"
      style={{
        background: 'var(--tile-bg)',
        border: `1px solid ${def.color}44`,
        minHeight: disabled ? 'auto' : 130,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-[26px] h-[26px] rounded-[7px] inline-flex items-center justify-center shrink-0"
          style={{ background: def.color + '22' }}>
          <Icon name={def.icon} size={13} color={def.color} />
        </div>
        <div className="text-[11.5px] font-semibold text-ink-1 leading-tight overflow-hidden text-ellipsis">{def.short}</div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="mono text-[26px] font-extrabold text-ink leading-none">{value}</span>
          {target != null && target > 0 && (
            <span className="mono text-[10px] text-ink-3">
              / {Number.isInteger(target) ? target : target.toFixed(1)}
            </span>
          )}
        </div>
        {target != null && target > 0 && (
          <div className="mt-[5px]">
            <TargetBar value={value} target={target} color={def.color} height={4} />
          </div>
        )}
      </div>
      {!disabled && (
        <div className="flex gap-1.5">
          <button
            onClick={onInc}
            className="flex-1 py-2 px-2.5 rounded-lg font-bold text-[12px] inline-flex items-center justify-center text-bg-1"
            style={{ background: def.color }}
          >
            +1
          </button>
          <button
            onClick={onDec}
            className="py-2 px-2.5 rounded-lg font-bold text-[12px] inline-flex items-center justify-center text-ink-2 shrink-0"
            style={{ background: 'var(--line-2)', border: '1px solid var(--line)' }}
          >
            −1
          </button>
        </div>
      )}
    </div>
  )
}
