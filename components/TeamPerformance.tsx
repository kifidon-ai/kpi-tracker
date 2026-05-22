'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Rep, Client, ActivityLogEntry, Target } from '@/lib/types'
import { fmtMoney, fmtNum, pct } from '@/lib/helpers'
import { Card, Segmented, Pill, SectionTitle, KPI } from './ui/primitives'
import { LineChart, FunnelBar, Speedometer, ArrGrowthChart } from './charts'
import { getActivityCountsAction, getTrendAction, getDiscByHourAction } from '@/app/actions'

interface TeamPerformanceProps {
  reps: Rep[]
  clients: Client[]
  feed: ActivityLogEntry[]
  targets: Target[]
  initialMrr: number
  activeClientCount: number
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

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

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

export function TeamPerformance({ reps, clients, feed, targets, initialMrr, activeClientCount }: TeamPerformanceProps) {
  const [range, setRange] = useState<Range>('week')
  const [offset, setOffset] = useState(0)
  const [trendGranularity, setTrendGranularity] = useState<'week' | 'day'>('week')

  // Server-side aggregated counts for the selected period and previous period
  const [totals, setTotals]         = useState<Record<string, number>>({})
  const [prevTotals, setPrevTotals] = useState<Record<string, number>>({})
  const [repTotals, setRepTotals]   = useState<Record<string, Record<string, number>>>({})
  const [trendRows, setTrendRows]   = useState<{ date: string; metric_key: string; total: number }[]>([])
  const [discByHour, setDiscByHour] = useState<{ hour: number; total: number }[]>([])

  function handleRangeChange(v: string) {
    setRange(v as Range)
    setOffset(0)
  }

  const bounds     = useMemo(() => getPeriodBounds(range, offset),     [range, offset])
  const prevBounds = useMemo(() => getPeriodBounds(range, offset + 1), [range, offset])

  // Fetch aggregated counts from server when period changes
  useEffect(() => {
    if (range === 'all') {
      // For "all time" aggregate the full feed client-side (no date bounds needed)
      const t: Record<string, number> = {}
      const rt: Record<string, Record<string, number>> = {}
      for (const e of feed) {
        t[e.metric_key] = (t[e.metric_key] ?? 0) + e.delta
        if (!rt[e.rep_id]) rt[e.rep_id] = {}
        rt[e.rep_id][e.metric_key] = (rt[e.rep_id][e.metric_key] ?? 0) + e.delta
      }
      setTotals(t)
      setRepTotals(rt)
      setPrevTotals({})
      return
    }
    if (!bounds) return
    const startISO = toISO(bounds.start)
    const endISO   = toISO(bounds.end)
    getActivityCountsAction(startISO, endISO).then((res) => {
      const merged: Record<string, number> = {}
      Object.values(res).forEach((m) => {
        Object.entries(m).forEach(([k, v]) => { merged[k] = (merged[k] ?? 0) + v })
      })
      setTotals(merged)
      setRepTotals(res)
    })
    if (prevBounds) {
      const ps = toISO(prevBounds.start)
      const pe = toISO(prevBounds.end)
      getActivityCountsAction(ps, pe).then((res) => {
        const merged: Record<string, number> = {}
        Object.values(res).forEach((m) => {
          Object.entries(m).forEach(([k, v]) => { merged[k] = (merged[k] ?? 0) + v })
        })
        setPrevTotals(merged)
      })
    } else {
      setPrevTotals({})
    }
  }, [range, offset, bounds, prevBounds, feed])

  const tgt = useMemo(() => {
    const period = range === 'day' ? 'daily' : range === 'week' ? 'weekly' : range === 'month' ? 'monthly' : null
    return targets.find((t) => t.period === period) ?? null
  }, [range, targets])

  const filteredClients = useMemo(
    () => clients.filter((c) => c.since_date && inBoundsDate(c.since_date, bounds)),
    [clients, bounds],
  )
  const prevClients = useMemo(
    () => clients.filter((c) => c.since_date && inBoundsDate(c.since_date, prevBounds)),
    [clients, prevBounds],
  )

  const closedCount     = filteredClients.length
  const prevClosedCount = prevClients.length

  const periodClientCount = useMemo(() => {
    if (!bounds) return clients.filter((c) => c.since_date).length
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = bounds.end > today ? today : bounds.end
    const endStr  = toISO(endDate)
    return clients.filter((c) => c.since_date && (c.since_date as string) <= endStr).length
  }, [clients, bounds])

  useEffect(() => {
    getTrendAction(trendGranularity).then(setTrendRows)
  }, [trendGranularity])

  useEffect(() => {
    getDiscByHourAction().then(setDiscByHour)
  }, [])

  // Trend charts: aggregated server-side, bucketed here
  const weeks = useMemo(() => {
    const out = []
    for (let w = 5; w >= 0; w--) {
      const end = new Date(); end.setDate(end.getDate() - w * 7)
      const start = new Date(end); start.setDate(end.getDate() - 6)
      const startStr = toISO(start)
      const endStr   = toISO(end)
      const t: Record<string, number> = {}
      trendRows.filter((r) => r.date >= startStr && r.date <= endStr)
               .forEach((r) => { t[r.metric_key] = (t[r.metric_key] ?? 0) + r.total })
      out.push({ label: (start.getMonth() + 1) + '/' + start.getDate(),
        dials: t.dials ?? 0, conv: t.conv ?? 0, vm: t.vm ?? 0,
        disc: t.disc ?? 0, demo: t.demo ?? 0, onb: t.onb ?? 0, closed: t.closed ?? 0 })
    }
    return out
  }, [trendRows])

  const days = useMemo(() => {
    const out = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = toISO(d)
      const t: Record<string, number> = {}
      trendRows.filter((r) => r.date === dateStr)
               .forEach((r) => { t[r.metric_key] = (t[r.metric_key] ?? 0) + r.total })
      out.push({ label: (d.getMonth() + 1) + '/' + d.getDate(),
        dials: t.dials ?? 0, conv: t.conv ?? 0, vm: t.vm ?? 0,
        disc: t.disc ?? 0, demo: t.demo ?? 0, onb: t.onb ?? 0, closed: t.closed ?? 0 })
    }
    return out
  }, [trendRows])

  const trendData = trendGranularity === 'week' ? weeks : days
  const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null)
  const label = periodLabel(range, offset, bounds)
  const arr = initialMrr * 12

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
      projDays = 91
    } else if (range === 'day') {
      // Selected day + 7 days of prior context
      windowStart = new Date(bounds.start)
      windowStart.setDate(windowStart.getDate() - 7)
      windowEnd = new Date(bounds.end)
      projDays = 5
    } else if (range === 'week') {
      // Selected week + prior calendar week as context
      windowStart = new Date(bounds.start)
      windowStart.setDate(windowStart.getDate() - 7)
      windowEnd = new Date(bounds.end)
      projDays = 7
    } else {
      // Selected month + prior calendar month as context
      windowStart = new Date(bounds.start.getFullYear(), bounds.start.getMonth() - 1, 1)
      windowEnd = new Date(bounds.end)
      projDays = 30
    }

    const windowEndCapped = windowEnd > today ? new Date(today) : windowEnd
    const windowStartStr = toISO(windowStart)
    const windowEndStr   = toISO(windowEndCapped)

    // Collect unique signup dates within the window; always anchor both ends
    const eventDates = [...new Set(
      sorted
        .filter((c) => { const d = c.since_date as string; return d >= windowStartStr && d <= windowEndStr })
        .map((c) => c.since_date as string),
    )]
    if (!eventDates.includes(windowStartStr)) eventDates.unshift(windowStartStr)
    if (!eventDates.includes(windowEndStr))   eventDates.push(windowEndStr)
    eventDates.sort()

    const actual = eventDates.map((date) => ({
      date,
      arr: sorted.filter((c) => (c.since_date as string) <= date).reduce((sum, c) => sum + c.mrr * 12, 0),
      clientNames: sorted.filter((c) => (c.since_date as string) === date).map((c) => c.name),
    }))

    const currentArr = actual[actual.length - 1]?.arr ?? 0

    // Weekly growth rate calculated over a window proportional to the view
    const growthWindowDays = range === 'day' ? 7 : range === 'week' ? 14 : range === 'month' ? 60 : 56
    const growthWinStart = new Date(windowEndCapped)
    growthWinStart.setDate(growthWinStart.getDate() - growthWindowDays)
    const recentArr = sorted
      .filter((c) => { const d = c.since_date as string; return d >= toISO(growthWinStart) && d <= windowEndStr })
      .reduce((sum, c) => sum + c.mrr * 12, 0)
    const weeklyGrowth = recentArr / (growthWindowDays / 7)

    // Sparse projection points (fewer for shorter views)
    const projSteps = range === 'all' ? 13 : range === 'month' ? 6 : 3
    const stepDays  = Math.round(projDays / projSteps)
    const projected = Array.from({ length: projSteps }, (_, i) => {
      const d = new Date(windowEndCapped)
      d.setDate(d.getDate() + (i + 1) * stepDays)
      return { date: toISO(d), arr: Math.round(currentArr + weeklyGrowth * ((i + 1) * stepDays / 7)) }
    })

    return { actual, projected }
  }, [clients, range, offset, bounds])

  const fmtArrTick = (v: number) =>
    v === 0 ? '$0' : v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`

  const t = totals
  const pt = prevTotals

  const pipelineStages = [
    { label: 'Dials',     value: t.dials ?? 0, color: '#00D4FF' },
    { label: 'Conv',      value: t.conv  ?? 0, color: '#8B5CF6' },
    { label: 'Discovery', value: t.disc  ?? 0, color: '#FFB800' },
    { label: 'Demo',      value: t.demo  ?? 0, color: '#FF3D9A' },
    { label: 'Closed',    value: closedCount,   color: '#00E5A0' },
  ]

  void pct // imported but used inline below

  return (
    <div className="flex flex-col gap-[18px]">

      {/* Header */}
      <div className="flex justify-between items-center px-1 pt-1">
        <div>
          <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">Historical overview</div>
          <div className="text-lg font-bold mt-1">Team performance · {label.toLowerCase()}</div>
        </div>
        <div className="flex items-center gap-3">
          {range !== 'all' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOffset((o) => o + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-2 hover:text-white hover:bg-[#1E2538] transition-colors text-base leading-none"
              >←</button>
              <span className="text-[12px] text-ink-2 font-medium w-[130px] text-center">{label}</span>
              <button
                onClick={() => setOffset((o) => Math.max(0, o - 1))}
                disabled={offset === 0}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-2 hover:text-white hover:bg-[#1E2538] transition-colors text-base leading-none disabled:opacity-25 disabled:cursor-not-allowed"
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

      {/* Hero row */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5">

        {/* Left: KPI grid + conversion pipeline */}
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-3 gap-3.5">
            <Card><KPI label="Dials"         value={t.dials  ?? 0} target={tgt?.dials}  color="#00D4FF" formatter={fmtNum} delta={delta(t.dials ?? 0, pt.dials ?? 0)} /></Card>
            <Card><KPI label="Voicemails"    value={t.vm     ?? 0}                       color="#5A6685" formatter={fmtNum} delta={delta(t.vm    ?? 0, pt.vm    ?? 0)} /></Card>
            <Card><KPI label="Conversations" value={t.conv   ?? 0} target={tgt?.conv}   color="#8B5CF6" formatter={fmtNum} delta={delta(t.conv  ?? 0, pt.conv  ?? 0)} /></Card>
            <Card><KPI label="Discovery"     value={t.disc   ?? 0} target={tgt?.disc}   color="#FFB800" formatter={fmtNum} delta={delta(t.disc  ?? 0, pt.disc  ?? 0)} /></Card>
            <Card><KPI label="Demo"          value={t.demo   ?? 0} target={tgt?.demo}   color="#FF3D9A" formatter={fmtNum} delta={delta(t.demo  ?? 0, pt.demo  ?? 0)} /></Card>
            <Card><KPI label="Closed"        value={closedCount}    target={tgt?.closed} color="#00E5A0" formatter={fmtNum} delta={delta(closedCount, prevClosedCount)} /></Card>
          </div>

          {/* Conversion pipeline */}
          <Card className="h-full">
            <SectionTitle>Conversion pipeline · {label.toLowerCase()}</SectionTitle>
            <div className="flex items-center pt-2">
              {pipelineStages.map((s, i) => (
                <div key={s.label} className={`flex items-center ${i < pipelineStages.length - 1 ? 'flex-1' : 'flex-none'}`}>
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.8px]" style={{ color: s.color }}>{s.label}</div>
                    <div className="mono text-[36px] font-extrabold text-white leading-none">{s.value}</div>
                    <div className="w-9 h-[3px] rounded-sm opacity-70" style={{ background: s.color }} />
                  </div>
                  {i < pipelineStages.length - 1 && (() => {
                    const rate = s.value ? (pipelineStages[i + 1].value / s.value * 100) : 0
                    return (
                      <div className="flex-1 flex flex-col items-center gap-1 px-1.5 min-w-12">
                        <div className={`mono text-[11px] font-bold ${rate > 0 ? 'text-ink-2' : 'text-[#3A4460]'}`}>
                          {rate.toFixed(0)}%
                        </div>
                        <div className="flex items-center w-full">
                          <div className="flex-1 h-px bg-[#2A3350]" />
                          <span className="text-[#2A3350] text-[10px] leading-none">▶</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
            {(() => {
              const mult = range === 'month' ? 4 : range === 'day' ? 1 / 5 : 1
              const goalRings = [
                { label: 'Dials',   value: t.dials ?? 0, goal: 200 * mult, color: '#00D4FF' },
                { label: 'Convs',   value: t.conv  ?? 0, goal: 100 * mult, color: '#8B5CF6' },
                { label: 'Disc',    value: t.disc  ?? 0, goal:  10 * mult, color: '#FFB800' },
                { label: 'Demos',   value: t.demo  ?? 0, goal:   5 * mult, color: '#FF3D9A' },
              ]
              const r = 22
              const circ = 2 * Math.PI * r
              return (
                <div className="flex items-center justify-around pt-3.5 mt-3.5 border-t border-line">
                  {goalRings.map((g) => {
                    const progress = Math.min(g.value / g.goal * 100, 100)
                    const dashOffset = circ * (1 - progress / 100)
                    return (
                      <div key={g.label} className="flex flex-col items-center gap-1.5">
                        <div className="relative w-[52px] h-[52px]">
                          <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90" style={{ display: 'block' }}>
                            <circle cx="26" cy="26" r={r} fill="none" stroke="#1E2538" strokeWidth="4" />
                            <circle
                              cx="26" cy="26" r={r} fill="none"
                              stroke={g.color} strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={circ}
                              strokeDashoffset={dashOffset}
                              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="mono text-[10px] font-bold text-white leading-none">{Math.round(progress)}%</span>
                          </div>
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.6px] font-bold" style={{ color: g.color }}>{g.label}</div>
                        <div className="mono text-[9px] text-ink-2 leading-none">{g.value}<span className="text-ink-3">/{g.goal}</span></div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </Card>
        </div>

        {/* Right: Speedometer + ARR */}
        <Card className="flex flex-col items-center" style={{ padding: 20 }}>
          <div className="text-[11px] text-ink-2 uppercase tracking-[0.6px] font-semibold self-start mb-1">
            {range === 'all' ? 'Active Clients' : `Clients · ${label.toLowerCase()}`}
          </div>
          <Speedometer value={periodClientCount} milestones={[10, 20, 40, 80, 100]} max={100} size={220} />
          <div className="w-full border-t border-line mt-4 pt-4">
            <div className="mx-auto w-1/2 flex flex-col items-center justify-center border-b border-line mb-2">
              <div className="text-[11px] text-ink-2 uppercase tracking-[0.6px] font-semibold mb-1.5">Annual Recurring Revenue</div>
              <div className="mono text-[34px] font-extrabold text-white tracking-[-0.5px] leading-none">{fmtMoney(arr)}</div>
              <div className="flex items-center gap-2.5 mt-2">
                <Pill color="#00E5A0">MRR {fmtMoney(initialMrr)}</Pill>
              </div>
            </div>
          </div>
          <div className="w-full mt-4 pt-1">
            <div className="text-[10px] text-ink-3 uppercase tracking-[0.8px] font-semibold mb-2">ARR growth · projected</div>
            <ArrGrowthChart
              actual={arrGrowth.actual}
              projected={arrGrowth.projected}
              formatter={fmtArrTick}
            />
          </div>
        </Card>
      </div>

      {/* Trend + Funnel */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5">
        <Card>
          <SectionTitle right={
            <div className="flex items-center gap-4">
              <div className="flex gap-3.5 text-[11px] text-ink-2">
                {[{ c: '#00D4FF', l: 'Dials' }, { c: '#8B5CF6', l: 'Conv' }, { c: '#FFB800', l: 'Disc' }, { c: '#FF3D9A', l: 'Demos' }].map((x) => (
                  <span key={x.l} className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: x.c }} />{x.l}
                  </span>
                ))}
              </div>
              <Segmented
                value={trendGranularity}
                onChange={(v) => setTrendGranularity(v as 'week' | 'day')}
                options={[{ value: 'week', label: 'Weekly' }, { value: 'day', label: 'Daily' }]}
              />
            </div>
          }>{trendGranularity === 'week' ? 'Weekly trend · last 6 weeks' : 'Daily trend · last 30 days'}</SectionTitle>
          <LineChart
            labels={trendData.map((w) => w.label)}
            series={[
              { name: 'Dials', color: '#00D4FF', data: trendData.map((w) => w.dials) },
              { name: 'Conv',  color: '#8B5CF6', data: trendData.map((w) => w.conv) },
              { name: 'Disc',  color: '#FFB800', data: trendData.map((w) => w.disc * 4) },
              { name: 'Demos', color: '#FF3D9A', data: trendData.map((w) => w.demo * 8) },
            ]}
            height={240}
          />
          <div className="mono text-[10px] text-ink-3 mt-2">* disc 4x, demos 8x scale for trend visibility</div>
        </Card>

        <Card className="flex flex-col">
          <SectionTitle>Funnel</SectionTitle>
          <FunnelBar stages={[
            { label: 'Dials',         value: t.dials ?? 0, color: '#00D4FF' },
            { label: 'Conversations', value: t.conv  ?? 0, color: '#8B5CF6' },
            { label: 'Discovery',     value: t.disc  ?? 0, color: '#FFB800' },
            { label: 'Demo',          value: t.demo  ?? 0, color: '#FF3D9A' },
            { label: 'Won',           value: closedCount,   color: '#00E5A0' },
          ]} />
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
                  { label: 'Dials',  color: '#00D4FF', hl: false },
                  { label: 'Conv',   color: '#8B5CF6', hl: false },
                  { label: 'VM',     color: '#5A6685', hl: false },
                  { label: 'Disc',   color: '#00E5A0', hl: true  },
                  { label: 'Demo',   color: '#FF3D9A', hl: false },
                  { label: 'Closed', color: '#00E5A0', hl: true  },
                ] as const).map((col) => (
                  <th
                    key={col.label}
                    className={`text-right px-4 py-2.5 font-semibold border-b border-line ${col.hl ? 'bg-[#00E5A0]/[0.05]' : ''}`}
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
                const conv   = m.conv   ?? 0
                const vm     = m.vm     ?? 0
                const disc   = m.disc   ?? 0
                const demo   = m.demo   ?? 0
                const closed = m.closed ?? 0
                const cvRate   = dials ? conv   / dials * 100 : 0
                const discRate = conv  ? disc   / conv  * 100 : 0
                const demoRate = disc  ? demo   / disc  * 100 : 0
                const winRate  = demo  ? closed / demo  * 100 : 0
                const hasData  = dials + conv + vm + disc + demo + closed > 0
                return (
                  <tr key={rep.id} className="border-b border-[#1A1F30]" style={{ opacity: hasData ? 1 : 0.4 }}>
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
                      <span className="mono text-[12px] font-semibold text-white">{dials || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-[12px] font-semibold text-white">{conv || '—'}</span>
                      {cvRate > 0 && <span className="mono text-[10px] text-ink-3 ml-1.5">{cvRate.toFixed(0)}%</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-[12px] text-ink-2">{vm || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right bg-[#00E5A0]/[0.03]">
                      <span className="mono text-[12px] font-semibold text-white">{disc || '—'}</span>
                      {discRate > 0 && <span className="mono text-[10px] text-ink-3 ml-1.5">{discRate.toFixed(0)}%</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-[12px] font-semibold text-white">{demo || '—'}</span>
                      {demoRate > 0 && <span className="mono text-[10px] text-ink-3 ml-1.5">{demoRate.toFixed(0)}%</span>}
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
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-3 text-[12px]">No reps yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Discovery by hour */}
      {(() => {
        const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am–8pm
        const hourData = HOURS.map((h) => ({
          h,
          total: discByHour.find((d) => d.hour === h)?.total ?? 0,
        }))
        const peak = hourData.reduce((best, d) => d.total > best.total ? d : best, hourData[0])
        const maxVal = Math.max(...hourData.map((d) => d.total), 1)

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
                    const barH = total ? Math.max((total / maxVal) * 100, 3) : 0
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div className="relative w-full flex flex-col items-center justify-end" style={{ height: 160 }}>
                          {total > 0 && (
                            <div
                              className="mono text-[9px] font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: isPeak ? '#00E5A0' : '#FFB800' }}
                            >
                              {total}
                            </div>
                          )}
                          <div
                            className="w-full rounded-t-[3px] transition-all duration-300"
                            style={{
                              height: `${barH}%`,
                              background: isPeak
                                ? 'linear-gradient(180deg, #00E5A0, #00B87A)'
                                : total > 0
                                  ? 'linear-gradient(180deg, #FFB84D, #CC8800)'
                                  : '#1A2035',
                              opacity: total > 0 ? 0.9 : 0.3,
                              minHeight: total > 0 ? 3 : 0,
                            }}
                          />
                        </div>
                        <div
                          className="mono text-[8px] leading-none"
                          style={{ color: isPeak ? '#00E5A0' : '#3A4460' }}
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
                    <span className="mono font-bold text-white">{fmtHour(peak.h)}</span>
                    <span className="text-ink-3">— {peak.total} disc {peak.total === 1 ? 'booking' : 'bookings'} logged</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })()}

      {/* Client breakdown */}
      <Card padding={0}>
        <div className="px-5 py-4 border-b border-line">
          <div className="text-[13px] font-semibold">Client breakdown</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-ink-3 text-[10.5px] uppercase tracking-[0.5px]">
                {['Client', 'MRR', 'ARR', 'Rep', 'Date'].map((h) => (
                  <th key={h} className={`${h === 'Client' ? 'text-left' : 'text-right'} px-3.5 py-3 font-semibold border-b border-line`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const owner = reps.find((r) => r.id === c.owner_id)
                return (
                  <tr key={c.id} className="border-b border-[#1A1F30]">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.status === 'active' ? '#00E5A0' : '#FFB800' }} />
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="mono px-3.5 py-3 text-right font-semibold text-ink-1">{fmtMoney(c.mrr)}</td>
                    <td className="mono px-3.5 py-3 text-right font-semibold text-mint">{fmtMoney(c.mrr * 12)}</td>
                    <td className="px-3.5 py-3 text-right text-ink-2">{owner ? owner.name.split(' ')[0] : '—'}</td>
                    <td className="mono px-3.5 py-3 text-right text-ink-3">{c.since_date}</td>
                  </tr>
                )
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3.5 py-8 text-center text-ink-3 text-[12px]">No clients yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}
