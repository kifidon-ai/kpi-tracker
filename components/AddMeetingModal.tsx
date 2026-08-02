'use client'

import { useState, useRef, useEffect } from 'react'
import type { CalendarIntent } from '@/lib/types'

type MeetingType = 'disc' | 'demo' | 'onb'

interface AddMeetingModalProps {
  companies: string[]
  onSave: (data: {
    companyName: string
    activityType: MeetingType
    scheduledDate: string
    intent: CalendarIntent
    status: string
    monthlyPrice?: number
  }) => void
  onCancel: () => void
}

const INTENT_OPTIONS: { value: CalendarIntent; label: string; color: string }[] = [
  { value: 'high',   label: 'High',   color: '#00E5A0' },
  { value: 'medium', label: 'Medium', color: '#FFD700' },
  { value: 'low',    label: 'Low',    color: '#FF5468' },
]

const STATUS_OPTIONS = [
  { value: 'scheduled',  label: 'Scheduled',  color: '#7AA7F5' },
  { value: 'attended',   label: 'Attended',   color: '#00E5A0' },
  { value: 'no_show',    label: 'No show',    color: '#FF5468' },
  { value: 'rescheduled',label: 'Rescheduled',color: '#FFD700' },
]

const TYPE_OPTIONS: { value: MeetingType; label: string; color: string }[] = [
  { value: 'disc', label: 'Discovery',  color: '#FFD700' },
  { value: 'demo', label: 'Demo',       color: '#00E5A0' },
  { value: 'onb',  label: 'Onboarding', color: '#3DD6C3' },
]

export function AddMeetingModal({ companies, onSave, onCancel }: AddMeetingModalProps) {
  const getETDate = () => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(new Date())
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    return `${year}-${month}-${day}`
  }
  const [companyName,   setCompanyName]   = useState('')
  const [activityType,  setActivityType]  = useState<MeetingType>('disc')
  const [scheduledDate, setScheduledDate] = useState(getETDate())
  const [intent,        setIntent]        = useState<CalendarIntent>('medium')
  const [status,        setStatus]        = useState('scheduled')
  const [monthlyPrice,  setMonthlyPrice]  = useState('')
  const [showDropdown,  setShowDropdown]  = useState(false)
  const inputRef   = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = companies.filter((c) =>
    c.toLowerCase().includes(companyName.toLowerCase()) && c.toLowerCase() !== companyName.toLowerCase()
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current   && !inputRef.current.contains(e.target as Node)
      ) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const typeColor = TYPE_OPTIONS.find((t) => t.value === activityType)?.color ?? '#FFD700'
  const isOnboarding = activityType === 'onb'
  const price = parseFloat(monthlyPrice) || 0
  const canSubmit = companyName.trim().length > 0 && (!isOnboarding || price > 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSave({
      companyName: companyName.trim(),
      activityType,
      scheduledDate,
      intent,
      status,
      ...(isOnboarding ? { monthlyPrice: price } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-line-2 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(180deg, var(--card-top), var(--card-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ background: typeColor }} />
            <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">Add meeting</div>
          </div>
          <div className="text-[20px] font-bold leading-tight">
            {isOnboarding ? 'Log onboarding' : 'Retroactive entry'}
          </div>
          <div className="text-[13px] text-ink-2 mt-0.5">
            {isOnboarding
              ? 'Select the company and date — counts as booked'
              : 'Links to an existing activity log — no double count'}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Type toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Meeting type</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setActivityType(t.value)}
                  className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-all"
                  style={{
                    background: activityType === t.value ? t.color + '22' : 'var(--bg-2)',
                    border: `1px solid ${activityType === t.value ? t.color : 'var(--line)'}`,
                    color: activityType === t.value ? t.color : 'var(--ink-2)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Company */}
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
              style={{ background: 'var(--input-bg)', border: `1px solid ${typeColor}66` }}
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

          {/* Date + Status row */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mono w-full px-3.5 py-2.5 rounded-lg text-[13px] font-medium text-ink outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = typeColor + '66')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--line-2)')}
              />
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-[13px] font-medium text-ink outline-none appearance-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isOnboarding && (
            <div className="flex flex-col gap-1.5">
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
                  className="mono w-full pl-7 pr-3.5 py-2.5 rounded-lg text-[14px] font-semibold text-ink outline-none placeholder:text-ink-3"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = typeColor + '66')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                />
              </div>
            </div>
          )}

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
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-ink-2 hover:text-ink-1 transition-colors"
              style={{ background: '#1A2035', border: '1px solid #262E45' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-30 transition-opacity"
              style={{ background: typeColor, color: '#0A0E1A' }}
            >
              Add meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
