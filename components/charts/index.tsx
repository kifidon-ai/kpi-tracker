'use client'

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
      <text x={size / 2} y={size / 2 - 2} fill="#fff" fontSize={size * 0.22} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="700">
        {Math.round(ratio * 100)}%
      </text>
      {label && (
        <text x={size / 2} y={size / 2 + size * 0.16} fill="#8B95B2" fontSize="10" textAnchor="middle">{label}</text>
      )}
    </svg>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
