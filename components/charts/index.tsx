'use client'

import { useState } from 'react'

// --- Sparkline ---
interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  fill?: boolean
  strokeWidth?: number
}

export function Sparkline({ data, color = '#00D4FF', width = 140, height = 40, fill = true, strokeWidth = 2 }: SparklineProps) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pad = 2
  const stepX = (width - pad * 2) / Math.max(1, data.length - 1)
  const points = data.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (height - pad * 2) * (1 - (v - min) / range)
    return [x, y]
  })
  const d = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const fillD = d + ` L ${points[points.length - 1][0].toFixed(1)} ${height} L ${points[0][0].toFixed(1)} ${height} Z`
  const gid = 'sg-' + color.replace('#', '')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={fillD} fill={`url(#${gid})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={color} />
    </svg>
  )
}

// --- LineChart ---
interface LineSeries {
  name: string
  color: string
  data: number[]
}

interface LineChartProps {
  series: LineSeries[]
  labels: string[]
  width?: number
  height?: number
  yFormatter?: (v: number) => string
  showDots?: boolean
}

export function LineChart({ series, labels, width = 720, height = 240, yFormatter = String, showDots = true }: LineChartProps) {
  const pad = { l: 44, r: 16, t: 18, b: 28 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b
  const allVals = series.flatMap((s) => s.data)
  const maxV = Math.max(...allVals, 1)
  const niceMax = Math.ceil(maxV / 5) * 5 || 5
  const steps = 4
  const ticks = Array.from({ length: steps + 1 }, (_, i) => Math.round((niceMax * i) / steps))
  const n = labels.length
  const stepX = w / Math.max(1, n - 1)
  const xy = (i: number, v: number): [number, number] => [pad.l + i * stepX, pad.t + h - (v / niceMax) * h]

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block', maxWidth: '100%' }}>
      {ticks.map((t, i) => {
        const y = pad.t + h - (t / niceMax) * h
        return (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + w} y1={y} y2={y} stroke="#1E2538" strokeDasharray="2 4" />
            <text x={pad.l - 8} y={y + 4} fill="#5A6685" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono">{yFormatter(t)}</text>
          </g>
        )
      })}
      {labels.map((l, i) => (
        <text key={i} x={pad.l + i * stepX} y={height - 8} fill="#5A6685" fontSize="10" textAnchor="middle">{l}</text>
      ))}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => xy(i, v))
        const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
            {showDots && pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#0A0E1A" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// --- BarChart ---
interface BarDatum {
  label: string
  value: number
  color?: string
}

interface BarChartProps {
  data: BarDatum[]
  width?: number
  height?: number
  color?: string
  target?: number | null
  formatter?: (v: number) => string
}

export function BarChart({ data, width = 720, height = 220, color = '#00D4FF', target = null, formatter = String }: BarChartProps) {
  const pad = { l: 44, r: 16, t: 18, b: 36 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b
  const maxV = Math.max(...data.map((d) => d.value), target ?? 0, 1)
  const niceMax = Math.ceil(maxV / 5) * 5 || 5
  const ticks = [0, niceMax / 2, niceMax]
  const bw = (w / data.length) * 0.55
  const gap = (w / data.length) * 0.45

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', maxWidth: '100%' }}>
      {ticks.map((t, i) => {
        const y = pad.t + h - (t / niceMax) * h
        return (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + w} y1={y} y2={y} stroke="#1E2538" strokeDasharray="2 4" />
            <text x={pad.l - 8} y={y + 4} fill="#5A6685" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono">{formatter(t)}</text>
          </g>
        )
      })}
      {target != null && (() => {
        const y = pad.t + h - (target / niceMax) * h
        return (
          <g>
            <line x1={pad.l} x2={pad.l + w} y1={y} y2={y} stroke="#FFB800" strokeDasharray="4 4" strokeWidth="1.5" />
            <text x={pad.l + w} y={y - 4} fill="#FFB800" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono">target {formatter(target)}</text>
          </g>
        )
      })()}
      {data.map((d, i) => {
        const x = pad.l + i * (bw + gap) + gap / 2
        const bh = (d.value / niceMax) * h
        const y = pad.t + h - bh
        const c = d.color || color
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(2, bh)} rx="4" fill={c} opacity="0.9" />
            <text x={x + bw / 2} y={y - 6} fill={c} fontSize="11" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="600">{formatter(d.value)}</text>
            <text x={x + bw / 2} y={height - 12} fill="#8B95B2" fontSize="11" textAnchor="middle">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// --- Ring ---
interface RingProps {
  value: number
  target?: number
  size?: number
  stroke?: number
  color?: string
  label?: string
}

export function Ring({ value, target, size = 120, stroke = 10, color = '#00D4FF', label }: RingProps) {
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const ratio = Math.min(1, target ? value / target : value)
  const dash = C * ratio
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E2538" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)' }}
      />
      <text x={size / 2} y={size / 2 - 2} fill="#fff" fontSize={size * 0.22} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="700">
        {Math.round(ratio * 100)}%
      </text>
      {label && (
        <text x={size / 2} y={size / 2 + size * 0.16} fill="#8B95B2" fontSize="10" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">{label}</text>
      )}
    </svg>
  )
}

// --- Speedometer ---
interface SpeedometerProps {
  value: number
  milestones?: number[]
  max?: number
  color?: string
  size?: number
}

export function Speedometer({ value, milestones = [10, 20, 40, 80, 100], max = 100, color = '#00D4FF', size = 200 }: SpeedometerProps) {
  const cx = size / 2
  const r = size / 2 - 16        // radius: leaves 16px margin each side for the track
  const sw = 10                   // track stroke width
  const cy = r + sw / 2 + 16     // center: 16px clearance above arc top
  const svgH = cy + 56            // room for value text below

  const toRad = (deg: number) => (deg * Math.PI) / 180
  // 0 → left (180°), max → right (0°)
  const mathDeg = (v: number) => 180 - (Math.min(Math.max(v, 0), max) / max) * 180
  const pt = (angleDeg: number, radius: number): [number, number] => [
    cx + radius * Math.cos(toRad(angleDeg)),
    cy - radius * Math.sin(toRad(angleDeg)),
  ]

  // arc path helper — always large=0, sweep=1 for sub-arcs of a semicircle
  const arcD = (fromV: number, toV: number) => {
    const [sx, sy] = pt(mathDeg(fromV), r)
    const [ex, ey] = pt(mathDeg(toV), r)
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`
  }

  const clamp = Math.min(Math.max(value, 0), max)
  const [nx, ny] = pt(mathDeg(clamp), r * 0.72)

  const zoneColor = clamp < 10 ? '#FF5468' : clamp < 20 ? '#8B5CF6' : clamp < 40 ? '#FFB800' : clamp < 80 ? '#00D4FF' : '#00E5A0'

  const zones = [
    { from: 0,  to: 10,  c: '#FF5468' },
    { from: 10, to: 20,  c: '#8B5CF6' },
    { from: 20, to: 40,  c: '#FFB800' },
    { from: 40, to: 80,  c: '#00D4FF' },
    { from: 80, to: 100, c: '#00E5A0' },
  ]

  // milestone labels sit inside the arc so they're never clipped
  const labelR = r - sw / 2 - 16

  return (
    <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Background track */}
      <path d={`M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A ${r} ${r} 0 0 1 ${(cx + r).toFixed(2)} ${cy.toFixed(2)}`}
        fill="none" stroke="#1A2035" strokeWidth={sw} strokeLinecap="round" />
      {/* Faint zone colouring on the track */}
      {zones.map((z) => (
        <path key={z.from} d={arcD(z.from, z.to)} fill="none" stroke={z.c + '28'} strokeWidth={sw} strokeLinecap="butt" />
      ))}
      {/* Progress arc — uses stroke-dasharray on the fixed semicircle so CSS transition works */}
      <path
        d={`M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A ${r} ${r} 0 0 1 ${(cx + r).toFixed(2)} ${cy.toFixed(2)}`}
        fill="none"
        stroke={zoneColor}
        strokeWidth={sw}
        strokeLinecap="round"
        opacity={0.9}
        strokeDasharray={`${(clamp / max) * Math.PI * r} ${Math.PI * r}`}
        style={{ transition: 'stroke-dasharray 700ms cubic-bezier(.25,.8,.25,1), stroke 700ms ease' }}
      />
      {/* Milestone ticks + inside labels */}
      {milestones.map((m) => {
        const deg = mathDeg(m)
        const [t1x, t1y] = pt(deg, r + sw / 2 + 1)
        const [t2x, t2y] = pt(deg, r - sw / 2 - 1)
        const [lx, ly] = pt(deg, labelR)
        const passed = m <= clamp
        return (
          <g key={m}>
            <line x1={t1x.toFixed(1)} y1={t1y.toFixed(1)} x2={t2x.toFixed(1)} y2={t2y.toFixed(1)}
              stroke={passed ? '#ffffff55' : '#2A3350'} strokeWidth="1.5" />
            <text x={lx.toFixed(1)} y={(ly + 3.5).toFixed(1)} fill={passed ? '#5A6685' : '#2A3350'}
              fontSize="9" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">{m}</text>
          </g>
        )
      })}
      {/* Needle — rotates around center; 0 → left (180°), max → right (0°) */}
      <g
        transform={`rotate(${(clamp / max) * 180} ${cx.toFixed(1)} ${cy.toFixed(1)})`}
        style={{ transition: 'transform 700ms cubic-bezier(.25,.8,.25,1)' }}
      >
        <line
          x1={cx.toFixed(1)} y1={cy.toFixed(1)}
          x2={(cx - r * 0.72).toFixed(1)} y2={cy.toFixed(1)}
          stroke="#D8DEEF" strokeWidth="2" strokeLinecap="round"
        />
      </g>
      {/* Hub */}
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="6" fill={zoneColor} style={{ transition: 'fill 700ms ease' }} />
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="2.5" fill="#0A0E1A" />
      {/* Value */}
      <text x={cx} y={cy + 24} fill="#D8DEEF" fontSize="26" fontWeight="600" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">{value}</text>
      <text x={cx} y={cy + 40} fill="#5A6685" fontSize="10" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">active clients</text>
    </svg>
  )
}

// --- ArrGrowthChart ---
interface ArrPoint {
  date: string
  arr: number
  clientNames?: string[]
}

interface ArrGrowthChartProps {
  actual: ArrPoint[]
  projected: ArrPoint[]
  width?: number
  height?: number
  formatter?: (v: number) => string
}

// Monotone cubic interpolation (Fritsch-Carlson) — no overshoot on step-like ARR data
function monotoneCubic(pts: [number, number][]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  if (n === 2) return `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} L ${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}`

  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0])
  const delta = dx.map((d, i) => d === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / d)

  const m: number[] = new Array(n).fill(0)
  m[0] = delta[0]
  m[n - 1] = delta[n - 2]
  for (let i = 1; i < n - 1; i++) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2
  }
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const s = Math.sqrt((m[i] / delta[i]) ** 2 + (m[i + 1] / delta[i]) ** 2)
    if (s > 3) { const t = 3 / s; m[i] *= t; m[i + 1] *= t }
  }

  const d: string[] = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`]
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]
    d.push(`C ${(pts[i][0] + h / 3).toFixed(1)} ${(pts[i][1] + m[i] * h / 3).toFixed(1)},${(pts[i + 1][0] - h / 3).toFixed(1)} ${(pts[i + 1][1] - m[i + 1] * h / 3).toFixed(1)},${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`)
  }
  return d.join(' ')
}

export function ArrGrowthChart({ actual, projected, width = 600, height = 160, formatter = String }: ArrGrowthChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (actual.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3A4460', fontSize: 12 }}>
        No client data yet
      </div>
    )
  }

  const pad = { l: 46, r: 14, t: 18, b: 26 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b

  const allPoints = [...actual, ...projected]
  const minMs = new Date(allPoints[0].date + 'T00:00').getTime()
  const maxMs = new Date(allPoints[allPoints.length - 1].date + 'T00:00').getTime()
  const msRange = maxMs - minMs || 1
  const maxArr = Math.max(...allPoints.map((p) => p.arr), 1)
  const niceMax = Math.ceil(maxArr / 1000) * 1000 || 1000

  const toXY = (date: string, arr: number): [number, number] => {
    const t = new Date(date + 'T00:00').getTime()
    return [pad.l + ((t - minMs) / msRange) * w, pad.t + h - (arr / niceMax) * h]
  }

  const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
  const todayX = pad.l + ((todayMs - minMs) / msRange) * w

  const actualPts = actual.map((p) => toXY(p.date, p.arr))
  const projPts   = projected.map((p) => toXY(p.date, p.arr))
  const connectedProjPts: [number, number][] = [actualPts[actualPts.length - 1], ...projPts]

  const actualPath = monotoneCubic(actualPts)
  const projPath   = monotoneCubic(connectedProjPts)

  const last = actualPts[actualPts.length - 1]
  const first = actualPts[0]
  const fillPath = `${actualPath} L ${last[0].toFixed(1)} ${(pad.t + h).toFixed(1)} L ${first[0].toFixed(1)} ${(pad.t + h).toFixed(1)} Z`

  const ticks = [0, niceMax / 2, niceMax]

  // Month labels along x-axis
  const startD = new Date(allPoints[0].date + 'T00:00')
  const endD   = new Date(allPoints[allPoints.length - 1].date + 'T00:00')
  const monthLabels: { x: number; label: string }[] = []
  const cur = new Date(startD.getFullYear(), startD.getMonth(), 1)
  while (cur <= endD) {
    const x = pad.l + ((cur.getTime() - minMs) / msRange) * w
    if (x >= pad.l && x <= pad.l + w)
      monthLabels.push({ x, label: cur.toLocaleDateString('en-US', { month: 'short' }) })
    cur.setMonth(cur.getMonth() + 1)
  }

  const gid = 'arr-area-grad'

  const hoveredClients = hovered !== null ? (actual[hovered].clientNames ?? []) : []

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block', maxWidth: '100%' }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#00E5A0" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#00E5A0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => {
          const y = pad.t + h - (t / niceMax) * h
          return (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + w} y1={y} y2={y} stroke="#1E2538" strokeDasharray="2 4" />
              <text x={pad.l - 6} y={y + 3.5} fill="#5A6685" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono, monospace">{formatter(t)}</text>
            </g>
          )
        })}

        {monthLabels.map((m, i) => (
          <text key={i} x={m.x} y={height - 4} fill="#5A6685" fontSize="9" textAnchor="middle">{m.label}</text>
        ))}

        {todayX >= pad.l && todayX <= pad.l + w && (
          <>
            <line x1={todayX.toFixed(1)} x2={todayX.toFixed(1)} y1={pad.t} y2={pad.t + h} stroke="#2A3350" strokeDasharray="2 3" strokeWidth="1.5" />
            <text x={todayX.toFixed(1)} y={pad.t - 4} fill="#3A4460" fontSize="8" textAnchor="middle">today</text>
          </>
        )}

        <path d={fillPath} fill={`url(#${gid})`} />
        <path d={actualPath} fill="none" stroke="#00E5A0" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        <path d={projPath}   fill="none" stroke="#00E5A0" strokeWidth="1.5"  strokeDasharray="5 4" strokeOpacity="0.35" strokeLinejoin="round" strokeLinecap="round" />

        {actualPts.map((p, i) => {
          const hasClients = (actual[i].clientNames?.length ?? 0) > 0
          return (
            <g
              key={i}
              onMouseEnter={() => hasClients && setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: hasClients ? 'pointer' : 'default' }}
            >
              <circle cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="14" fill="transparent" />
              <circle
                cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="3"
                fill="#0A0E1A"
                stroke={hovered === i ? '#ffffff' : '#00E5A0'}
                strokeWidth="1.75"
              />
            </g>
          )
        })}
      </svg>

      {hovered !== null && hoveredClients.length > 0 && (() => {
        const p = actualPts[hovered]
        const leftPct = (p[0] / width) * 100
        const topPct  = (p[1] / height) * 100
        const flipX = leftPct > 68
        const flipY = topPct < 28
        return (
          <div style={{
            position: 'absolute',
            left: `${leftPct}%`,
            top:  `${topPct}%`,
            transform: `translate(${flipX ? 'calc(-100% - 8px)' : '10px'}, ${flipY ? '6px' : 'calc(-100% - 8px)'})`,
            pointerEvents: 'none',
            zIndex: 20,
            background: '#0C1220',
            border: '1px solid #1E2D45',
            borderRadius: 6,
            padding: '7px 10px',
            minWidth: 120,
            maxWidth: 220,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 10, color: '#00E5A0', fontFamily: 'JetBrains Mono, monospace', marginBottom: 5, letterSpacing: '0.4px' }}>
              {new Date(actual[hovered].date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            {hoveredClients.map((name, i) => (
              <div key={i} style={{ fontSize: 11, color: '#D8DEEF', lineHeight: '1.6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// --- FunnelBar ---
interface FunnelStage {
  label: string
  value: number
  color: string
}

interface FunnelBarProps {
  stages: FunnelStage[]
}

export function FunnelBar({ stages }: FunnelBarProps) {
  const max = Math.max(...stages.map((s) => s.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', minHeight: 180 }}>
      {stages.map((s, i) => {
        const w = (s.value / max) * 100
        const prevVal = i > 0 ? stages[i - 1].value : null
        const conv = prevVal != null && prevVal > 0 ? Math.round((s.value / prevVal) * 100) : null
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 64px', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#8B95B2' }}>{s.label}</div>
            <div style={{ position: 'relative', height: 24, background: '#0F1422', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: w + '%', background: `linear-gradient(90deg, ${s.color}, ${s.color}99)`, borderRadius: 6 }} />
              <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: '#0A0E1A' }}>
                {s.value.toLocaleString()}
              </div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: conv != null ? '#5A6685' : 'transparent', textAlign: 'right' }}>
              {conv != null ? conv + '%' : '↑'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
