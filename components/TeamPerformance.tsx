'use client'

import { useState, useMemo } from 'react'
import type { Rep, Client, ClosedDeal, ActivityDaily, Target } from '@/lib/types'
import { aggregate, inRange, fmtMoney, fmtNum, pct } from '@/lib/helpers'
import { Card, Segmented, Pill, SectionTitle, KPI, TargetBar } from './ui/primitives'
import { LineChart, FunnelBar, Ring, Sparkline, Speedometer } from './charts'

interface TeamPerformanceProps {
  reps: Rep[]
  clients: Client[]
  closedDeals: ClosedDeal[]
  activity: ActivityDaily[]
  targets: Target[]
  initialMrr: number
  activeClientCount: number
}

type Range = 'day' | 'week' | 'month' | 'all'

export function TeamPerformance({ reps, clients, closedDeals, activity, targets, initialMrr, activeClientCount }: TeamPerformanceProps) {
  const [range, setRange] = useState<Range>('week')
  const [trendGranularity, setTrendGranularity] = useState<'week' | 'day'>('week')

  const tgt = useMemo(() => {
    const period = range === 'day' ? 'daily' : range === 'week' ? 'weekly' : range === 'month' ? 'monthly' : null
    return targets.find((t) => t.period === period) ?? null
  }, [range, targets])

  const filtered = useMemo(() => activity.filter((r) => inRange(r.date, range)), [activity, range])
  const totals = useMemo(() => aggregate(filtered), [filtered])

  const prev = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return activity.filter((r) => {
      const d = new Date(r.date + 'T00:00')
      if (range === 'day') { const t = new Date(today); t.setDate(today.getDate() - 1); return d.toDateString() === t.toDateString() }
      if (range === 'week') { const end = new Date(today); end.setDate(today.getDate() - 7); const start = new Date(end); start.setDate(end.getDate() - 6); return d >= start && d <= end }
      const pm = new Date(today); pm.setMonth(today.getMonth() - 1); return d.getMonth() === pm.getMonth() && d.getFullYear() === pm.getFullYear()
    })
  }, [activity, range])
  const prevTotals = useMemo(() => aggregate(prev), [prev])

  const weeks = useMemo(() => {
    const out = []
    for (let w = 5; w >= 0; w--) {
      const end = new Date(); end.setDate(end.getDate() - w * 7)
      const start = new Date(end); start.setDate(end.getDate() - 6)
      const rows = activity.filter((r) => { const d = new Date(r.date + 'T00:00'); return d >= start && d <= end })
      out.push({ label: (start.getMonth() + 1) + '/' + start.getDate(), ...aggregate(rows) })
    }
    return out
  }, [activity])

  const days = useMemo(() => {
    const out = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      const dateStr = d.toISOString().slice(0, 10)
      const rows = activity.filter((r) => r.date === dateStr)
      out.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), ...aggregate(rows) })
    }
    return out
  }, [activity])

  const trendData = trendGranularity === 'week' ? weeks : days

  const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null)
  const rangeLabel = range === 'day' ? 'today' : range === 'week' ? 'this week' : range === 'month' ? 'this month' : 'all time'
  const arr = initialMrr * 12

  const pipelineStages = [
    { label: 'Dials',     value: totals.dials,  color: '#00D4FF' },
    { label: 'Conv',      value: totals.conv,   color: '#8B5CF6' },
    { label: 'Discovery', value: totals.disc,   color: '#FFB800' },
    { label: 'Demo',      value: totals.demo,   color: '#FF3D9A' },
    { label: 'Closed',    value: totals.closed, color: '#00E5A0' },
  ]

  return (
    <div className="flex flex-col gap-[18px]">

      {/* Header */}
      <div className="flex justify-between items-center px-1 pt-1">
        <div>
          <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">Historical overview</div>
          <div className="text-lg font-bold mt-1">Team performance · {rangeLabel}</div>
        </div>
        <Segmented
          value={range}
          onChange={(v) => setRange(v as Range)}
          options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'all', label: 'All' }]}
        />
      </div>

      {/* Hero row: KPI grid + pipeline left, speedometer + ARR right */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5">

        {/* Left: 3×2 KPI grid + conversion pipeline */}
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-3 gap-3.5">
            <Card><KPI label="Dials" value={totals.dials} target={tgt?.dials} color="#00D4FF" formatter={fmtNum} delta={delta(totals.dials, prevTotals.dials)} /></Card>
            <Card><KPI label="Voicemails" value={totals.vm} color="#5A6685" formatter={fmtNum} delta={delta(totals.vm, prevTotals.vm)} /></Card>
            <Card><KPI label="Conversations" value={totals.conv} target={tgt?.conv} color="#8B5CF6" formatter={fmtNum} delta={delta(totals.conv, prevTotals.conv)} /></Card>
            <Card><KPI label="Discovery" value={totals.disc} target={tgt?.disc} color="#FFB800" formatter={fmtNum} delta={delta(totals.disc, prevTotals.disc)} /></Card>
            <Card><KPI label="Demo" value={totals.demo} target={tgt?.demo} color="#FF3D9A" formatter={fmtNum} delta={delta(totals.demo, prevTotals.demo)} /></Card>
            <Card><KPI label="Closed" value={totals.closed} target={tgt?.closed} color="#00E5A0" formatter={fmtNum} delta={delta(totals.closed, prevTotals.closed)} /></Card>
          </div>

          {/* Conversion pipeline */}
          <Card>
            <SectionTitle>Conversion pipeline · {rangeLabel}</SectionTitle>
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
          </Card>
        </div>

        {/* Right: Speedometer + ARR */}
        <Card className="flex flex-col items-center h-full justify-between" style={{ padding: 20 }}>
          <div className="text-[11px] text-ink-2 uppercase tracking-[0.6px] font-semibold self-start mb-1">Active Clients</div>
          <Speedometer value={activeClientCount} milestones={[10, 20, 40, 80, 100]} max={100} size={220} />
          <div className="w-full border-t border-line mt-4 pt-4">
            <div className="mx-auto w-1/2 flex flex-col items-center justify-center border-b border-line mb-2">
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.6px] font-semibold mb-1.5">Annual Recurring Revenue</div>
            <div className="mono text-[34px] font-extrabold text-white tracking-[-0.5px] leading-none">{fmtMoney(arr)}</div>
            <div className="flex items-center gap-2.5 mt-2">
              <Pill color="#00E5A0">MRR {fmtMoney(initialMrr)}</Pill>
            </div>
              
            </div>
          </div>
        </Card>
      </div>

      {/* Trend + Funnel */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5">
        <Card>
          <SectionTitle right={
            <div className="flex items-center gap-4">
              <div className="flex gap-3.5 text-[11px] text-ink-2">
                {[{ c: '#00D4FF', l: 'Dials' }, { c: '#8B5CF6', l: 'Conv' }, { c: '#FF3D9A', l: 'Demos' }].map((x) => (
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
              { name: 'Conv', color: '#8B5CF6', data: trendData.map((w) => w.conv) },
              { name: 'Demos', color: '#FF3D9A', data: trendData.map((w) => w.demo * 8) },
            ]}
            height={240}
          />
          <div className="mono text-[10px] text-ink-3 mt-2">* demos plotted at 8× scale for trend visibility</div>
        </Card>

        <Card className="flex flex-col">
          <SectionTitle>Funnel</SectionTitle>
          <FunnelBar stages={[
            { label: 'Dials',         value: totals.dials,  color: '#00D4FF' },
            { label: 'Conversations', value: totals.conv,   color: '#8B5CF6' },
            { label: 'Discovery',     value: totals.disc,   color: '#FFB800' },
            { label: 'Demo ',   value: totals.demo,   color: '#FF3D9A' },
            { label: 'Won',    value: totals.closed, color: '#00E5A0' },
          ]} />
        </Card>
      </div>

      {/* Rep breakdown table */}
      <Card padding={0}>
        <div className="px-5 py-4 border-b border-line">
          <div className="text-[13px] font-semibold">Per-rep breakdown · {rangeLabel}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-ink-3 text-[10.5px] uppercase tracking-[0.5px]">
                {['Rep', 'Dials', 'Conv', 'VM', 'Disc', 'Demo', 'Closed', 'D→C', 'C→Di', 'Di→De', 'De→Cl'].map((h) => (
                  <th key={h} className={`${h === 'Rep' ? 'text-left' : 'text-right'} px-3.5 py-3 font-semibold border-b border-line`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reps.map((rep) => {
                const rows = filtered.filter((r) => r.rep_id === rep.id)
                const a = aggregate(rows)
                return (
                  <tr key={rep.id} className="border-b border-[#1A1F30]">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold text-bg-1"
                          style={{ background: `linear-gradient(135deg, ${rep.color}, ${rep.color}99)` }}
                        >{rep.initials}</div>
                        <span className="font-semibold">{rep.name}</span>
                      </div>
                    </td>
                    {(['dials', 'conv', 'vm', 'disc', 'demo', 'closed'] as const).map((k) => (
                      <td key={k} className={`mono px-3.5 py-3 text-right font-semibold ${k === 'closed' ? 'text-mint' : 'text-ink-1'}`}>{a[k]}</td>
                    ))}
                    {[pct(a.conv, a.dials), pct(a.disc, a.conv), pct(a.demo, a.disc), pct(a.closed, a.demo)].map((v, i) => (
                      <td key={i} className="mono px-3.5 py-3 text-right text-ink-2">{isNaN(v) ? '—' : v.toFixed(0) + '%'}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Client breakdown table */}
      <Card padding={0}>
        <div className="px-5 py-4 border-b border-line">
          <div className="text-[13px] font-semibold">Client breakdown</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-ink-3 text-[10.5px] uppercase tracking-[0.5px]">
                {['Client', 'Type', 'MRR', 'ARR', 'Rep', 'Date'].map((h) => (
                  <th key={h} className={`${h === 'Client' ? 'text-left' : 'text-right'} px-3.5 py-3 font-semibold border-b border-line`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const owner = reps.find((r) => r.id === c.owner_id)
                const planColor = c.plan === 'Scale' ? '#8B5CF6' : c.plan === 'Growth' ? '#00D4FF' : '#FFB800'
                return (
                  <tr key={c.id} className="border-b border-[#1A1F30]">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.status === 'active' ? '#00E5A0' : '#FFB800' }} />
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: planColor, background: planColor + '22' }}>{c.plan}</span>
                    </td>
                    <td className="mono px-3.5 py-3 text-right font-semibold text-ink-1">{fmtMoney(c.mrr)}</td>
                    <td className="mono px-3.5 py-3 text-right font-semibold text-mint">{fmtMoney(c.mrr * 12)}</td>
                    <td className="px-3.5 py-3 text-right text-ink-2">{owner ? owner.name.split(' ')[0] : '—'}</td>
                    <td className="mono px-3.5 py-3 text-right text-ink-3">{c.since_date}</td>
                  </tr>
                )
              })}
              {closedDeals.map((d) => {
                const rep = reps.find((r) => r.id === d.rep_id)
                return (
                  <tr key={d.id} className="border-b border-[#1A1F30]">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-mint" />
                        <span className="font-semibold">{d.company_name}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-mint" style={{ background: '#00E5A022' }}>New</span>
                    </td>
                    <td className="mono px-3.5 py-3 text-right font-semibold text-ink-1">{fmtMoney(d.monthly_price)}</td>
                    <td className="mono px-3.5 py-3 text-right font-semibold text-mint">{fmtMoney(d.monthly_price * 12)}</td>
                    <td className="px-3.5 py-3 text-right text-ink-2">{rep ? rep.name.split(' ')[0] : '—'}</td>
                    <td className="mono px-3.5 py-3 text-right text-ink-3">{d.closed_date}</td>
                  </tr>
                )
              })}
              {clients.length === 0 && closedDeals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3.5 py-8 text-center text-ink-3 text-[12px]">No clients yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}
