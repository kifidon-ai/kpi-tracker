'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { Rep, Client, ActivityLogEntry, Target } from '@/lib/types'
import {
  fmtMoney,
  fmtNum,
  pct,
  isClientActiveAsOf,
  fullMonthsActive,
} from '@/lib/helpers'
import { Card, Segmented, Pill, SectionTitle, KPI, Delta } from './ui/primitives'
import { LineChart, Speedometer, ArrGrowthChart } from './charts'
import { ActivityPipelineCard } from './ActivityPipelineCard'
import { EditClientModal } from './EditClientModal'
import { getActivityCountsAction, getTrendAction, getDiscByHourAction, getDiscShowRateByDowAction, getShowRatesAction, getAttendedConversionsAction, updateClientCancelDateAction } from '@/app/actions'

interface TeamPerformanceProps {
  reps: Rep[]
  clients: Client[]
  feed: ActivityLogEntry[]
  targets: Target[]
  initialMrr: number
  activeClientCount: number
  onClientUpdated?: (client: Client) => void
}

type Range = 'day' | 'week' | 'month' | 'all'

function getPeriodBounds(range: Range, offset: number): { start: Date; end: Date } | null {
  if (range === 'all') return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (range === 'day') {
    const d = new Date(today)
    d.setDate(today.getDate() - offset)
    return { start: d, end: d }
  }
  if (range === 'week') {
    const dow = today.getDay()
    const daysFromMonday = dow === 0 ? 6 : dow - 1
    const thisMonday = new Date(today)
    thisMonday.setDate(today.getDate() - daysFromMonday)
    const start = new Date(thisMonday)
    start.setDate(thisMonday.getDate() - offset * 7)
    const end = offset === 0 ? new Date(today) : new Date(start)
    if (offset > 0) end.setDate(start.getDate() + 6)
    return { start, end }
  }
  // month
  const start = new Date(today.getFullYear(), today.getMonth() - offset, 1)
  const end = offset === 0
    ? new Date(today)
    : new Date(today.getFullYear(), today.getMonth() - offset + 1, 0)
  return { start, end }
}

function toISO(d: Date) {
  // Local calendar date — avoid UTC day-shift from toISOString()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mondayOf(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  const dow = copy.getDay()
  const daysFromMonday = dow === 0 ? 6 : dow - 1
  copy.setDate(copy.getDate() - daysFromMonday)
  return copy
}

/** Sunday-aligned week ends (or range end) for each week overlapping [start, end]. */
function bucketEndDatesInRange(start: Date, end: Date, stepDays = 7): string[] {
  const out: string[] = []
  const endCap = new Date(end)
  endCap.setHours(0, 0, 0, 0)
  const monday = mondayOf(start)

  for (let cursor = new Date(monday); cursor <= endCap; cursor.setDate(cursor.getDate() + stepDays)) {
    const bucketEnd = new Date(cursor)
    bucketEnd.setDate(cursor.getDate() + stepDays - 1)
    const asOf = bucketEnd > endCap ? endCap : bucketEnd
    const iso = toISO(asOf)
    if (!out.includes(iso)) out.push(iso)
  }

  return out
}

/** Month-end dates (or range end) for each calendar month overlapping [start, end]. */
function monthEndDatesInRange(start: Date, end: Date): string[] {
  const out: string[] = []
  const endCap = new Date(end)
  endCap.setHours(0, 0, 0, 0)

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= endCap) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const asOf = monthEnd > endCap ? endCap : monthEnd
    const iso = toISO(asOf)
    if (!out.includes(iso)) out.push(iso)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  return out
}

/** Calendar week containing `dateISO`, capped at that date (Mon → date). Non-overlapping across weeks. */
function weekBoundsForChartDate(dateISO: string): { start: string; end: string } {
  const end = new Date(dateISO + 'T00:00')
  const start = mondayOf(end)
  return { start: toISO(start), end: dateISO }
}

function monthBoundsForEnd(monthEndISO: string): { start: string; end: string } {
  const end = new Date(monthEndISO + 'T00:00')
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return { start: toISO(start), end: monthEndISO }
}

/** Light 3-point moving average; keeps first/last exact so endpoints stay honest. */
function smoothSeriesArr<T extends { arr: number }>(points: T[]): T[] {
  if (points.length < 3) return points
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p
    const prev = points[i - 1].arr
    const next = points[i + 1].arr
    return { ...p, arr: Math.round((prev + 2 * p.arr + next) / 4) }
  })
}

function inBoundsDate(dateStr: string, b: { start: Date; end: Date } | null): boolean {
  if (!b) return true
  const d = new Date(dateStr + 'T00:00')
  return d >= b.start && d <= b.end
}


function periodLabel(range: Range, offset: number, b: { start: Date; end: Date } | null): string {
  if (range === 'all') return 'all time'
  if (!b) return ''
  if (range === 'day') {
    if (offset === 0) return 'Today'
    if (offset === 1) return 'Yesterday'
    return b.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  if (range === 'week') {
    if (offset === 0) return 'This week'
    const s = b.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = b.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${s} – ${e}`
  }
  if (offset === 0) return 'This month'
  return b.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function TeamPerformance({ reps: allReps, clients, feed, targets, initialMrr, activeClientCount, onClientUpdated }: TeamPerformanceProps) {
  const [mounted, setMounted] = useState(false)
  const [showAllWeeksModal, setShowAllWeeksModal] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [hoveredWeek, setHoveredWeek] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [savingClient, setSavingClient] = useState(false)
  const [openClientMenu, setOpenClientMenu] = useState<string | null>(null)
  const clientMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!openClientMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (clientMenuRef.current && !clientMenuRef.current.contains(e.target as Node)) {
        setOpenClientMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openClientMenu])

  const reps = allReps.filter((r) => r.is_active)
  type ClientSortKey = 'name' | 'since_date' | 'cancel_date' | 'mrr' | 'arr' | 'rep'

  const [range, setRange] = useState<Range>('week')
  const [offset, setOffset] = useState(0)
  const [clientSort, setClientSort] = useState<{ key: ClientSortKey; dir: 'asc' | 'desc' }>({ key: 'since_date', dir: 'desc' })

  // Server-side aggregated counts for the selected period and previous period
  const [totals, setTotals]         = useState<Record<string, number>>({})
  const [prevTotals, setPrevTotals] = useState<Record<string, number>>({})
  const [repTotals, setRepTotals]   = useState<Record<string, Record<string, number>>>({})
  const [trendRows, setTrendRows]   = useState<{ date: string; metric_key: string; total: number }[]>([])
  const [discByHour, setDiscByHour] = useState<{ hour: number; total: number }[]>([])
  const [showByDow, setShowByDow] = useState<{ activity_type: string; dow: number; total: number; attended: number }[]>([])
  const [showRates, setShowRates]   = useState<{ rep_id: string | null; activity_type: string; total: number; attended: number }[]>([])
  const [periodShowRates, setPeriodShowRates] = useState<{ rep_id: string | null; activity_type: string; total: number; attended: number }[]>([])
  const [prevPeriodShowRates, setPrevPeriodShowRates] = useState<{ rep_id: string | null; activity_type: string; total: number; attended: number }[]>([])
  const [attendedConversions, setAttendedConversions] = useState<Record<string, {
    discBooked: number
    discAttended: number
    discToDemoConversions: number
    demoBooked: number
    demoAttended: number
    demoToClosedConversions: number
  }>>({})

  function handleRangeChange(v: string) {
    setRange(v as Range)
    setOffset(0)
  }

  const bounds     = useMemo(() => getPeriodBounds(range, offset),     [range, offset])
  const prevBounds = useMemo(() => range === 'all' ? null : getPeriodBounds(range, offset + 1), [range, offset])

  // Fetch aggregated counts from server when period changes
  useEffect(() => {
    let startISO: string
    let endISO: string

    if (range === 'all') {
      const sorted = [...clients].filter((c) => c.since_date).sort((a, b) => (a.since_date as string).localeCompare(b.since_date as string))
      startISO = sorted[0]?.since_date ?? toISO(new Date(2000, 0, 1))
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      endISO = toISO(today)
    } else {
      if (!bounds) return
      startISO = toISO(bounds.start)
      endISO   = toISO(bounds.end)
    }

    let cancelled = false

    getActivityCountsAction(startISO, endISO).then((res) => {
      if (cancelled) return
      const merged: Record<string, number> = {}
      Object.values(res).forEach((m) => {
        Object.entries(m).forEach(([k, v]) => { merged[k] = (merged[k] ?? 0) + v })
      })
      setTotals(merged)
      setRepTotals(res)
    })

    getShowRatesAction(startISO, endISO).then((res) => {
      if (!cancelled) setPeriodShowRates(res)
    })

    if (range === 'all' || !prevBounds) {
      setPrevTotals({})
      setPrevPeriodShowRates([])
    } else {
      const ps = toISO(prevBounds.start)
      const pe = toISO(prevBounds.end)
      getActivityCountsAction(ps, pe).then((res) => {
        if (cancelled) return
        const merged: Record<string, number> = {}
        Object.values(res).forEach((m) => {
          Object.entries(m).forEach(([k, v]) => { merged[k] = (merged[k] ?? 0) + v })
        })
        setPrevTotals(merged)
      })
      getShowRatesAction(ps, pe).then((res) => {
        if (!cancelled) setPrevPeriodShowRates(res)
      })
    }

    return () => { cancelled = true }
    // Intentionally depend on period only — not clients — so a refresh that
    // replaces the clients array doesn't re-fire all of these reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, offset])

  const tgt = useMemo(() => {
    const period = range === 'day' ? 'daily' : range === 'week' ? 'weekly' : range === 'month' ? 'monthly' : null
    return targets.find((t) => t.period === period) ?? null
  }, [range, targets])

  const filteredClients = useMemo(
    () => clients.filter((c) => c.since_date && inBoundsDate(c.since_date, bounds)),
    [clients, bounds],
  )

  const closedCount = filteredClients.length
  const prevClosedCount = useMemo(
    () => clients.filter((c) => c.since_date && inBoundsDate(c.since_date, prevBounds)).length,
    [clients, prevBounds],
  )

  const allTimeRepTotals = useMemo(() => {
    const rt: Record<string, Record<string, number>> = {}
    for (const e of feed) {
      if (!rt[e.rep_id]) rt[e.rep_id] = {}
      rt[e.rep_id][e.metric_key] = (rt[e.rep_id][e.metric_key] ?? 0) + e.delta
    }
    return rt
  }, [feed])

  const periodClientCount = useMemo(() => {
    if (!bounds) {
      const today = toISO(new Date())
      return clients.filter((c) => isClientActiveAsOf(c, today)).length
    }
    // Snapshot at period end so day / week / month agree when looking at "now"
    const endStr = toISO(bounds.end)
    return clients.filter((c) => isClientActiveAsOf(c, endStr)).length
  }, [clients, bounds])

  // Trend window shifts with the global Day/Week/Month/All + arrow controls
  const trendWindow = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = bounds ? new Date(bounds.end) : new Date(today)
    end.setHours(0, 0, 0, 0)

    if (range === 'day') {
      const start = new Date(end)
      start.setDate(end.getDate() - 13)
      return { start, end, granularity: 'day' as const, title: 'Daily trend · 14 days' }
    }
    if (range === 'month') {
      const start = bounds ? new Date(bounds.start) : new Date(today.getFullYear(), today.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      return { start, end, granularity: 'day' as const, title: 'Daily trend · this month' }
    }
    // week + all → weekly buckets ending at the selected period
    const weekStart = bounds ? new Date(bounds.start) : mondayOf(end)
    weekStart.setHours(0, 0, 0, 0)
    const weeksBack = range === 'all' ? 11 : 5
    const start = new Date(weekStart)
    start.setDate(weekStart.getDate() - weeksBack * 7)
    return {
      start,
      end,
      granularity: 'week' as const,
      title: range === 'all' ? 'Weekly trend · last 12 weeks' : 'Weekly trend · 6 weeks',
    }
  }, [range, bounds])

  useEffect(() => {
    getTrendAction(toISO(trendWindow.start), toISO(trendWindow.end)).then(setTrendRows)
  }, [trendWindow])

  useEffect(() => {
    getDiscByHourAction().then(setDiscByHour)
  }, [])

  useEffect(() => {
    getDiscShowRateByDowAction().then(setShowByDow)
  }, [])

  useEffect(() => {
    getShowRatesAction().then(setShowRates)
  }, [])

  useEffect(() => {
    getAttendedConversionsAction().then(setAttendedConversions)
  }, [])

  const trendData = useMemo(() => {
    const { start, end, granularity } = trendWindow
    const out: Array<{
      label: string
      dials: number
      conv: number
      vm: number
      disc: number
      demo: number
      onb: number
      closed: number
    }> = []

    if (granularity === 'day') {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = toISO(d)
        const t: Record<string, number> = {}
        trendRows
          .filter((r) => r.date === dateStr)
          .forEach((r) => { t[r.metric_key] = (t[r.metric_key] ?? 0) + r.total })
        out.push({
          label: (d.getMonth() + 1) + '/' + d.getDate(),
          dials: t.dials ?? 0,
          conv: (t.gk_conv ?? 0) + (t.dm_conv ?? 0),
          vm: t.vm ?? 0,
          disc: t.disc ?? 0,
          demo: t.demo ?? 0,
          onb: t.onb ?? 0,
          closed: t.closed ?? 0,
        })
      }
      return out
    }

    // Weekly buckets from Monday-aligned start through end
    for (let cursor = mondayOf(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
      const weekStart = new Date(cursor)
      const weekEnd = new Date(cursor)
      weekEnd.setDate(cursor.getDate() + 6)
      const asOf = weekEnd > end ? end : weekEnd
      const startStr = toISO(weekStart)
      const endStr = toISO(asOf)
      const t: Record<string, number> = {}
      trendRows
        .filter((r) => r.date >= startStr && r.date <= endStr)
        .forEach((r) => { t[r.metric_key] = (t[r.metric_key] ?? 0) + r.total })
      const isCurrent = endStr === toISO(end)
      out.push({
        label: isCurrent && offset === 0 && range !== 'all' ? 'Now' : (weekStart.getMonth() + 1) + '/' + weekStart.getDate(),
        dials: t.dials ?? 0,
        conv: t.dm_conv ?? 0,
        vm: t.vm ?? 0,
        disc: t.disc ?? 0,
        demo: t.demo ?? 0,
        onb: t.onb ?? 0,
        closed: t.closed ?? 0,
      })
    }
    return out
  }, [trendRows, trendWindow, offset, range])

  const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null)
  const label = periodLabel(range, offset, bounds)

  const periodMrr = useMemo(() => {
    if (!bounds) return initialMrr
    const endStr = toISO(bounds.end)
    return clients
      .filter((c) => isClientActiveAsOf(c, endStr))
      .reduce((sum, c) => sum + c.mrr, 0)
  }, [clients, bounds, initialMrr])

  const arr = periodMrr * 12

  const arrGrowth = useMemo(() => {
    const sorted = [...clients]
      .filter((c) => c.since_date)
      .sort((a, b) => (a.since_date as string).localeCompare(b.since_date as string))

    if (sorted.length === 0) return { actual: [], projected: [] }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Determine the chart window and projection length based on the active filter
    let windowStart: Date
    let windowEnd: Date
    let projDays: number

    if (range === 'all' || !bounds) {
      windowStart = new Date((sorted[0].since_date as string) + 'T00:00')
      windowEnd = today
      projDays = 14
    } else if (range === 'day') {
      // Selected day + 7 days of prior context
      windowStart = new Date(bounds.start)
      windowStart.setDate(windowStart.getDate() - 7)
      windowEnd = new Date(bounds.end)
      projDays = 2
    } else if (range === 'week') {
      // Selected week + prior calendar week as context
      windowStart = new Date(bounds.start)
      windowStart.setDate(windowStart.getDate() - 7)
      windowEnd = new Date(bounds.end)
      projDays = 3
    } else {
      // Selected month + prior calendar month as context
      windowStart = new Date(bounds.start.getFullYear(), bounds.start.getMonth() - 1, 1)
      windowEnd = new Date(bounds.end)
      projDays = 7
    }

    const windowEndCapped = windowEnd > today ? new Date(today) : windowEnd
    const windowStartStr = toISO(windowStart)
    const windowEndStr   = toISO(windowEndCapped)
    const useMonthlyBuckets = range === 'all'
    const useWeeklyBuckets = range === 'month'
    const useBuckets = useMonthlyBuckets || useWeeklyBuckets

    const chartDates = (() => {
      if (useMonthlyBuckets) {
        const months = monthEndDatesInRange(windowStart, windowEndCapped)
        if (months.length === 0 || months[months.length - 1] !== windowEndStr) {
          months.push(windowEndStr)
        }
        return months
      }
      if (useWeeklyBuckets) {
        const weeks = bucketEndDatesInRange(windowStart, windowEndCapped, 7)
        if (weeks.length === 0 || weeks[weeks.length - 1] !== windowEndStr) {
          weeks.push(windowEndStr)
        }
        return weeks
      }

      const eventDates = [...new Set([
        ...sorted
          .filter((c) => { const d = c.since_date as string; return d >= windowStartStr && d <= windowEndStr })
          .map((c) => c.since_date as string),
        ...sorted
          .filter((c) => { const d = c.cancel_date as string | null; return d && d >= windowStartStr && d <= windowEndStr })
          .map((c) => c.cancel_date as string),
      ])]
      if (!eventDates.includes(windowStartStr)) eventDates.unshift(windowStartStr)
      if (!eventDates.includes(windowEndStr)) eventDates.push(windowEndStr)
      eventDates.sort()
      return eventDates
    })()

    const arrAsOf = (date: string) =>
      sorted
        .filter((c) => isClientActiveAsOf(c, date))
        .reduce((sum, c) => sum + c.mrr * 12, 0)

    const rawActual = chartDates.map((date) => {
      let signedUpOnDate: Client[]
      let cancelledOnDate: Client[]
      if (useMonthlyBuckets) {
        const { start, end } = monthBoundsForEnd(date)
        signedUpOnDate = sorted.filter((c) => {
          const d = c.since_date as string
          return d >= start && d <= end
        })
        cancelledOnDate = sorted.filter((c) => {
          const d = c.cancel_date as string | null
          return d && d >= start && d <= end
        })
      } else if (useWeeklyBuckets) {
        // Calendar Mon–end week so adjacent points never share the same days
        const { start, end } = weekBoundsForChartDate(date)
        signedUpOnDate = sorted.filter((c) => {
          const d = c.since_date as string
          return d >= start && d <= end
        })
        cancelledOnDate = sorted.filter((c) => {
          const d = c.cancel_date as string | null
          return d && d >= start && d <= end
        })
      } else {
        signedUpOnDate = sorted.filter((c) => (c.since_date as string) === date)
        cancelledOnDate = sorted.filter((c) => c.cancel_date === date)
      }

      return {
        date,
        // Running ARR (MRR × 12) for clients active as of this date
        arr: arrAsOf(date),
        clientNames: [
          ...signedUpOnDate.map((c) => c.name),
          ...cancelledOnDate.map((c) => `− ${c.name}`),
        ],
        // Per-client hover amounts are MRR (not ARR / not lifetime billed)
        clientArrs: [
          ...signedUpOnDate.map((c) => ({ name: c.name, arr: c.mrr })),
          ...cancelledOnDate.map((c) => ({ name: `− ${c.name}`, arr: -c.mrr })),
        ],
      }
    })

    const actual = useBuckets ? smoothSeriesArr(rawActual) : rawActual

    const currentArr = actual[actual.length - 1]?.arr ?? 0

    // Weekly growth rate calculated over a window proportional to the view
    const growthWindowDays = range === 'day' ? 7 : range === 'week' ? 14 : range === 'month' ? 60 : 56
    const growthWinStart = new Date(windowEndCapped)
    growthWinStart.setDate(growthWinStart.getDate() - growthWindowDays)
    const arrAtStart = arrAsOf(toISO(growthWinStart))
    const arrAtEnd = arrAsOf(windowEndStr)
    const weeklyGrowth = (arrAtEnd - arrAtStart) / (growthWindowDays / 7)

    // Keep projection short so it doesn't dominate the x-axis
    const actualSpanDays = Math.max(1, Math.round((windowEndCapped.getTime() - windowStart.getTime()) / 86400000))
    const cappedProjDays = Math.min(projDays, Math.max(2, Math.round(actualSpanDays * 0.05)))
    const projSteps = 2
    const stepDays  = Math.max(1, Math.round(cappedProjDays / projSteps))
    const projected = Array.from({ length: projSteps }, (_, i) => {
      const d = new Date(windowEndCapped)
      d.setDate(d.getDate() + (i + 1) * stepDays)
      return { date: toISO(d), arr: Math.round(currentArr + weeklyGrowth * ((i + 1) * stepDays / 7)) }
    })

    return { actual, projected }
  }, [clients, range, offset, bounds])

  const fmtArrTick = (v: number) => {
    const abs = Math.abs(v)
    const body = abs === 0 ? '$0' : abs >= 1000 ? `$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k` : `$${abs}`
    return v < 0 ? `−${body}` : body
  }

  // Show rate helpers — derived from calendar table (all time)
  function repShowRate(repId: string, type: 'disc' | 'demo') {
    const row = showRates.find((r) => r.rep_id === repId && r.activity_type === type)
    if (!row || row.total === 0) return null
    return { attended: row.attended, total: row.total, rate: Math.round(row.attended / row.total * 100) }
  }
  const teamDiscShow = showRates
    .filter((r) => r.activity_type === 'disc')
    .reduce((acc, r) => ({ attended: acc.attended + r.attended, total: acc.total + r.total }), { attended: 0, total: 0 })

  // Demo book rate: attended disc that led to demo bookings
  const teamDemoBook = Object.values(attendedConversions).reduce(
    (acc, conv) => ({
      attended: acc.attended + conv.discAttended,
      converted: acc.converted + conv.discToDemoConversions,
    }),
    { attended: 0, converted: 0 }
  )

  const teamDiscRate = teamDiscShow.total ? Math.round(teamDiscShow.attended / teamDiscShow.total * 100) : null
  const teamDemoRate = teamDemoBook.attended ? Math.round(teamDemoBook.converted / teamDemoBook.attended * 100) : null

  const periodDiscShow = periodShowRates.filter((r) => r.activity_type === 'disc').reduce((a, r) => ({ attended: a.attended + r.attended, total: a.total + r.total }), { attended: 0, total: 0 })
  const prevDiscShow   = prevPeriodShowRates.filter((r) => r.activity_type === 'disc').reduce((a, r) => ({ attended: a.attended + r.attended, total: a.total + r.total }), { attended: 0, total: 0 })
  const periodDiscRate = periodDiscShow.total ? Math.round(periodDiscShow.attended / periodDiscShow.total * 100) : null
  const prevDiscRate   = prevDiscShow.total   ? Math.round(prevDiscShow.attended   / prevDiscShow.total   * 100) : null
  const discRateDelta  = periodDiscRate !== null && prevDiscRate !== null ? periodDiscRate - prevDiscRate : null

  const periodDemoShow = periodShowRates.filter((r) => r.activity_type === 'demo').reduce((a, r) => ({ attended: a.attended + r.attended, total: a.total + r.total }), { attended: 0, total: 0 })
  const prevDemoShow   = prevPeriodShowRates.filter((r) => r.activity_type === 'demo').reduce((a, r) => ({ attended: a.attended + r.attended, total: a.total + r.total }), { attended: 0, total: 0 })
  const periodDemoRate = periodDemoShow.total ? Math.round(periodDemoShow.attended / periodDemoShow.total * 100) : null
  const prevDemoRate   = prevDemoShow.total   ? Math.round(prevDemoShow.attended   / prevDemoShow.total   * 100) : null
  const demoRateDelta  = periodDemoRate !== null && prevDemoRate !== null ? periodDemoRate - prevDemoRate : null

  const t = totals
  const pt = prevTotals

  void pct // imported but used inline below

  function toggleClientSort(key: ClientSortKey) {
    setClientSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'since_date' ? 'desc' : 'asc' }
    )
  }

  const sortedClients = useMemo(() => [...clients].sort((a, b) => {
    const dir = clientSort.dir === 'asc' ? 1 : -1
    if (clientSort.key === 'name') return dir * a.name.localeCompare(b.name)
    if (clientSort.key === 'since_date') return dir * ((a.since_date ?? '').localeCompare(b.since_date ?? ''))
    if (clientSort.key === 'cancel_date') return dir * ((a.cancel_date ?? '').localeCompare(b.cancel_date ?? ''))
    if (clientSort.key === 'mrr') return dir * (a.mrr - b.mrr)
    if (clientSort.key === 'arr') {
      const today = toISO(new Date())
      const av = fullMonthsActive(a.since_date as string, today, a.cancel_date) * a.mrr
      const bv = fullMonthsActive(b.since_date as string, today, b.cancel_date) * b.mrr
      return dir * (av - bv)
    }
    if (clientSort.key === 'rep') {
      const ra = reps.find((r) => r.id === a.owner_id)?.name ?? ''
      const rb = reps.find((r) => r.id === b.owner_id)?.name ?? ''
      return dir * ra.localeCompare(rb)
    }
    return 0
  }), [clients, clientSort, reps])

  const clientTotals = useMemo(() => {
    const today = toISO(new Date())
    return clients.reduce(
      (acc, c) => ({
        mrr: acc.mrr + c.mrr,
        revenue: acc.revenue + fullMonthsActive(c.since_date as string, today, c.cancel_date) * c.mrr,
      }),
      { mrr: 0, revenue: 0 },
    )
  }, [clients])

  const clientCols: { label: string; key: ClientSortKey; left?: boolean }[] = [
    { label: 'Client',    key: 'name',       left: true },
    { label: 'Onboarded', key: 'since_date'  },
    { label: 'Cancel',    key: 'cancel_date' },
    { label: 'MRR',       key: 'mrr'         },
    { label: 'Revenue',   key: 'arr'         },
    { label: 'Rep',       key: 'rep'          },
  ]

  async function handleSaveCancelDate(cancelDate: string | null) {
    if (!editingClient) return
    setSavingClient(true)
    try {
      const { client } = await updateClientCancelDateAction(editingClient.id, cancelDate)
      if (client) onClientUpdated?.(client)
      setEditingClient(null)
    } finally {
      setSavingClient(false)
    }
  }

  if (!mounted) {
    return <div className="flex flex-col gap-[18px]" />
  }

  return (
    <div className="flex flex-col gap-[18px]">

      {/* Header */}
      <div className="flex justify-between items-center px-1 pt-1 pb-3" style={{ position: 'sticky', top: '120px', zIndex: 9, background: 'var(--bg-1)' }}>
        <div>
          <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">Historical overview</div>
          <div className="text-lg font-bold mt-1">Team performance · {label.toLowerCase()}</div>
        </div>
        <div className="flex items-center gap-3">
          {range !== 'all' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOffset((o) => o + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-line transition-colors text-base leading-none"
              >←</button>
              <span className="text-[12px] text-ink-2 font-medium w-[130px] text-center">{label}</span>
              <button
                onClick={() => setOffset((o) => Math.max(0, o - 1))}
                disabled={offset === 0}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-line transition-colors text-base leading-none disabled:opacity-25 disabled:cursor-not-allowed"
              >→</button>
            </div>
          )}
          <Segmented
            value={range}
            onChange={handleRangeChange}
            options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'all', label: 'All' }]}
          />
        </div>
      </div>

      {/* Hero: 3 Speedometers — full width */}
      <Card className="flex flex-col" style={{ padding: 24 }}>
        <div className="flex items-end justify-center gap-4">
          {/* MRR */}
          <div className="w-1/4 shrink-0 flex flex-col items-center">
            <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-2">
              MRR
            </div>
            <Speedometer
              value={periodMrr}
              milestones={[5000, 10000, 20000, 50000, 100000]}
              max={100000}
              size={320}
              formatter={(v) => v === 0 ? '$0' : `$${Math.round(v / 1000)}k`}
              minorStep={10000}
              showMinorLabels
              startAngle={180}
              sweepAngle={180}
              showValue={false}
              pillOffsetY={-40}
              pill={<Pill color="#00D4FF">{fmtMoney(periodMrr)}</Pill>}
            />
          </div>
          {/* Clients — center, largest */}
          <div className="w-[35%] shrink-0 flex flex-col items-center">
            <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-2">
              Active Clients
            </div>
            <Speedometer
              value={periodClientCount}
              milestones={[10, 20, 40, 80, 100, 160]}
              max={160}
              size={420}
              minorStep={10}
              showMinorLabels
              highlightedTicks={[50, 100]}
              radiusRatio={0.36}
              valueFontSize={64}
              valueOffsetY={12}
              pillOffsetY={-21}
              zoneColors={['#FF5468', '#FF8C00', '#FFB800', '#00D4FF', '#8B5CF6', '#00E5A0']}
              pill={<Pill color="#00D4FF">ACV {activeClientCount > 0 ? fmtMoney(Math.round(initialMrr / activeClientCount)) : '—'}</Pill>}
            />
          </div>
          {/* ARR */}
          <div className="w-1/4 shrink-0 flex flex-col items-center">
            <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-2">
              ARR
            </div>
            <Speedometer
              value={arr}
              milestones={[50000, 100000, 200000, 500000, 800000, 1000000]}
              max={1000000}
              size={320}
              formatter={(v) => v === 0 ? '$0' : v >= 1000000 ? '$1M' : `$${Math.round(v / 1000)}k`}
              minorStep={100000}
              showMinorLabels
              valueFontSize={42}
              startAngle={180}
              sweepAngle={180}
              showValue={false}
              pillOffsetY={-40}
              zoneColors={['#FF5468', '#FF8C00', '#FFB800', '#00D4FF', '#8B5CF6', '#00E5A0']}
              pill={<Pill color="#00D4FF">{fmtMoney(arr)}</Pill>}
            />
          </div>
        </div>
      </Card>

      {/* Activity KPIs + ARR growth */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-3.5 items-stretch">
        <div className="grid grid-cols-4 gap-3.5">
          <Card><KPI label="Dials"         value={t.dials  ?? 0} target={tgt?.dials}  color="#00D4FF" formatter={fmtNum} delta={delta(t.dials ?? 0, pt.dials ?? 0)} /></Card>
          <Card><KPI label="Voicemails"    value={t.vm     ?? 0}                       color="#5A6685" formatter={fmtNum} delta={delta(t.vm    ?? 0, pt.vm    ?? 0)} /></Card>
          <Card><KPI label="Conversations" value={t.dm_conv ?? 0} target={tgt?.dm_conv} color="#8B5CF6" formatter={fmtNum} delta={delta(t.dm_conv ?? 0, pt.dm_conv ?? 0)} /></Card>
          <Card><KPI label="Discovery"     value={t.disc   ?? 0} target={tgt?.disc}   color="#FFB800" formatter={fmtNum} delta={delta(t.disc  ?? 0, pt.disc  ?? 0)} /></Card>
          <Card><KPI label="Demo"          value={t.demo   ?? 0} target={tgt?.demo}   color="#FF3D9A" formatter={fmtNum} delta={delta(t.demo  ?? 0, pt.demo  ?? 0)} /></Card>
          <Card><KPI label="Closed"        value={closedCount}    target={tgt?.closed} color="#00E5A0" formatter={fmtNum} delta={delta(closedCount, prevClosedCount)} /></Card>
          <Card>
            <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#FFB800] mb-1">Disc show rate</div>
            <div className="mono text-[28px] font-extrabold text-ink leading-none">
              {teamDiscRate !== null ? `${teamDiscRate}%` : '—'}
            </div>
            {discRateDelta !== null && <div className="mt-1"><Delta value={discRateDelta} /></div>}
          </Card>
          <Card>
            <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#FF3D9A] mb-1">Demo show rate</div>
            <div className="mono text-[28px] font-extrabold text-ink leading-none">
              {teamDemoRate !== null ? `${teamDemoRate}%` : '—'}
            </div>
            {demoRateDelta !== null && <div className="mt-1"><Delta value={demoRateDelta} /></div>}
          </Card>
        </div>
        <Card className="flex flex-col">
          <SectionTitle>ARR growth · projected</SectionTitle>
          <div className="flex-1 min-h-0">
            <ArrGrowthChart
              actual={arrGrowth.actual}
              projected={arrGrowth.projected}
              formatter={fmtArrTick}
            />
          </div>
        </Card>
      </div>

      {/* Conversion pipeline */}
      <Card>
        <SectionTitle>Conversion pipeline · {label.toLowerCase()}</SectionTitle>
        {(() => {
          const mult = range === 'month' ? 4 : range === 'day' ? 1 / 5 : 1
          const repsCount = reps.length || 1
          const weeklyTargets = tgt || { dials: 250, dm_conv: 50, disc: 20, demo: 7, closed: 3 }
          const teamAttendedDisc = periodShowRates
            .filter((r) => r.activity_type === 'disc')
            .reduce((sum, r) => sum + r.attended, 0)
          const teamAttendedDemo = periodShowRates
            .filter((r) => r.activity_type === 'demo')
            .reduce((sum, r) => sum + r.attended, 0)
          const metrics = [
            { key: 'dials',  label: 'Dials',    short: 'Dials',    value: t.dials ?? 0,    color: '#00D4FF', target: (weeklyTargets.dials ?? 250) * mult * repsCount },
            { key: 'conv',   label: 'Conv',     short: 'Conv',     value: t.dm_conv ?? 0,  color: '#8B5CF6', target: (weeklyTargets.dm_conv ?? 50) * mult * repsCount },
            { key: 'disc',   label: 'Disc ATT', short: 'Disc ATT', value: teamAttendedDisc, color: '#FFB800', target: (weeklyTargets.disc ?? 20) * mult * repsCount },
            { key: 'demo',   label: 'Demo ATT', short: 'Demo ATT', value: teamAttendedDemo, color: '#FF3D9A', target: (weeklyTargets.demo ?? 7) * mult * repsCount },
            { key: 'closed', label: 'Closed',   short: 'Closed',   value: closedCount,      color: '#00E5A0', target: (weeklyTargets.closed ?? 3) * mult * repsCount },
          ]
          return <ActivityPipelineCard title="Conversion goals" metrics={metrics} showConversionRates={false} />
        })()}
      </Card>

      {/* Trend + Funnel */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5">
        <Card>
          <SectionTitle right={
            <div className="flex gap-3.5 text-[11px] text-ink-2">
              {[{ c: '#00D4FF', l: 'Dials' }, { c: '#8B5CF6', l: 'Conv' }, { c: '#FFB800', l: 'Disc' }, { c: '#FF3D9A', l: 'Demos' }, { c: '#00E5A0', l: 'Closes' }].map((x) => (
                <span key={x.l} className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: x.c }} />{x.l}
                </span>
              ))}
            </div>
          }>{trendWindow.title}</SectionTitle>
          <LineChart
            labels={trendData.map((w) => w.label)}
            series={[
              { name: 'Dials', color: '#00D4FF', data: trendData.map((w) => w.dials) },
              { name: 'Conv',  color: '#8B5CF6', data: trendData.map((w) => w.conv) },
              { name: 'Disc',  color: '#FFB800', data: trendData.map((w) => w.disc * 4) },
              { name: 'Demos', color: '#FF3D9A', data: trendData.map((w) => w.demo * 8) },
              { name: 'Closes', color: '#00E5A0', data: trendData.map((w) => w.closed * 16) },
            ]}
            height={240}
          />
          <div className="mono text-[10px] text-ink-3 mt-2">* disc 4x, demos 8x, closes 16x scale for trend visibility</div>
        </Card>

        <Card className="flex flex-col">
          <SectionTitle right={
            <button onClick={() => setShowAllWeeksModal(true)} className="text-[10px] text-ink-2 hover:text-ink transition-colors">View all</button>
          }>Weekly MRR & ARR</SectionTitle>
          <div className="overflow-y-auto" style={{ height: 280, marginTop: 8 }}>
            <div className="flex flex-col gap-2 pr-2">
              {(() => {
                const weeklyMetrics: Array<{ week: number; label: string; mrr: number; arr: number }> = []
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const dow = today.getDay()
                const daysFromMonday = dow === 0 ? 6 : dow - 1
                const thisMonday = new Date(today)
                thisMonday.setDate(today.getDate() - daysFromMonday)

                // Last 8 weeks
                for (let w = 7; w >= 0; w--) {
                  const start = new Date(thisMonday)
                  start.setDate(thisMonday.getDate() - w * 7)
                  const end = w === 0 ? new Date(today) : new Date(start)
                  if (w > 0) end.setDate(start.getDate() + 6)
                  const endStr = toISO(end)

                  const weekMrr = clients
                    .filter((c) => isClientActiveAsOf(c, endStr))
                    .reduce((sum, c) => sum + c.mrr, 0)

                  weeklyMetrics.push({
                    week: w,
                    label: w === 0 ? 'This week' : (start.getMonth() + 1) + '/' + start.getDate(),
                    mrr: weekMrr,
                    arr: weekMrr * 12,
                  })
                }

                const reversed = weeklyMetrics.reverse()
                return reversed.map((wm, i) => {
                  const prev = i < reversed.length - 1 ? reversed[i + 1] : null
                  const mrrJump = prev ? wm.mrr - prev.mrr : 0
                  const arrJump = prev ? wm.arr - prev.arr : 0

                  const weekStart = new Date(thisMonday)
                  weekStart.setDate(thisMonday.getDate() - wm.week * 7)
                  const weekEnd = wm.week === 0 ? new Date(today) : new Date(weekStart)
                  if (wm.week > 0) weekEnd.setDate(weekStart.getDate() + 6)
                  const weekEndStr = toISO(weekEnd)
                  const weekStartStr = toISO(weekStart)

                  const newClientsThisWeek = clients.filter((c) =>
                    c.since_date && (c.since_date as string) >= weekStartStr && (c.since_date as string) <= weekEndStr
                  )
                  const totalMrrAdded = newClientsThisWeek.reduce((sum, c) => sum + c.mrr, 0)

                  return (
                    <div
                      key={wm.week}
                      className="p-2.5 rounded-lg flex-shrink-0 relative"
                      style={{ background: 'var(--bg-2)' }}
                      onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                      onMouseEnter={() => setHoveredWeek(wm.label)}
                      onMouseLeave={() => setHoveredWeek(null)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold text-ink-2">{wm.label}</span>
                        <span className="text-[10px] text-ink-3">
                          MRR: <span className="mono font-semibold text-ink">{fmtMoney(wm.mrr)}</span>
                        </span>
                      </div>
                      {prev && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="text-[9px] text-ink-3 mb-0.5">MRR jump</div>
                            <div className="mono text-[13px] font-bold" style={{ color: mrrJump >= 0 ? '#00E5A0' : '#FF5468' }}>
                              {mrrJump >= 0 ? '+' : ''}{fmtMoney(mrrJump)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="text-[9px] text-ink-3 mb-0.5">ARR jump</div>
                            <div className="mono text-[13px] font-bold" style={{ color: arrJump >= 0 ? '#00E5A0' : '#FF5468' }}>
                              {arrJump >= 0 ? '+' : ''}{fmtMoney(arrJump)}
                            </div>
                          </div>
                        </div>
                      )}
                      {newClientsThisWeek.length > 0 && hoveredWeek === wm.label && (
                        <div
                          className="fixed text-[11px] p-2.5 rounded z-50 pointer-events-none font-semibold"
                          style={{
                            left: tooltipPos.x + 12 + 'px',
                            top: tooltipPos.y + 'px',
                            background: '#0A0E1A',
                            color: '#D8DEEF'
                          }}
                        >
                          {newClientsThisWeek.map((c, idx) => (
                            <div key={idx} className="whitespace-nowrap">
                              {c.name} ({fmtMoney(c.mrr)})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </Card>
      </div>

      {/* MRR Growth + Per Rep */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5">
        {/* MRR Growth Rate Chart */}
        {(() => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const dow = today.getDay()
          const daysFromMonday = dow === 0 ? 6 : dow - 1
          const thisMonday = new Date(today)
          thisMonday.setDate(today.getDate() - daysFromMonday)

          const mrrChanges: Array<{ label: string; change: number }> = []
          let weekCount = 6

          if (range === 'all' || !bounds) {
            weekCount = 8
          } else if (range === 'day') {
            weekCount = 2
          } else if (range === 'week') {
            weekCount = 3
          } else {
            weekCount = 5
          }

          const chartStart = new Date(thisMonday)
          chartStart.setDate(thisMonday.getDate() - weekCount * 7)
          const weekBefore = new Date(chartStart)
          weekBefore.setDate(weekBefore.getDate() - 7)
          const weekBeforeEndStr = toISO(weekBefore)

          let prevMrr = clients
            .filter((c) => isClientActiveAsOf(c, weekBeforeEndStr))
            .reduce((sum, c) => sum + c.mrr, 0)

          for (let w = weekCount; w >= 0; w--) {
            const start = new Date(thisMonday)
            start.setDate(thisMonday.getDate() - w * 7)
            const end = w === 0 ? new Date(today) : new Date(start)
            if (w > 0) end.setDate(start.getDate() + 6)
            const endStr = toISO(end)

            const weekMrr = clients
              .filter((c) => isClientActiveAsOf(c, endStr))
              .reduce((sum, c) => sum + c.mrr, 0)

            const change = weekMrr - prevMrr

            mrrChanges.push({
              label: w === 0 ? 'Now' : (start.getMonth() + 1) + '/' + start.getDate(),
              change: change,
            })

            prevMrr = weekMrr
          }

          const dataMin = Math.min(...mrrChanges.map((d) => d.change))
          const dataMax = Math.max(...mrrChanges.map((d) => d.change))
          const baseMin = Math.min(0, dataMin)
          const baseMax = Math.max(0, dataMax)
          const dataSpan = baseMax - baseMin || 1
          const minChange = baseMin - dataSpan * 0.08
          const maxChange = baseMax + dataSpan * 0.08
          const range_ = maxChange - minChange
          const avgChange = mrrChanges.reduce((sum, d) => sum + d.change, 0) / mrrChanges.length

          const svgH = 260
          const svgW = 1000
          const padding = { top: 24, right: 24, bottom: 44, left: 100 }
          const plotW = svgW - padding.left - padding.right
          const plotH = svgH - padding.top - padding.bottom

          const points = mrrChanges.map((d, i) => {
            const x = padding.left + (i / Math.max(mrrChanges.length - 1, 1)) * plotW
            const y = padding.top + ((maxChange - d.change) / range_) * plotH
            return { x, y, change: d.change, label: d.label }
          })

          const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
          const isPositive = avgChange >= 0

          return (
            <Card>
              <SectionTitle>MRR growth rate · {label.toLowerCase()}</SectionTitle>
              <div className="mt-4" style={{ width: '100%', height: svgH }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                  {/* Grid lines */}
                  {Array.from({ length: 5 }).map((_, i) => {
                    const y = padding.top + (i / 4) * plotH
                    const value = Math.round(maxChange - (i / 4) * range_)
                    return (
                      <g key={i}>
                        <line x1={padding.left} y1={y} x2={svgW - padding.right} y2={y} stroke="#2D3852" strokeWidth="1" strokeDasharray="3 4" />
                        <text x={padding.left - 12} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fontWeight="600" fontFamily="JetBrains Mono, monospace" fill="#A7B1C9">
                          {fmtMoney(value)}
                        </text>
                      </g>
                    )
                  })}
                  {/* X axis labels */}
                  <line x1={padding.left} y1={padding.top + plotH} x2={svgW - padding.right} y2={padding.top + plotH} stroke="#3A4661" strokeWidth="1" />
                  {points.map((p, i) => (
                    <g key={i}>
                      <line x1={p.x} y1={padding.top} x2={p.x} y2={padding.top + plotH} stroke="#252F47" strokeWidth="1" strokeDasharray="3 5" />
                      <line x1={p.x} y1={padding.top + plotH} x2={p.x} y2={padding.top + plotH + 5} stroke="#5A6685" strokeWidth="1" />
                      <text x={p.x} y={svgH - 10} textAnchor="middle" fontSize="10" fontWeight="600" fontFamily="JetBrains Mono, monospace" fill="#A7B1C9">
                        {p.label}
                      </text>
                    </g>
                  ))}
                  {/* Average line */}
                  {(() => {
                    const avgY = padding.top + ((maxChange - avgChange) / range_) * plotH
                    return (
                      <line x1={padding.left} y1={avgY} x2={svgW - padding.right} y2={avgY} stroke="#74809B" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.9" />
                    )
                  })()}
                  {/* Line */}
                  <path d={pathD} stroke={isPositive ? '#00E5A0' : '#FF5468'} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Points */}
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill={p.change >= 0 ? '#00E5A0' : '#FF5468'} />
                  ))}
                </svg>
              </div>
              <div className="mt-4 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-ink-2">
                    <span>Avg weekly growth: <span className="mono font-semibold text-ink">{fmtMoney(Math.round(avgChange))}</span></span>
                  </div>
                  {(() => {
                    if (mrrChanges.length < 2) return null
                    const last2 = mrrChanges.slice(-2)
                    const prev = last2[0].change
                    const curr = last2[1].change
                    const pctChange = prev > 0 ? ((curr - prev) / prev) * 100 : 0
                    const isPositive = pctChange >= 0
                    return (
                      <div className="text-[11px] text-ink-2">
                        <span>WoW % change: <span className="mono font-semibold" style={{ color: isPositive ? '#00E5A0' : '#FF5468' }}>
                          {isPositive ? '+' : ''}{pctChange.toFixed(1)}%
                        </span></span>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </Card>
          )
        })()}

        {/* MRR Per Rep */}
        <Card className="flex flex-col">
          <SectionTitle>MRR per rep</SectionTitle>
          <div className="overflow-y-auto flex-1" style={{ marginTop: 8 }}>
            <div className="flex flex-col gap-2">
              {(() => {
                // Use allReps (not just active) so MRR owned by inactive reps
                // is still attributed and counted in the per-rep breakdown.
                const today = toISO(new Date())
                const mrrByRep = allReps
                  .map((rep) => ({
                    rep,
                    mrr: clients
                      .filter((c) => c.owner_id === rep.id && isClientActiveAsOf(c, today))
                      .reduce((sum, c) => sum + c.mrr, 0),
                  }))
                  .filter((x) => x.mrr > 0)
                  .sort((a, b) => b.mrr - a.mrr)

                if (mrrByRep.length === 0) {
                  return <div className="py-6 px-3 text-center text-ink-3 text-[12px]">No MRR assigned yet</div>
                }

                const totalMrr = mrrByRep.reduce((sum, x) => sum + x.mrr, 0)

                return mrrByRep.map(({ rep, mrr }) => {
                  const pct = (mrr / totalMrr) * 100
                  return (
                    <div key={rep.id} className="p-2.5 rounded-lg" style={{ background: 'var(--bg-2)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                            style={{ background: rep.color + '28', color: rep.color }}
                          >
                            {rep.initials}
                          </div>
                          <span className="text-[11px] font-semibold text-ink">{rep.name.split(' ')[0]}</span>
                        </div>
                        <span className="mono text-[12px] font-bold text-ink">{fmtMoney(mrr)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: rep.color }}
                          />
                        </div>
                        <span className="mono text-[10px] text-ink-3 w-9 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </Card>
      </div>

      {/* Rep performance */}
      <Card padding={0}>
        <div className="px-5 py-4 border-b border-line">
          <div className="text-[13px] font-semibold">Rep performance · {label.toLowerCase()}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.5px]">
                <th className="text-left px-4 py-2.5 font-semibold border-b border-line text-ink-3">Rep</th>
                {([
                  { label: 'Dials',          color: '#00D4FF', hl: false },
                  { label: 'Conv',           color: '#8B5CF6', hl: false },
                  { label: 'Conv/Disc',      color: '#8B5CF6', hl: false },
                  { label: 'VM',             color: '#5A6685', hl: false },
                  { label: 'Disc',           color: '#FFB800', hl: true  },
                  { label: 'Disc Show',      color: '#FFB800', hl: true  },
                  { label: 'Demo',           color: '#FF3D9A', hl: false },
                  { label: 'Demo Show',      color: '#FF3D9A', hl: false },
                  { label: 'Closed',         color: '#00E5A0', hl: true  },
                ] as const).map((col) => (
                  <th
                    key={col.label}
                    className={`text-right px-4 py-2.5 font-semibold border-b border-line ${col.hl ? 'bg-[#FFB800]/[0.04]' : ''}`}
                    style={{ color: col.color }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reps.map((rep) => {
                const m      = repTotals[rep.id] ?? {}
                const dials  = m.dials  ?? 0
                const conv   = m.dm_conv ?? 0
                const vm     = m.vm     ?? 0
                const disc   = m.disc   ?? 0
                const demo   = m.demo   ?? 0
                const closed = m.closed ?? 0
                const cvRate   = dials ? conv   / dials * 100 : 0
                const discRate = conv  ? disc   / conv  * 100 : 0
                const demoRate = disc  ? demo   / disc  * 100 : 0
                const winRate  = demo  ? closed / demo  * 100 : 0
                const discShow = repShowRate(rep.id, 'disc')
                const demoShow = repShowRate(rep.id, 'demo')
                if (dials + conv + vm + disc + demo + closed === 0) return null

                function showColor(rate: number) {
                  return rate >= 70 ? '#00E5A0' : rate >= 40 ? '#FFB800' : '#FF5468'
                }

                return (
                  <tr key={rep.id} className="border-b border-[#1A1F30]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{ background: rep.color + '28', color: rep.color }}
                        >
                          {rep.initials}
                        </div>
                        <span className="text-[12px] font-semibold">{rep.name.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-[12px] font-semibold text-ink">{dials || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-[12px] font-semibold text-ink">{conv || '—'}</span>
                      {cvRate > 0 && <span className="mono text-[10px] text-ink-3 ml-1.5">{cvRate.toFixed(0)}%</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {disc > 0 ? (
                        <>
                          <span className="mono text-[12px] font-semibold text-ink">{(conv / disc).toFixed(2)}</span>
                          <span className="mono text-[10px] text-ink-3 ml-1.5">{((conv / disc) * 100).toFixed(0)}%</span>
                        </>
                      ) : <span className="text-ink-3 text-[11px]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-[12px] text-ink-2">{vm || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right bg-[#FFB800]/[0.04]">
                      <span className="mono text-[12px] font-semibold text-ink">{disc || '—'}</span>
                      {discRate > 0 && <span className="mono text-[10px] text-ink-3 ml-1.5">{discRate.toFixed(0)}%</span>}
                    </td>
                    <td className="px-4 py-3 text-right bg-[#FFB800]/[0.04]">
                      {discShow ? (
                        <>
                          <span className="mono text-[13px] font-bold" style={{ color: showColor(discShow.rate) }}>{discShow.rate}%</span>
                          <div className="mono text-[9px] text-ink-3">{discShow.attended}/{discShow.total}</div>
                        </>
                      ) : <span className="text-ink-3 text-[11px]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-[12px] font-semibold text-ink">{demo || '—'}</span>
                      {demoRate > 0 && <span className="mono text-[10px] text-ink-3 ml-1.5">{demoRate.toFixed(0)}%</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {demoShow ? (
                        <>
                          <span className="mono text-[13px] font-bold" style={{ color: showColor(demoShow.rate) }}>{demoShow.rate}%</span>
                          <div className="mono text-[9px] text-ink-3">{demoShow.attended}/{demoShow.total}</div>
                        </>
                      ) : <span className="text-ink-3 text-[11px]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right bg-[#00E5A0]/[0.03]">
                      <span className="mono text-[12px] font-bold text-mint">{closed || '—'}</span>
                      {winRate > 0 && <span className="mono text-[10px] text-ink-3 ml-1.5">{winRate.toFixed(0)}%</span>}
                    </td>
                  </tr>
                )
              })}
              {reps.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-ink-3 text-[12px]">No reps yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Discovery by hour */}
      {/* Conversion metrics per rep */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Conversion pipeline · per rep</SectionTitle>
          <span className="text-[10px] text-ink-3">all time</span>
        </div>
        <div className="flex items-center gap-2 mb-3 text-[10px] font-semibold uppercase tracking-[0.6px]">
          <div className="w-20 shrink-0"></div>
          <div className="flex-1 text-[#FFB800]">Disc booked → attended</div>
          <div className="flex-1 text-[#FFB800]">Attended → demo booked</div>
          <div className="flex-1 text-[#FF3D9A]">Demo booked → attended</div>
          <div className="flex-1 text-[#FF3D9A]">Attended → closed</div>
        </div>
        <div className="flex flex-col gap-2">
          {reps.map((rep) => {
            const repConv = attendedConversions[rep.id]
            if (!repConv || (repConv.discBooked === 0 && repConv.demoBooked === 0)) return null

            const discRate = repConv.discBooked > 0 ? (repConv.discAttended / repConv.discBooked) * 100 : 0
            const demoBookRate = repConv.discAttended > 0 ? (repConv.discToDemoConversions / repConv.discAttended) * 100 : 0
            const demoShowRate = repConv.demoBooked > 0 ? (repConv.demoAttended / repConv.demoBooked) * 100 : 0
            const closeRate = repConv.demoAttended > 0 ? (repConv.demoToClosedConversions / repConv.demoAttended) * 100 : 0

            const barColor = (rate: number) => rate >= 70 ? '#00E5A0' : rate >= 40 ? '#FFB800' : '#FF5468'

            return (
              <div key={rep.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--bg-2)' }}>
                <div className="flex items-center gap-2 w-20 shrink-0">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: rep.color + '28', color: rep.color }}>
                    {rep.initials}
                  </div>
                  <div className="mono text-[10px] font-semibold truncate">{rep.name.split(' ')[0]}</div>
                </div>

                {/* Metrics */}
                <div className="flex-1">
                  <div className="text-[9px] font-bold text-ink mb-0.5">{repConv.discAttended}/{repConv.discBooked}</div>
                  <div className="h-1.5 bg-[#FFB800]/20 rounded overflow-hidden">
                    <div className="h-full rounded-l" style={{ width: `${discRate}%`, background: barColor(discRate) }} />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-[9px] font-bold text-ink mb-0.5">{repConv.discToDemoConversions}/{repConv.discAttended}</div>
                  <div className="h-1.5 bg-[#FFB800]/20 rounded overflow-hidden">
                    <div className="h-full rounded-l" style={{ width: `${demoBookRate}%`, background: barColor(demoBookRate) }} />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-[9px] font-bold text-ink mb-0.5">{repConv.demoAttended}/{repConv.demoBooked}</div>
                  <div className="h-1.5 bg-[#FF3D9A]/20 rounded overflow-hidden">
                    <div className="h-full rounded-l" style={{ width: `${demoShowRate}%`, background: barColor(demoShowRate) }} />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-[9px] font-bold text-ink mb-0.5">{repConv.demoToClosedConversions}/{repConv.demoAttended}</div>
                  <div className="h-1.5 bg-[#FF3D9A]/20 rounded overflow-hidden">
                    <div className="h-full rounded-l" style={{ width: `${closeRate}%`, background: barColor(closeRate) }} />
                  </div>
                </div>
              </div>
            )
          }).filter(Boolean)}
        </div>
      </Card>

      {(() => {
        const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am–8pm
        const hourData = HOURS.map((h) => ({
          h,
          total: discByHour.find((d) => d.hour === h)?.total ?? 0,
        }))
        const peak = hourData.reduce((best, d) => d.total > best.total ? d : best, hourData[0])
        const maxVal = Math.max(...hourData.map((d) => d.total), 1)
        const currentHourET = parseInt(
          new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date()),
          10,
        )

        const fmtHour = (h: number) =>
          h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`

        return (
          <Card>
            <SectionTitle right={
              <span className="text-[10px] text-ink-3 font-normal normal-case tracking-normal">all time · ET</span>
            }>Discovery bookings by hour</SectionTitle>

            {discByHour.length === 0 ? (
              <div className="flex items-center justify-center h-44 text-ink-3 text-[12px]">No discovery data yet</div>
            ) : (
              <div className="mt-4">
                <div className="flex items-end gap-[6px] h-44 px-2">
                  {hourData.map(({ h, total }) => {
                    const isPeak = h === peak.h && peak.total > 0
                    const isCurrentHour = h === currentHourET
                    const barH = total ? Math.max((total / maxVal) * 100, 3) : 0
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div className="relative w-full flex flex-col items-center justify-end" style={{ height: 160 }}>
                          {total > 0 && (
                            <div
                              className="mono text-[9px] font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: isCurrentHour ? '#00D4FF' : isPeak ? '#00E5A0' : '#FFB800' }}
                            >
                              {total}
                            </div>
                          )}
                          <div
                            className="w-full rounded-t-[3px] transition-all duration-300"
                            style={{
                              height: `${barH}%`,
                              background: isCurrentHour
                                ? 'linear-gradient(180deg, #00D4FF, #0099BB)'
                                : isPeak
                                  ? 'linear-gradient(180deg, #00E5A0, #00B87A)'
                                  : total > 0
                                    ? 'linear-gradient(180deg, #FFB84D, #CC8800)'
                                    : '#1A2035',
                              opacity: total > 0 ? 0.9 : isCurrentHour ? 0.4 : 0.3,
                              minHeight: total > 0 || isCurrentHour ? 3 : 0,
                            }}
                          />
                        </div>
                        <div
                          className="mono text-[8px] leading-none"
                          style={{ color: isCurrentHour ? '#00D4FF' : isPeak ? '#00E5A0' : '#3A4460' }}
                        >
                          {fmtHour(h)}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {peak.total > 0 && (
                  <div className="mt-3 pt-3 border-t border-line flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-mint shrink-0" />
                    <span className="text-ink-2">Best time to call:</span>
                    <span className="mono font-bold text-ink">{fmtHour(peak.h)}</span>
                    <span className="text-ink-3">— {peak.total} disc {peak.total === 1 ? 'booking' : 'bookings'} logged</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })()}

      {(() => {
        // Postgres DOW: 0=Sun … 6=Sat — display Mon→Fri
        const DAYS = [
          { dow: 1, label: 'Mon' },
          { dow: 2, label: 'Tue' },
          { dow: 3, label: 'Wed' },
          { dow: 4, label: 'Thu' },
          { dow: 5, label: 'Fri' },
        ]
        const todayDow = new Date().getDay()
        const charts = [
          { key: 'disc', title: 'Disc show rate by day', empty: 'No discovery show data yet', baseAccent: '#FFB800' },
          { key: 'demo', title: 'Demo show rate by day', empty: 'No demo show data yet', baseAccent: '#FF3D9A' },
        ] as const

        return charts.map(({ key, title, empty, baseAccent }) => {
          const rows = showByDow.filter((d) => d.activity_type === key)
          const dowData = DAYS.map(({ dow, label }) => {
            const row = rows.find((d) => d.dow === dow)
            const total = row?.total ?? 0
            const attended = row?.attended ?? 0
            const rateExact = total > 0 ? (attended / total) * 100 : null
            const rate = rateExact !== null ? Math.round(rateExact) : null
            return { dow, label, total, attended, rate, rateExact }
          })
          const withData = dowData.filter((d) => d.rate !== null)
          const peak = withData.reduce(
            (best, d) => (d.rate !== null && (best.rate === null || d.rate > best.rate) ? d : best),
            withData[0] ?? { dow: -1, label: '', total: 0, attended: 0, rate: null as number | null, rateExact: null as number | null },
          )
          const maxVolume = Math.max(...dowData.map((d) => d.total), 1)
          const teamTotal = dowData.reduce((sum, d) => sum + d.total, 0)
          const teamAttended = dowData.reduce((sum, d) => sum + d.attended, 0)
          const teamRate = teamTotal > 0 ? Math.round((teamAttended / teamTotal) * 100) : null
          const hasAny = rows.some((d) => d.total > 0)

          return (
            <Card key={key}>
              <SectionTitle right={
                <span className="text-[10px] text-ink-3 font-normal normal-case tracking-normal">all time</span>
              }>{title}</SectionTitle>

              {!hasAny ? (
                <div className="flex items-center justify-center h-44 text-ink-3 text-[12px]">{empty}</div>
              ) : (
                <div className="mt-4">
                  <div className="flex items-center gap-2 px-1 mb-2 text-[9px] text-ink-3">
                    <span className="w-8 shrink-0" />
                    <div className="flex-1 relative h-3">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-line" />
                      <span className="absolute left-0 top-0">0%</span>
                      <span className="absolute left-1/2 -translate-x-1/2 top-0">50%</span>
                      <span className="absolute right-0 top-0">100%</span>
                    </div>
                    <span className="w-[100px] shrink-0" />
                  </div>
                  <div className="flex flex-col gap-2.5 px-1 pt-5">
                    {dowData.map(({ dow, label, total, attended, rate, rateExact }) => {
                      const isPeak = peak.rate !== null && dow === peak.dow && peak.rate > 0
                      const isToday = dow === todayDow
                      const rateW = rateExact !== null ? Math.min(rateExact, 100) : 0
                      const volRatio = total / maxVolume
                      const barH = total > 0 ? 6 + volRatio * 10 : 4
                      const barOpacity = total > 0 ? 0.35 + volRatio * 0.55 : 0.2
                      const accent = isToday ? '#00D4FF' : isPeak ? '#00E5A0' : baseAccent
                      const track = isToday ? '#00D4FF22' : isPeak ? '#00E5A022' : `${baseAccent}22`
                      const exactLabel = rateExact !== null
                        ? `${rateExact % 1 === 0 ? rateExact.toFixed(0) : rateExact.toFixed(1)}% · ${attended} of ${total} attended`
                        : null

                      return (
                        <div key={dow} className="flex items-center gap-2 group relative">
                          <div
                            className="mono text-[10px] font-bold w-8 shrink-0"
                            style={{ color: isToday ? '#00D4FF' : isPeak ? '#00E5A0' : '#8A93A8' }}
                          >
                            {label}
                          </div>
                          <div className="flex-1 relative rounded-full" style={{ height: barH + 6, background: track }}>
                            {exactLabel && (
                              <div
                                className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-7 z-10 whitespace-nowrap rounded px-2 py-1 mono text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{
                                  color: accent,
                                  background: 'var(--card-top)',
                                  border: '1px solid var(--line)',
                                }}
                              >
                                {exactLabel}
                              </div>
                            )}
                            <div
                              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full transition-all duration-300"
                              style={{
                                width: `${rateW}%`,
                                height: barH,
                                minWidth: rate !== null ? 4 : 0,
                                background: rate !== null
                                  ? `linear-gradient(90deg, ${accent}99, ${accent})`
                                  : 'transparent',
                                opacity: barOpacity,
                              }}
                            />
                          </div>
                          <div className="w-[100px] shrink-0 text-right leading-tight">
                            <div className="mono text-[16px] font-bold leading-none" style={{ color: rate !== null ? accent : '#3A4460' }}>
                              {rate !== null ? `${rate}%` : '—'}
                            </div>
                            <div className="mono text-[10px] text-ink-3 mt-1">
                              {total > 0 ? `${attended}/${total}` : 'no data'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink-2">Total:</span>
                      <span className="mono text-[15px] font-bold text-ink">
                        {teamRate !== null ? `${teamRate}%` : '—'}
                      </span>
                      <span className="text-ink-3">
                        ({teamAttended}/{teamTotal} attended)
                      </span>
                    </div>
                    {peak.rate !== null && peak.total > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-mint shrink-0" />
                        <span className="text-ink-2">Best show day:</span>
                        <span className="mono font-bold text-ink">{peak.label}</span>
                        <span className="text-ink-3">— {peak.rate}% ({peak.attended}/{peak.total})</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })
      })()}

      {/* All weeks modal */}
      {showAllWeeksModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAllWeeksModal(false)}>
          <div className="bg-card-top w-full max-w-2xl max-h-[90vh] rounded-lg border border-line flex flex-col" style={{ background: 'var(--card-top)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-2xl font-bold">Weekly MRR & ARR History</h2>
              <button onClick={() => setShowAllWeeksModal(false)} className="text-ink-2 hover:text-ink transition-colors text-3xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="flex flex-col gap-2">
                {(() => {
                  const allWeekly: Array<{ label: string; mrr: number; arr: number; startStr: string; endStr: string }> = []

                  const firstClientDate = clients
                    .filter((c) => c.since_date)
                    .sort((a, b) => (a.since_date as string).localeCompare(b.since_date as string))[0]?.since_date

                  if (!firstClientDate) return <div className="text-ink-3 text-[12px]">No data yet</div>

                  const startWeek = new Date((firstClientDate as string) + 'T00:00')
                  const startDow = startWeek.getDay()
                  const startDaysFromMonday = startDow === 0 ? 6 : startDow - 1
                  startWeek.setDate(startWeek.getDate() - startDaysFromMonday)

                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const dow = today.getDay()
                  const daysFromMonday = dow === 0 ? 6 : dow - 1
                  const thisMonday = new Date(today)
                  thisMonday.setDate(today.getDate() - daysFromMonday)

                  let current = new Date(startWeek)
                  while (current <= thisMonday) {
                    const end = new Date(current)
                    end.setDate(current.getDate() + 6)
                    const endCapped = end > today ? new Date(today) : end
                    const endStr = toISO(endCapped)
                    const startStr = toISO(current)

                    const weekMrr = clients
                      .filter((c) => isClientActiveAsOf(c, endStr))
                      .reduce((sum, c) => sum + c.mrr, 0)

                    if (weekMrr > 0) {
                      allWeekly.push({
                        label: current.getTime() === thisMonday.getTime() ? 'This week' : (current.getMonth() + 1) + '/' + current.getDate(),
                        mrr: weekMrr,
                        arr: weekMrr * 12,
                        startStr,
                        endStr,
                      })
                    }

                    current.setDate(current.getDate() + 7)
                  }

                  const reversed = allWeekly.reverse()
                  return reversed.map((w, i) => {
                    const prev = i < reversed.length - 1 ? reversed[i + 1] : null
                    const mrrJump = prev ? w.mrr - prev.mrr : 0
                    const arrJump = prev ? w.arr - prev.arr : 0

                    const newClientsThisWeek = clients.filter((c) =>
                      c.since_date && (c.since_date as string) >= w.startStr && (c.since_date as string) <= w.endStr
                    )

                    return (
                      <div
                        key={w.label}
                        className="p-4 rounded-lg relative"
                        style={{ background: 'var(--bg-2)' }}
                        onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                        onMouseEnter={() => setHoveredWeek(w.label)}
                        onMouseLeave={() => setHoveredWeek(null)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[16px] font-semibold text-ink-2">{w.label}</span>
                          <span className="text-[14px] text-ink-3">
                            MRR: <span className="mono font-semibold text-ink">{fmtMoney(w.mrr)}</span>
                          </span>
                        </div>
                        {prev && (
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="text-[13px] text-ink-3 mb-1">MRR jump</div>
                              <div className="mono text-[18px] font-bold" style={{ color: mrrJump >= 0 ? '#00E5A0' : '#FF5468' }}>
                                {mrrJump >= 0 ? '+' : ''}{fmtMoney(mrrJump)}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="text-[13px] text-ink-3 mb-1">ARR jump</div>
                              <div className="mono text-[18px] font-bold" style={{ color: arrJump >= 0 ? '#00E5A0' : '#FF5468' }}>
                                {arrJump >= 0 ? '+' : ''}{fmtMoney(arrJump)}
                              </div>
                            </div>
                          </div>
                        )}
                        {newClientsThisWeek.length > 0 && hoveredWeek === w.label && (
                          <div
                            className="fixed text-[13px] p-2.5 rounded z-50 pointer-events-none font-semibold"
                            style={{
                              left: tooltipPos.x + 12 + 'px',
                              top: tooltipPos.y + 'px',
                              background: '#0A0E1A',
                              color: '#D8DEEF'
                            }}
                          >
                            {newClientsThisWeek.map((c, idx) => (
                              <div key={idx} className="whitespace-nowrap">
                                {c.name} ({fmtMoney(c.mrr)})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client breakdown */}
      <Card padding={0}>
        <div className="px-5 py-4 border-b border-line">
          <div className="text-[13px] font-semibold">Client breakdown</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-ink-3 text-[10.5px] uppercase tracking-[0.5px]">
                {clientCols.map((col) => {
                  const active = clientSort.key === col.key
                  return (
                    <th
                      key={col.key}
                      onClick={() => toggleClientSort(col.key)}
                      className={`${col.left ? 'text-left' : 'text-right'} px-3.5 py-3 font-semibold border-b border-line cursor-pointer select-none hover:text-ink-1 transition-colors ${active ? 'text-ink-1' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        {!col.left && active && <span className="text-[9px]">{clientSort.dir === 'asc' ? '▲' : '▼'}</span>}
                        {col.label}
                        {col.left && active && <span className="text-[9px]">{clientSort.dir === 'asc' ? '▲' : '▼'}</span>}
                      </span>
                    </th>
                  )
                })}
                <th className="w-10 px-2 py-3 border-b border-line" />
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((c) => {
                const owner = reps.find((r) => r.id === c.owner_id)
                const today = toISO(new Date())
                const active = isClientActiveAsOf(c, today)
                const isMenuOpen = openClientMenu === c.id
                const lifetimeRevenue = fullMonthsActive(c.since_date as string, today, c.cancel_date) * c.mrr
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[#1A1F30] hover:bg-[var(--bg-2)] transition-colors"
                  >
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? '#00E5A0' : '#FFB800' }} />
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="mono px-3.5 py-3 text-right text-ink-3">{c.since_date}</td>
                    <td className="mono px-3.5 py-3 text-right" style={{ color: c.cancel_date ? '#FFB800' : 'var(--ink-3)' }}>
                      {c.cancel_date ?? '—'}
                    </td>
                    <td className="mono px-3.5 py-3 text-right font-semibold text-ink-1">{fmtMoney(c.mrr)}</td>
                    <td className="mono px-3.5 py-3 text-right font-semibold text-mint">{fmtMoney(lifetimeRevenue)}</td>
                    <td className="px-3.5 py-3 text-right text-ink-2">{owner ? owner.name.split(' ')[0] : '—'}</td>
                    <td className="px-2 py-3 text-right">
                      <div
                        className="relative inline-block"
                        ref={isMenuOpen ? clientMenuRef : null}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenClientMenu(isMenuOpen ? null : c.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-line transition-colors text-[14px] font-bold leading-none"
                          aria-label={`Actions for ${c.name}`}
                        >
                          ···
                        </button>
                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-line-2 overflow-hidden shadow-xl z-20"
                            style={{ background: 'var(--card-bottom)' }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenClientMenu(null)
                                setEditingClient(c)
                              }}
                              className="w-full text-left px-3.5 py-2.5 text-[12px] font-medium text-ink hover:bg-line transition-colors"
                            >
                              Canceled
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3.5 py-8 text-center text-ink-3 text-[12px]">No clients yet</td>
                </tr>
              )}
            </tbody>
            {clients.length > 0 && (
              <tfoot>
                <tr className="border-t border-line" style={{ background: 'var(--bg-2)' }}>
                  <td className="px-3.5 py-3 font-bold text-ink" colSpan={3}>
                    Total · {clients.length} clients
                  </td>
                  <td className="mono px-3.5 py-3 text-right font-bold text-ink-1">{fmtMoney(clientTotals.mrr)}</td>
                  <td className="mono px-3.5 py-3 text-right font-bold text-mint">{fmtMoney(clientTotals.revenue)}</td>
                  <td className="px-3.5 py-3" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onSave={handleSaveCancelDate}
          onCancel={() => setEditingClient(null)}
          saving={savingClient}
        />
      )}

    </div>
  )
}
