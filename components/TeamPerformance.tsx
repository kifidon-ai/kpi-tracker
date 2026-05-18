'use client'

import { useState, useMemo } from 'react'
import type { Rep, ActivityDaily, Target } from '@/lib/types'
import { aggregate, inRange, fmtMoney, fmtNum, pct } from '@/lib/helpers'
import { Card, Segmented, Pill, SectionTitle, KPI, TargetBar } from './ui/primitives'
import { LineChart, FunnelBar, Ring, Sparkline, Speedometer } from './charts'

interface TeamPerformanceProps {
  reps: Rep[]
  activity: ActivityDaily[]
  targets: Target[]
  initialMrr: number
  activeClientCount: number
}

type Range = 'day' | 'week' | 'month' | 'all'

export function TeamPerformance({ reps, activity, targets, initialMrr, activeClientCount }: TeamPerformanceProps) {
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

  // 7-week MRR sparkline (static upward trend for now — real data would come from a MRR history table)
  const mrrSparkData = [initialMrr * 0.29, initialMrr * 0.41, initialMrr * 0.5, initialMrr * 0.63, initialMrr * 0.77, initialMrr * 0.9, initialMrr]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 0' }}>
        <div>
          <div style={{ fontSize: 11, color: '#5A6685', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Historical overview</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>Team performance · {rangeLabel}</div>
        </div>
        <Segmented
          value={range}
          onChange={(v) => setRange(v as Range)}
          options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'all', label: 'All' }]}
        />
      </div>

      {/* Hero row: KPI cards left, speedometer + ARR right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Left: 3×2 KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Card><KPI label="Dials" value={totals.dials} target={tgt?.dials} color="#00D4FF" formatter={fmtNum} delta={delta(totals.dials, prevTotals.dials)} /></Card>
          <Card><KPI label="Conversations" value={totals.conv} target={tgt?.conv} color="#8B5CF6" formatter={fmtNum} delta={delta(totals.conv, prevTotals.conv)} /></Card>
          <Card><KPI label="Discovery Booked" value={totals.disc} target={tgt?.disc} color="#FFB800" formatter={fmtNum} delta={delta(totals.disc, prevTotals.disc)} /></Card>
          <Card><KPI label="Demo Booked" value={totals.demo} target={tgt?.demo} color="#FF3D9A" formatter={fmtNum} delta={delta(totals.demo, prevTotals.demo)} /></Card>
          <Card><KPI label="Closed Won" value={totals.closed} target={tgt?.closed} color="#00E5A0" formatter={fmtNum} delta={delta(totals.closed, prevTotals.closed)} /></Card>
          <Card><KPI label="Voicemails" value={totals.vm} color="#5A6685" formatter={fmtNum} delta={delta(totals.vm, prevTotals.vm)} /></Card>
        </div>

        {/* Right: Speedometer + ARR */}
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, color: '#8B95B2', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, alignSelf: 'flex-start', marginBottom: 4 }}>Active Clients</div>
          <Speedometer value={activeClientCount} milestones={[10, 20, 40, 80, 100]} max={100} size={220} />
          <div style={{ width: '100%', borderTop: '1px solid #1E2538', marginTop: 16, paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: '#8B95B2', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 6 }}>Annual Recurring Revenue</div>
            <div className="mono" style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: -0.5, lineHeight: 1 }}>{fmtMoney(arr)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <Pill color="#00E5A0">MRR {fmtMoney(initialMrr)}</Pill>
            </div>
          </div>
        </Card>
      </div>

      {/* Trend + Funnel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <Card>
          <SectionTitle right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#8B95B2' }}>
                {[{ c: '#00D4FF', l: 'Dials' }, { c: '#8B5CF6', l: 'Conv' }, { c: '#FF3D9A', l: 'Demos' }].map((x) => (
                  <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.c }} />{x.l}
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
          <div style={{ fontSize: 10, color: '#5A6685', marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>* demos plotted at 8× scale for trend visibility</div>
        </Card>

        <Card>
          <SectionTitle>Funnel</SectionTitle>
          <FunnelBar stages={[
            { label: 'Dials',         value: totals.dials,  color: '#00D4FF' },
            { label: 'Conversations', value: totals.conv,   color: '#8B5CF6' },
            { label: 'Discovery',     value: totals.disc,   color: '#FFB800' },
            { label: 'Demo booked',   value: totals.demo,   color: '#FF3D9A' },
            { label: 'Closed won',    value: totals.closed, color: '#00E5A0' },
          ]} />
        </Card>
      </div>

      {/* Rep breakdown table */}
      <Card padding={0}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E2538' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Per-rep breakdown · {rangeLabel}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: '#5A6685', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {['Rep', 'Dials', 'Conv', 'VM', 'Disc', 'Demo', 'Closed', 'D→C', 'C→Di', 'Di→De', 'De→Cl'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'Rep' ? 'left' : 'right', padding: '12px 14px', fontWeight: 600, borderBottom: '1px solid #1E2538' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reps.map((rep) => {
                const rows = filtered.filter((r) => r.rep_id === rep.id)
                const a = aggregate(rows)
                return (
                  <tr key={rep.id} style={{ borderBottom: '1px solid #1A1F30' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: `linear-gradient(135deg, ${rep.color}, ${rep.color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#0A0E1A' }}>{rep.initials}</div>
                        <span style={{ fontWeight: 600 }}>{rep.name}</span>
                      </div>
                    </td>
                    {(['dials', 'conv', 'vm', 'disc', 'demo', 'closed'] as const).map((k) => (
                      <td key={k} className="mono" style={{ padding: '12px 14px', textAlign: 'right', color: k === 'closed' ? '#00E5A0' : '#D8DEEF', fontWeight: 600 }}>{a[k]}</td>
                    ))}
                    {[pct(a.conv, a.dials), pct(a.disc, a.conv), pct(a.demo, a.disc), pct(a.closed, a.demo)].map((v, i) => (
                      <td key={i} className="mono" style={{ padding: '12px 14px', textAlign: 'right', color: '#8B95B2' }}>{isNaN(v) ? '—' : v.toFixed(0) + '%'}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Conversion pipeline */}
      {(() => {
        const stages = [
          { label: 'Dials',      value: totals.dials,  color: '#00D4FF' },
          { label: 'Conv',       value: totals.conv,   color: '#8B5CF6' },
          { label: 'Discovery',  value: totals.disc,   color: '#FFB800' },
          { label: 'Demo',       value: totals.demo,   color: '#FF3D9A' },
          { label: 'Closed',     value: totals.closed, color: '#00E5A0' },
        ]
        return (
          <Card>
            <SectionTitle>Conversion pipeline · {rangeLabel}</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 8 }}>
              {stages.map((s, i) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: i < stages.length - 1 ? '1 1 0' : 'none' }}>
                  {/* Stage node */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
                    <div className="mono" style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ width: 36, height: 3, borderRadius: 2, background: s.color, opacity: 0.7 }} />
                  </div>
                  {/* Connector */}
                  {i < stages.length - 1 && (() => {
                    const rate = stages[i + 1].value && s.value ? (stages[i + 1].value / s.value * 100) : 0
                    return (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 6px', minWidth: 48 }}>
                        <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: rate > 0 ? '#8B95B2' : '#3A4460' }}>
                          {rate.toFixed(0)}%
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 0 }}>
                          <div style={{ flex: 1, height: 1, background: '#2A3350' }} />
                          <span style={{ color: '#2A3350', fontSize: 10, lineHeight: 1 }}>▶</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </Card>
        )
      })()}
    </div>
  )
}
