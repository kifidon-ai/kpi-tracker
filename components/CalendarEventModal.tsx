'use client'

import { useState, useRef, useEffect } from 'react'
import type { Rep, CalendarIntent } from '@/lib/types'
import { getTodayKeyET } from '@/lib/helpers'

type MeetingType = 'disc' | 'demo' | 'onb'

interface CalendarEventModalProps {
  rep: Rep
  activityType: MeetingType
  companies: string[]
  defaultDate?: string
  onSave: (data: {
    companyName: string
    scheduledDate: string
    intent: CalendarIntent
    monthlyPrice?: number
  }) => void
  onCancel: () => void
}

const INTENT_OPTIONS: { value: CalendarIntent; label: string; color: string }[] = [
  { value: 'high',   label: 'High',   color: '#00E5A0' },
  { value: 'medium', label: 'Medium', color: '#FFD700' },
  { value: 'low',    label: 'Low',    color: '#FF5468' },
]

const TYPE_META: Record<MeetingType, { label: string; color: string }> = {
  disc: { label: 'Discovery booked',  color: '#FFD700' },
  demo: { label: 'Demo booked',       color: '#00E5A0' },
  onb:  { label: 'Onboarding booked', color: '#3DD6C3' },
}

export function CalendarEventModal({ rep, activityType, companies, defaultDate, onSave, onCancel }: CalendarEventModalProps) {
  const today = getTodayKeyET()
  const [companyName, setCompanyName]     = useState('')
  const [scheduledDate, setScheduledDate] = useState(defaultDate ?? today)
  const [intent, setIntent]               = useState<CalendarIntent>('medium')
  const [monthlyPrice, setMonthlyPrice]   = useState('')
  const [showDropdown, setShowDropdown]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = companies.filter((c) =>
    c.toLowerCase().includes(companyName.toLowerCase()) && c.toLowerCase() !== companyName.toLowerCase()
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isOnboarding = activityType === 'onb'
  const price = parseFloat(monthlyPrice) || 0
  const canSubmit =
    companyName.trim().length > 0 &&
    scheduledDate.length > 0 &&
    (!isOnboarding || price > 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSave({
      companyName: companyName.trim(),
      scheduledDate,
      intent,
      ...(isOnboarding ? { monthlyPrice: price } : {}),
    })
  }

  const { label: typeLabel, color: accentColor } = TYPE_META[activityType]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-line-2 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(180deg, var(--card-top), var(--card-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
            <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">{typeLabel}</div>
          </div>
          <div className="text-[20px] font-bold leading-tight">Book meeting</div>
          <div className="text-[13px] text-ink-2 mt-0.5">logged by {rep.name}</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Company name combobox */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Company</label>
            <input
              ref={inputRef}
              type="text"
              value={companyName}
              onChange={(e) => { setCompanyName(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Acme Corp"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg text-[14px] font-medium text-ink outline-none transition-all placeholder:text-ink-3"
              style={{ background: 'var(--input-bg)', border: `1px solid ${accentColor}66` }}
            />
            {showDropdown && filtered.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-line-2 overflow-hidden z-10 shadow-xl"
                style={{ background: 'var(--card-bottom)' }}
              >
                {filtered.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-full text-left px-3.5 py-2 text-[13px] font-medium text-ink hover:bg-line transition-colors"
                    onMouseDown={() => { setCompanyName(c); setShowDropdown(false) }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date (+ monthly price for onboarding) */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Scheduled date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mono w-full px-3.5 py-2.5 rounded-lg text-[14px] font-medium text-ink outline-none transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accentColor + '66')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
              />
            </div>
            {isOnboarding && (
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Monthly price</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 text-[14px] font-semibold">$</span>
                  <input
                    type="number"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="399"
                    min="0"
                    step="1"
                    className="mono w-full pl-7 pr-3.5 py-2.5 rounded-lg text-[14px] font-semibold text-ink outline-none transition-all placeholder:text-ink-3"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = accentColor + '66')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Intent */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">User intent</label>
            <div className="flex gap-2">
              {INTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIntent(opt.value)}
                  className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-all"
                  style={{
                    background: intent === opt.value ? opt.color + '22' : 'var(--bg-2)',
                    border: `1px solid ${intent === opt.value ? opt.color : 'var(--line)'}`,
                    color: intent === opt.value ? opt.color : 'var(--ink-2)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink-1"
              style={{ background: '#1A2035', border: '1px solid #262E45' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-opacity disabled:opacity-30"
              style={{ background: accentColor, color: '#0A0E1A' }}
            >
              Book it
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
