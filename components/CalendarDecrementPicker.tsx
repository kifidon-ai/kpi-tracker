'use client'

import type { CalendarEvent } from '@/lib/types'

interface CalendarDecrementPickerProps {
  events: CalendarEvent[]
  activityType: 'disc' | 'demo'
  onSelect: (event: CalendarEvent) => void
  onCancel: () => void
}

const INTENT_COLOR: Record<string, string> = {
  high:   '#00E5A0',
  medium: '#FFD700',
  low:    '#FF5468',
}

const TYPE_LABEL: Record<string, string> = { disc: 'Discovery', demo: 'Demo' }
const TYPE_COLOR: Record<string, string>  = { disc: '#FFD700',   demo: '#00E5A0' }

export function CalendarDecrementPicker({ events, activityType, onSelect, onCancel }: CalendarDecrementPickerProps) {
  const accentColor = TYPE_COLOR[activityType]
  const typeLabel   = TYPE_LABEL[activityType]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-line-2 p-5 shadow-2xl"
        style={{ background: 'linear-gradient(180deg, var(--card-top), var(--card-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
            <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">Remove {typeLabel}</div>
          </div>
          <div className="text-[16px] font-bold">Which booking?</div>
        </div>

        {events.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-ink-3">No {typeLabel.toLowerCase()} bookings found in this period.</div>
        ) : (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onSelect(ev)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors hover:bg-line"
                style={{ background: 'var(--tile-bg)', border: `1px solid ${accentColor}33` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink truncate">{ev.company_name}</div>
                  <div className="text-[11px] text-ink-3 mt-0.5">{ev.scheduled_date}</div>
                </div>
                <div
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0"
                  style={{ background: (INTENT_COLOR[ev.intent] ?? '#fff') + '22', color: INTENT_COLOR[ev.intent] ?? '#fff' }}
                >
                  {ev.intent[0].toUpperCase()}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onCancel}
          className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink-1"
          style={{ background: '#1A2035', border: '1px solid #262E45' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
