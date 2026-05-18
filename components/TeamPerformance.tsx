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

      {/* Hero row: ARR + Active clients speedometer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <Card style={{ background: 'linear-gradient(135deg, #1A2B4F 0%, #131826 60%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: '#8B95B2', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Annual Recurring Revenue</div>
              <div className="mono" style={{ fontSize: 44, fontWeight: 800, color: '#fff', letterSpacing: -1, marginTop: 4, lineHeight: 1 }}>{fmtMoney(arr)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <Pill color="#00E5A0">MRR {fmtMoney(initialMrr)}</Pill>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Sparkline data={mrrSparkData} color="#00D4FF" width={150} height={50} />
              <div style={{ fontSize: 10, color: '#5A6685', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>last 7 weeks</div>
            </div>
          </div>
        </Card>
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, color: '#8B95B2', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 4, alignSelf: 'flex-start' }}>Active Clients</div>
          <Speedometer value={activeClientCount} milestones={[10, 20, 40, 80, 100]} max={100} size={220} />
        </Card>
      </div>

      {/* KPI cards — 3 × 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Card><KPI label="Dials" value={totals.dials} target={tgt?.dials} color="#00D4FF" formatter={fmtNum} delta={delta(totals.dials, prevTotals.dials)} /></Card>
        <Card><KPI label="Conversations" value={totals.conv} target={tgt?.conv} color="#8B5CF6" formatter={fmtNum} delta={delta(totals.conv, prevTotals.conv)} /></Card>
        <Card><KPI label="Discovery Booked" value={totals.disc} target={tgt?.disc} color="#FFB800" formatter={fmtNum} delta={delta(totals.disc, prevTotals.disc)} /></Card>
        <Card><KPI label="Demo Booked" value={totals.demo} target={tgt?.demo} color="#FF3D9A" formatter={fmtNum} delta={delta(totals.demo, prevTotals.demo)} /></Card>
        <Card><KPI label="Onboarding Set" value={totals.onb} target={tgt?.onb} color="#00E5A0" formatter={fmtNum} delta={delta(totals.onb, prevTotals.onb)} /></Card>
        <Card><KPI label="Voicemails" value={totals.vm} color="#5A6685" formatter={fmtNum} delta={delta(totals.vm, prevTotals.vm)} /></Card>
      </div>

      {/* Trend + Funnel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <Card>
          <SectionTitle right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#8B95B2' }}>
                {[{ c: '#00D4FF', l: 'Dials' }, { c: '#8B5CF6', l: 'Conv' }, { c: '#FF3D9A', l: 'Demos' }, { c: '#00E5A0', l: 'Onb' }].map((x) => (
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
              { name: 'Onb', color: '#00E5A0', data: trendData.map((w) => w.onb * 14) },
            ]}
            height={240}
          />
          <div style={{ fontSize: 10, color: '#5A6685', marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>* demos and onboarding plotted at scale for trend visibility</div>
        </Card>

        <Card>
          <SectionTitle>Funnel</SectionTitle>
          <FunnelBar stages={[
            { label: 'Dials',         value: totals.dials,  color: '#00D4FF' },
            { label: 'Conversations', value: totals.conv,   color: '#8B5CF6' },
            { label: 'Discovery',     value: totals.disc,   color: '#FFB800' },
            { label: 'Demo booked',   value: totals.demo,   color: '#FF3D9A' },
            { label: 'Onboarding',    value: totals.onb,    color: '#00E5A0' },
            { label: 'Closed won',    value: totals.closed, color: '#3B82F6' },
          ]} />
        </Card>
      </div>

      {/* Conversion rings */}
      <Card>
        <SectionTitle>Conversion rates · {rangeLabel}</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
          {[
            { l: 'Dial → Conv',  v: pct(totals.conv,   totals.dials),  c: '#8B5CF6' },
            { l: 'Conv → Disc',  v: pct(totals.disc,   totals.conv),   c: '#FFB800' },
            { l: 'Disc → Demo',  v: pct(totals.demo,   totals.disc),   c: '#FF3D9A' },
            { l: 'Demo → Onb',   v: pct(totals.onb,    totals.demo),   c: '#00E5A0' },
            { l: 'Onb → Close',  v: pct(totals.closed, totals.onb),    c: '#3B82F6' },
            { l: 'Dial → Close', v: pct(totals.closed, totals.dials),  c: '#00D4FF' },
          ].map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Ring value={x.v / 100} target={1} size={68} stroke={7} color={x.c} />
              <div>
                <div style={{ fontSize: 11, color: '#8B95B2' }}>{x.l}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{isNaN(x.v) ? '0.0' : x.v.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Rep breakdown table */}
      <Card padding={0}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E2538' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Per-rep breakdown · {rangeLabel}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: '#5A6685', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {['Rep', 'Dials', 'Conv', 'VM', 'Disc', 'Demo', 'Onb', 'Closed', 'D→C', 'C→Di', 'Di→De', 'De→On', 'On→Cl'].map((h) => (
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
                    {(['dials', 'conv', 'vm', 'disc', 'demo', 'onb', 'closed'] as const).map((k) => (
                      <td key={k} className="mono" style={{ padding: '12px 14px', textAlign: 'right', color: (k === 'closed' || k === 'demo') ? '#00E5A0' : '#D8DEEF', fontWeight: 600 }}>{a[k]}</td>
                    ))}
                    {[pct(a.conv, a.dials), pct(a.disc, a.conv), pct(a.demo, a.disc), pct(a.onb, a.demo), pct(a.closed, a.onb)].map((v, i) => (
                      <td key={i} className="mono" style={{ padding: '12px 14px', textAlign: 'right', color: '#8B95B2' }}>{isNaN(v) ? '—' : v.toFixed(0) + '%'}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
