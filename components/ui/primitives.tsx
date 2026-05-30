'use client'

import { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import { pct } from '@/lib/helpers'

// --- Card ---
interface CardProps {
  children: ReactNode
  style?: CSSProperties
  padding?: number
  className?: string
}

export function Card({ children, style, padding = 20, className }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'linear-gradient(180deg, var(--card-top), var(--card-bottom))',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// --- Segmented control ---
interface SegmentedOption {
  value: string
  label: string
}
interface SegmentedProps {
  value: string
  onChange: (v: string) => void
  options: SegmentedOption[]
}

export function Segmented({ value, onChange, options }: SegmentedProps) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: active ? 'var(--accent-text)' : 'var(--ink-2)',
              background: active ? '#00D4FF' : 'transparent',
              borderRadius: 7,
              transition: 'all 150ms',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// --- Pill ---
interface PillProps {
  children: ReactNode
  color?: string
  subtle?: boolean
}

export function Pill({ children, color = '#00D4FF', subtle = true }: PillProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 99,
        background: subtle ? color + '22' : color,
        color: subtle ? color : 'var(--accent-text)',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'JetBrains Mono, monospace',
        border: subtle ? `1px solid ${color}44` : 'none',
      }}
    >
      {children}
    </span>
  )
}

// --- Delta ---
interface DeltaProps {
  value: number | null | undefined
  suffix?: string
}

export function Delta({ value, suffix = '%' }: DeltaProps) {
  if (value == null || isNaN(value)) return <span style={{ color: 'var(--ink-3)' }}>—</span>
  const up = value >= 0
  const c = up ? '#00E5A0' : '#FF5468'
  return (
    <span style={{ color: c, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Icon name={up ? 'arrow-up' : 'arrow-down'} size={12} color={c} />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  )
}

// --- KPI ---
interface KPIProps {
  label: string
  value: number
  delta?: number | null
  color?: string
  target?: number
  formatter?: (v: number) => string
  sub?: string
}

export function KPI({ label, value, delta, color = '#00D4FF', target, formatter = String, sub }: KPIProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', letterSpacing: -0.5 }}>{formatter(value)}</div>
        {delta != null && <Delta value={delta} />}
      </div>
      {target != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
          <TargetBar value={value} target={target} color={color} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace' }}>
            <span>{Math.round(pct(value, target))}% of target</span>
            <span>goal {formatter(target)}</span>
          </div>
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{sub}</div>}
    </div>
  )
}

// --- SectionTitle ---
interface SectionTitleProps {
  children: ReactNode
  right?: ReactNode
}

export function SectionTitle({ children, right }: SectionTitleProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', letterSpacing: 0.2 }}>{children}</div>
      {right}
    </div>
  )
}

// --- TargetBar ---
interface TargetBarProps {
  value: number
  target: number
  color?: string
  height?: number
}

export function TargetBar({ value, target, color = '#00D4FF', height = 6 }: TargetBarProps) {
  const r = Math.min(1, target ? value / target : 0)
  return (
    <div style={{ position: 'relative', height, background: 'var(--line)', borderRadius: height / 2, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: r * 100 + '%',
          background: color,
          borderRadius: height / 2,
          transition: 'width 500ms ease',
        }}
      />
    </div>
  )
}
