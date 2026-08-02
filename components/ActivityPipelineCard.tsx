'use client'

import type { ALL_METRICS } from '@/lib/constants'
import { Ring } from './charts'

interface PipelineMetric {
  key: string
  label: string
  short: string
  value: number
  color: string
  target: number
}

interface ActivityPipelineCardProps {
  title: string
  metrics: PipelineMetric[]
  showConversionRates?: boolean
}

export function ActivityPipelineCard({ title, metrics, showConversionRates = true }: ActivityPipelineCardProps) {
  return (
    <>
      {/* Top: Activity pipeline with inline targets */}
      <div className="flex items-start pt-1">
        {metrics.map((m, i) => (
          <div key={m.key} className={`flex items-center ${i < metrics.length - 1 ? 'flex-1' : 'flex-none'}`}>
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.8px]" style={{ color: m.color }}>
                {m.short}
              </div>
              <div className="mono text-[36px] font-extrabold text-ink leading-none">
                {m.value}
                <span className="text-ink-3 text-[18px]">
                  {' / '}
                  {m.target % 1 === 0 ? m.target : m.target.toFixed(1)}
                </span>
              </div>
              <div className="w-9 h-[3px] rounded-sm opacity-70" style={{ background: m.color }} />
            </div>
            {showConversionRates && i < metrics.length - 1 && (() => {
              const rate = m.value ? (metrics[i + 1].value / m.value * 100) : 0
              return (
                <div className="flex-1 flex flex-col items-center gap-1 px-1.5 min-w-12">
                  <div className={`mono text-[11px] font-bold ${rate > 0 ? 'text-ink-2' : 'text-ink-3'}`}>
                    {rate.toFixed(0)}%
                  </div>
                  <div className="flex items-center w-full">
                    <div className="flex-1 h-px bg-muted" />
                    <span className="text-muted text-[10px] leading-none">▶</span>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      {/* Bottom: Circle/ring targets */}
      <div className="mt-6 pt-5 border-t border-line">
        <div className="text-[10px] font-semibold uppercase tracking-[1px] text-ink-3 mb-3">
          {title}
        </div>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}
        >
          {metrics.map((m) => {
            const progress = m.target > 0 ? Math.min((m.value / m.target) * 100, 100) : 0
            const r = 32
            const circ = 2 * Math.PI * r
            const dashOffset = circ * (1 - progress / 100)

            return (
              <div key={m.key} className="flex flex-col items-center gap-2.5 py-1 min-w-0">
                <div className="relative w-[72px] h-[72px]">
                  <svg width="72" height="72" viewBox="0 0 80 80" className="-rotate-90" style={{ display: 'block' }}>
                    <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r={r} fill="none"
                      stroke={m.color} strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={circ}
                      strokeDashoffset={dashOffset}
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="mono text-[12px] font-bold text-ink leading-none">{Math.round(progress)}%</span>
                  </div>
                </div>
                <div className="text-[9px] uppercase tracking-[0.5px] font-bold text-center leading-tight" style={{ color: m.color }}>
                  {m.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
