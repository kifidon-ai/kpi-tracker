'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

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
            <line x1={pad.l} x2={pad.l + w} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
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
  const ticks = Array.from({ length: 5 }, (_, i) => (niceMax * i) / 4)
  const bw = (w / data.length) * 0.55
  const gap = (w / data.length) * 0.45

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', maxWidth: '100%' }}>
      {ticks.map((t, i) => {
        const y = pad.t + h - (t / niceMax) * h
        return (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + w} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
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
  const ratio = target ? value / target : value
  const dash = C * Math.min(ratio, 1)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)' }}
      />
      <text x={size / 2} y={size / 2 - 2} fontSize={size * 0.22} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" style={{ fill: 'var(--ink)' }}>
        {Math.round(ratio * 100)}%
      </text>
      {label && (
        <text x={size / 2} y={size / 2 + size * 0.16} fontSize="10" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" style={{ fill: 'var(--ink-2)' }}>{label}</text>
      )}
    </svg>
  )
}

// --- Speedometer ---
interface SpeedometerProps {
  value: number
  milestones?: number[]
  max?: number
  size?: number
  formatter?: (v: number) => string
  minorStep?: number
  pill?: ReactNode
  valueFontSize?: number
  startAngle?: number
  sweepAngle?: number
  radiusRatio?: number
  showValue?: boolean
  pillOffsetY?: number
  showMinorLabels?: boolean
  zoneColors?: string[]
  valueOffsetY?: number
  highlightedTicks?: number[]
}

const ZONE_COLORS = ['#FF5468', '#FF8C00', '#FFB800', '#00D4FF', '#00E5A0', '#8B5CF6', '#E879F9', '#FCD34D']

export function Speedometer({ value, milestones = [10, 20, 40, 80, 100], max = 100, size = 200, formatter = String, minorStep, pill, valueFontSize = 52, startAngle = 180, sweepAngle = 180, radiusRatio = 0.27, showValue = true, pillOffsetY = 0, showMinorLabels = false, zoneColors = ZONE_COLORS, valueOffsetY = 0, highlightedTicks = [] }: SpeedometerProps) {
  const backgroundGradientId = useId()
  const cx = size / 2
  const cy = size / 2
  const r = size * radiusRatio
  const sw = 10
  const startDeg = startAngle
  const sweepDeg = sweepAngle

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const mathDeg = (v: number) => startDeg - (Math.min(Math.max(v, 0), max) / max) * sweepDeg
  const pt = (angleDeg: number, radius: number): [number, number] => [
    cx + radius * Math.cos(toRad(angleDeg)),
    cy - radius * Math.sin(toRad(angleDeg)),
  ]
  const arcD = (fromV: number, toV: number) => {
    const [sx, sy] = pt(mathDeg(fromV), r)
    const [ex, ey] = pt(mathDeg(toV), r)
    const arcSweep = ((toV - fromV) / max) * sweepDeg
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${Math.abs(arcSweep) > 180 ? 1 : 0} ${arcSweep >= 0 ? 1 : 0} ${ex.toFixed(2)} ${ey.toFixed(2)}`
  }

  const clamp = Math.min(Math.max(value, 0), max)

  // Auto-derive zones from milestones with fixed color sequence
  const zones = milestones.map((to, i) => ({
    from: i === 0 ? 0 : milestones[i - 1],
    to,
    c: zoneColors[Math.min(i, zoneColors.length - 1)],
  }))

  const zoneColor = zones.find((z) => clamp < z.to)?.c ?? zones[zones.length - 1].c

  // Minor ticks at minorStep intervals, plus milestone major ticks
  const resolvedMinorStep = minorStep ?? max / 20
  const minorCount = Math.floor(max / resolvedMinorStep)
  const allTickValues = [
    ...Array.from({ length: minorCount + 1 }, (_, i) => i * resolvedMinorStep),
    ...milestones,
  ].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).sort((a, b) => a - b)

  const bezelR = size / 2 - 4
  const trackStart = pt(mathDeg(0), r)
  const trackEnd = pt(mathDeg(max), r)
  const isSemicircle = startDeg === 180 && Math.abs(sweepDeg) === 180
  const viewHeight = isSemicircle ? cy + 24 : size
  const valueY = (isSemicircle ? cy - r * 0.68 : cy - r * 0.48) + valueOffsetY
  const pillY = (isSemicircle ? cy - r * 0.25 : cy + r * 0.48) + pillOffsetY

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${viewHeight}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={backgroundGradientId} x1="0" x2="0" y1="1" y2="0">
          <stop offset="0%" stopColor="var(--bg-1)" />
          <stop offset="100%" stopColor="var(--panel-2)" />
        </linearGradient>
      </defs>
      {/* Dial bezel */}
      {isSemicircle ? (
        <path
          d={`M ${(cx - bezelR).toFixed(1)} ${cy.toFixed(1)} A ${bezelR.toFixed(1)} ${bezelR.toFixed(1)} 0 0 1 ${(cx + bezelR).toFixed(1)} ${cy.toFixed(1)} L ${(cx - bezelR).toFixed(1)} ${cy.toFixed(1)} Z`}
          fill={`url(#${backgroundGradientId})`}
          stroke="var(--line)"
          strokeWidth="2"
        />
      ) : (
        <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={bezelR.toFixed(1)} fill={`url(#${backgroundGradientId})`} stroke="var(--line)" strokeWidth="2" />
      )}
      {/* Background track */}
      <path d={`M ${trackStart[0].toFixed(2)} ${trackStart[1].toFixed(2)} A ${r} ${r} 0 ${Math.abs(sweepDeg) > 180 ? 1 : 0} ${sweepDeg >= 0 ? 1 : 0} ${trackEnd[0].toFixed(2)} ${trackEnd[1].toFixed(2)}`}
        fill="none" stroke="var(--line)" strokeWidth={sw} strokeLinecap="butt" />
      {/* Zone colour bands */}
      {zones.map((z) => (
        <path key={z.from} d={arcD(z.from, z.to)} fill="none" stroke={z.c + '55'} strokeWidth={sw} strokeLinecap="butt" />
      ))}
      {/* Progress arc */}
      {zones.map((z) => {
        const totalLen = ((z.to - z.from) / max) * Math.abs(toRad(sweepDeg)) * r
        const filledLen = clamp <= z.from ? 0 : clamp >= z.to ? totalLen : ((clamp - z.from) / max) * Math.abs(toRad(sweepDeg)) * r
        return (
          <path
            key={z.from}
            d={arcD(z.from, z.to)}
            fill="none"
            stroke={z.c}
            strokeWidth={sw}
            strokeLinecap="butt"
            opacity={0.9}
            strokeDasharray={`${filledLen.toFixed(2)} ${(totalLen + 1).toFixed(2)}`}
            style={{ transition: 'stroke-dasharray 700ms cubic-bezier(.25,.8,.25,1)' }}
          />
        )
      })}
      {/* Tip circle */}
      {clamp > 0 && (
        <g
          transform={`rotate(${180 - startDeg + (clamp / max) * sweepDeg}, ${cx}, ${cy})`}
          style={{ transition: 'transform 700ms cubic-bezier(.25,.8,.25,1)' }}
        >
          <circle cx={cx - r} cy={cy} r={sw / 2} fill={zoneColor} opacity={0.9} style={{ transition: 'fill 700ms ease' }} />
        </g>
      )}
      {/* Ticks — major at milestones, minor in between */}
      {allTickValues.map((m) => {
        const isHighlighted = highlightedTicks.includes(m)
        const isMajor = milestones.includes(m) && !isHighlighted
        const zoneC = zones.find((z) => z.from === m)?.c ?? zones[zones.length - 1].c
        const deg = mathDeg(m)
        const tickLen = isMajor ? 16 : isHighlighted ? 10 : 5
        const [t1x, t1y] = pt(deg, r + sw / 2 + 2)
        const [t2x, t2y] = pt(deg, r + sw / 2 + 2 + tickLen)
        const [lx, ly] = pt(deg, r + sw / 2 + 2 + tickLen + 14)
        return (
          <g key={m}>
            <line x1={t1x.toFixed(1)} y1={t1y.toFixed(1)} x2={t2x.toFixed(1)} y2={t2y.toFixed(1)}
              stroke={isMajor ? zoneC : isHighlighted ? 'var(--ink)' : 'var(--ink-2)'}
              strokeWidth={isMajor ? 3 : isHighlighted ? 2 : 1.5} />
            {(isMajor || isHighlighted || showMinorLabels) && (
              <text x={lx.toFixed(1)} y={(ly + 4).toFixed(1)}
                fill={isMajor ? zoneC : isHighlighted ? 'var(--ink)' : 'var(--ink-2)'}
                fontSize={isMajor ? 14 : isHighlighted ? 10 : 8}
                fontWeight={isMajor || isHighlighted ? 800 : 600}
                textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">{formatter(m)}</text>
            )}
          </g>
        )
      })}
      {/* Center value */}
      {showValue && (
        <text x={cx} y={valueY} fill="var(--ink)" fontSize={valueFontSize} fontWeight="700" textAnchor="middle" dominantBaseline="middle" fontFamily="Inter, system-ui, sans-serif">{formatter(value)}</text>
      )}
      {/* Needle */}
      <g
        transform={`rotate(${180 - startDeg + (clamp / max) * sweepDeg} ${cx.toFixed(1)} ${cy.toFixed(1)})`}
        style={{ transition: 'transform 700ms cubic-bezier(.25,.8,.25,1)' }}
      >
        <polygon
          points={[
            `${(cx - r * 0.84).toFixed(1)},${cy.toFixed(1)}`,
            `${(cx - r * 0.18).toFixed(1)},${(cy - 3).toFixed(1)}`,
            `${(cx - r * 0.04).toFixed(1)},${(cy - 6).toFixed(1)}`,
            `${(cx + r * 0.11).toFixed(1)},${(cy - 2.5).toFixed(1)}`,
            `${(cx + r * 0.14).toFixed(1)},${cy.toFixed(1)}`,
            `${(cx + r * 0.11).toFixed(1)},${(cy + 2.5).toFixed(1)}`,
            `${(cx - r * 0.04).toFixed(1)},${(cy + 6).toFixed(1)}`,
            `${(cx - r * 0.18).toFixed(1)},${(cy + 3).toFixed(1)}`,
          ].join(' ')}
          fill="var(--ink)"
        />
        <circle cx={(cx - r * 0.68).toFixed(1)} cy={cy.toFixed(1)} r="3" fill={zoneColor} opacity="0.9" />
      </g>
      {/* Hub */}
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="6" fill={zoneColor} style={{ transition: 'fill 700ms ease' }} />
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="2.5" fill="var(--bg-1)" />
      {pill && (
        <foreignObject x="0" y={pillY} width={size} height="32">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {pill}
          </div>
        </foreignObject>
      )}
    </svg>
  )
}

// --- ArrGrowthChart ---
interface ArrPoint {
  date: string
  arr: number
  clientNames?: string[]
  clientArrs?: { name: string; arr: number }[]
}

interface ArrGrowthChartProps {
  actual: ArrPoint[]
  projected: ArrPoint[]
  width?: number
  height?: number
  formatter?: (v: number) => string
}

// Monotone cubic interpolation (Fritsch-Carlson) — softened slopes for a calmer growth line
function monotoneCubic(pts: [number, number][], tension = 0.55): string {
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
    if (s > 2) { const t = 2 / s; m[i] *= t; m[i + 1] *= t }
  }
  // Dial back tangent strength so steps don't look so sharp
  for (let i = 0; i < n; i++) m[i] *= tension

  const d: string[] = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`]
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]
    d.push(`C ${(pts[i][0] + h / 3).toFixed(1)} ${(pts[i][1] + m[i] * h / 3).toFixed(1)},${(pts[i + 1][0] - h / 3).toFixed(1)} ${(pts[i + 1][1] - m[i + 1] * h / 3).toFixed(1)},${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`)
  }
  return d.join(' ')
}

export function ArrGrowthChart({ actual, projected, width: initialWidth = 600, height: initialHeight = 160, formatter = String }: ArrGrowthChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: initialWidth, height: initialHeight })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(1, Math.round(entry.contentRect.width))
      const nextHeight = Math.max(initialHeight, Math.round(entry.contentRect.height))
      setDimensions((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      )
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [initialHeight])

  const { width, height } = dimensions

  if (actual.length === 0) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: initialHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3A4460', fontSize: 12 }}>
        No client data yet
      </div>
    )
  }

  const pad = { l: 46, r: 16, t: 18, b: 34 }
  const w = Math.max(1, width - pad.l - pad.r)
  const h = Math.max(1, height - pad.t - pad.b)

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
  const axisY = pad.t + h

  // X-axis labels — monthly when the span is long, otherwise spaced date ticks
  const startD = new Date(allPoints[0].date + 'T00:00')
  const endD   = new Date(allPoints[allPoints.length - 1].date + 'T00:00')
  const spanDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86400000))
  const xLabels: { x: number; label: string }[] = []

  if (spanDays >= 60) {
    const cur = new Date(startD.getFullYear(), startD.getMonth(), 1)
    if (cur < startD) cur.setMonth(cur.getMonth() + 1)
    while (cur <= endD) {
      const x = pad.l + ((cur.getTime() - minMs) / msRange) * w
      if (x >= pad.l && x <= pad.l + w) {
        xLabels.push({ x, label: cur.toLocaleDateString('en-US', { month: 'short' }) })
      }
      cur.setMonth(cur.getMonth() + 1)
    }
  } else {
    const tickCount = Math.min(5, Math.max(2, Math.ceil(spanDays / 7) + 1))
    for (let i = 0; i < tickCount; i++) {
      const t = startD.getTime() + ((endD.getTime() - startD.getTime()) * i) / Math.max(1, tickCount - 1)
      const d = new Date(t)
      const x = pad.l + ((d.getTime() - minMs) / msRange) * w
      xLabels.push({
        x,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })
    }
  }

  // Always show start/end if we somehow got no labels
  if (xLabels.length === 0) {
    xLabels.push(
      { x: pad.l, label: startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
      { x: pad.l + w, label: endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
    )
  }

  const gid = 'arr-area-grad'

  const hoveredClients = hovered !== null ? (actual[hovered].clientNames ?? []) : []

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: initialHeight }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
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
              <line x1={pad.l} x2={pad.l + w} y1={y} y2={y} stroke="#2D3852" strokeWidth="1" strokeDasharray="3 4" />
              <text x={pad.l - 7} y={y + 4} fill="#A7B1C9" fontSize="10" fontWeight="600" textAnchor="end" fontFamily="JetBrains Mono, monospace">{formatter(t)}</text>
            </g>
          )
        })}

        <line x1={pad.l} x2={pad.l + w} y1={axisY} y2={axisY} stroke="#3A4661" strokeWidth="1" />
        {xLabels.map((m, i) => (
          <g key={i}>
            <line x1={m.x.toFixed(1)} x2={m.x.toFixed(1)} y1={pad.t} y2={axisY} stroke="#252F47" strokeWidth="1" strokeDasharray="3 5" />
            <line x1={m.x.toFixed(1)} x2={m.x.toFixed(1)} y1={axisY} y2={axisY + 4} stroke="#5A6685" strokeWidth="1" />
            <text x={m.x.toFixed(1)} y={height - 8} fill="#A7B1C9" fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="JetBrains Mono, monospace">{m.label}</text>
          </g>
        ))}

        {todayX >= pad.l && todayX <= pad.l + w && (
          <>
            <line x1={todayX.toFixed(1)} x2={todayX.toFixed(1)} y1={pad.t} y2={axisY} stroke="#2A3350" strokeDasharray="2 3" strokeWidth="1.5" />
            <text x={todayX.toFixed(1)} y={pad.t - 4} fill="#7C88A5" fontSize="9" textAnchor="middle">today</text>
          </>
        )}

        <path d={fillPath} fill={`url(#${gid})`} />
        <path d={actualPath} fill="none" stroke="#00E5A0" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        <path d={projPath}   fill="none" stroke="#00E5A0" strokeWidth="1.5"  strokeDasharray="5 4" strokeOpacity="0.35" strokeLinejoin="round" strokeLinecap="round" />

        {actualPts.map((p, i) => {
          const hasClients = (actual[i].clientNames?.length ?? 0) > 0
          if (!hasClients) return null
          return (
            <g
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
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
        const clientArrs = actual[hovered].clientArrs ?? []
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
            padding: '8px 10px',
            minWidth: 160,
            maxWidth: 280,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 10, color: '#00E5A0', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4, letterSpacing: '0.4px' }}>
              {new Date(actual[hovered].date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 10, color: '#5A6685', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #1E2D45' }}>
              Total ARR: {formatter(Math.round(actual[hovered].arr))}
            </div>
            {clientArrs.length > 0 ? (
              <>
                <div style={{ fontSize: 9, color: '#3A4460', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4, letterSpacing: '0.3px' }}>
                  MRR changes
                </div>
                {clientArrs.map((client, i) => (
                <div key={i} style={{ fontSize: 11, color: '#D8DEEF', lineHeight: '1.5', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</span>
                  <span style={{
                    color: client.arr < 0 ? '#FF5468' : '#00E5A0',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}>
                    {client.arr > 0 ? '+' : ''}{formatter(Math.round(client.arr))}
                  </span>
                </div>
                ))}
              </>
            ) : (
              hoveredClients.map((name, i) => (
                <div key={i} style={{ fontSize: 11, color: '#D8DEEF', lineHeight: '1.5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </div>
              ))
            )}
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
            <div style={{ position: 'relative', height: 24, background: 'var(--bg-2)', borderRadius: 6, overflow: 'hidden' }}>
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
