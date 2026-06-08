'use client'

import { useState, useEffect, useRef } from 'react'
import type { CalendarEvent, Rep, CalendarIntent } from '@/lib/types'
import { Icon } from './ui/Icon'
import { Avatar } from './ui/Avatar'
import { Card, SectionTitle } from './ui/primitives'
import { AddMeetingModal } from './AddMeetingModal'
import {
  updateCalendarEventStatusAction,
  rescheduleCalendarEventAction,
  removeCalendarEventAction,
  editCalendarEventAction,
  addCalendarEntryOnlyAction,
  getCalendarCompaniesAction,
} from '@/app/actions'

interface DayCalendarProps {
  events: CalendarEvent[]
  reps: Rep[]
  repId: string
  companies: string[]
  startDate?: string
  endDate?: string
  onEventsChange: (events: CalendarEvent[]) => void
  onCompaniesUpdate: (companies: string[]) => void
}

const INTENT_COLOR: Record<string, string> = {
  high:   '#00E5A0',
  medium: '#FFD700',
  low:    '#FF5468',
}
const INTENT_OPTIONS: { value: CalendarIntent; label: string }[] = [
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]
const TYPE_LABEL: Record<string, string> = { disc: 'Disc', demo: 'Demo' }
const TYPE_COLOR: Record<string, string>  = { disc: '#FFD700', demo: '#00E5A0' }

type CardMode = 'view' | 'reschedule' | 'edit'

export function DayCalendar({ events, reps, repId, companies, startDate, endDate, onEventsChange, onCompaniesUpdate }: DayCalendarProps) {
  const [cardMode, setCardMode]           = useState<Record<string, CardMode>>({})
  const [rescheduleDate, setRescheduleDate] = useState<Record<string, string>>({})
  const [editState, setEditState]         = useState<Record<string, { intent: string; date: string }>>({})
  const [openMenu, setOpenMenu]           = useState<string | null>(null)
  const [loading, setLoading]             = useState<string | null>(null)
  const [showAddModal, setShowAddModal]   = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const todayISO = new Date().toISOString().slice(0, 10)

  const dateLabel = (() => {
    if (!startDate || !endDate) return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (startDate === endDate) {
      const [y, m, d] = startDate.split('-')
      const date = new Date(Number(y), Number(m) - 1, Number(d))
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    }
    const [sy, sm, sd] = startDate.split('-')
    const [ey, em, ed] = endDate.split('-')
    const start = new Date(Number(sy), Number(sm) - 1, Number(sd))
    const end = new Date(Number(ey), Number(em) - 1, Number(ed))
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    return `${startStr} – ${endStr}`
  })()

  const isSingleDay = startDate && endDate && startDate === endDate
  const sectionTitle = isSingleDay ? "Today's meetings" : "Meetings"
  const today = dateLabel

  // Close menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function getMode(id: string): CardMode { return cardMode[id] ?? 'view' }

  function enterEdit(event: CalendarEvent) {
    setEditState((p) => ({ ...p, [event.id]: { intent: event.intent, date: event.scheduled_date } }))
    setCardMode((p) => ({ ...p, [event.id]: 'edit' }))
    setOpenMenu(null)
  }

  function exitMode(id: string) {
    setCardMode((p) => ({ ...p, [id]: 'view' }))
  }

  async function setStatus(eventId: string, status: string) {
    setLoading(eventId)
    setOpenMenu(null)
    try {
      const { event } = await updateCalendarEventStatusAction(eventId, status)
      onEventsChange(events.map((e) => e.id === eventId ? event : e))
    } finally {
      setLoading(null)
    }
  }

  async function handleReschedule(eventId: string) {
    const date = rescheduleDate[eventId]
    if (!date) return
    setLoading(eventId)
    try {
      const { event } = await rescheduleCalendarEventAction(eventId, date)
      onEventsChange(events.map((e) => e.id === eventId ? event : e))
      exitMode(eventId)
    } finally {
      setLoading(null)
    }
  }

  async function handleEdit(eventId: string) {
    const s = editState[eventId]
    if (!s) return
    setLoading(eventId)
    try {
      const { event } = await editCalendarEventAction(eventId, { intent: s.intent, scheduledDate: s.date })
      onEventsChange(events.map((e) => e.id === eventId ? event : e))
      exitMode(eventId)
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(eventId: string) {
    setOpenMenu(null)
    setLoading(eventId)
    try {
      await removeCalendarEventAction(eventId)
      onEventsChange(events.filter((e) => e.id !== eventId))
    } finally {
      setLoading(null)
    }
  }

  async function handleAddMeeting(data: {
    companyName: string
    activityType: 'disc' | 'demo'
    scheduledDate: string
    intent: CalendarIntent
    status: string
  }) {
    setShowAddModal(false)
    try {
      const { event } = await addCalendarEntryOnlyAction({ repId, ...data })
      // Only add to today's view if it's for today
      if (data.scheduledDate === todayISO) {
        onEventsChange([...events, event])
      }
      // Refresh companies list so new company shows up next time
      getCalendarCompaniesAction().then(onCompaniesUpdate)
    } catch { /* silent */ }
  }

  if (events.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-1">
          <SectionTitle>{sectionTitle} <span className="text-[11px] font-normal text-ink-3 ml-1">{today}</span></SectionTitle>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-ink-2 hover:text-ink transition-colors"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
          >
            <Icon name="calendar" size={11} color="var(--ink-2)" />
            Add meeting
          </button>
        </div>
        <div className="mt-4 py-8 text-center text-ink-3 text-[12px]">No meetings scheduled for today</div>
        {showAddModal && (
          <AddMeetingModal companies={companies} onSave={handleAddMeeting} onCancel={() => setShowAddModal(false)} />
        )}
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>
          {sectionTitle}{' '}
          <span className="text-[11px] font-normal text-ink-3 ml-1">{today}</span>
        </SectionTitle>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-ink-3">{events.length} meeting{events.length !== 1 ? 's' : ''}</div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-ink-2 hover:text-ink transition-colors"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
          >
            <Icon name="calendar" size={11} color="var(--ink-2)" />
            Add meeting
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddMeetingModal companies={companies} onSave={handleAddMeeting} onCancel={() => setShowAddModal(false)} />
      )}

      <div className="flex flex-col gap-2">
        {events.map((event) => {
          const rep      = reps.find((r) => r.id === event.rep_id)
          const isLoading = loading === event.id
          const mode     = getMode(event.id)
          const isDone   = event.status === 'attended' || event.status === 'no_show'
          const isMenuOpen = openMenu === event.id
          const es       = editState[event.id]

          return (
            <div
              key={event.id}
              className="rounded-[11px] p-3 flex flex-col gap-2 relative"
              style={{
                background: 'var(--tile-bg)',
                border: `1px solid ${TYPE_COLOR[event.activity_type] ?? '#ffffff'}22`,
                opacity: isDone && mode === 'view' ? 0.65 : 1,
              }}
            >
              {/* Header row */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0"
                  style={{ background: (TYPE_COLOR[event.activity_type] ?? '#fff') + '22', color: TYPE_COLOR[event.activity_type] ?? '#fff' }}
                >
                  {TYPE_LABEL[event.activity_type] ?? event.activity_type}
                </div>

                <div className="text-[13px] font-semibold text-ink truncate flex-1">{event.company_name}</div>

                <div
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 uppercase"
                  style={{ background: (INTENT_COLOR[event.intent] ?? '#fff') + '22', color: INTENT_COLOR[event.intent] ?? '#fff' }}
                >
                  {event.intent[0].toUpperCase()}
                </div>

                {rep && <Avatar rep={rep} size={20} />}

                {event.reschedule_count > 0 && (
                  <div className="text-[10px] text-ink-3 shrink-0">×{event.reschedule_count}</div>
                )}

                {/* ··· menu trigger */}
                <div className="relative shrink-0" ref={isMenuOpen ? menuRef : null}>
                  <button
                    onClick={() => setOpenMenu(isMenuOpen ? null : event.id)}
                    disabled={isLoading}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-line transition-colors text-[14px] font-bold leading-none disabled:opacity-40"
                  >
                    ···
                  </button>

                  {isMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-line-2 overflow-hidden shadow-xl z-20"
                      style={{ background: 'var(--card-bottom)' }}
                    >
                      {/* Revert to scheduled */}
                      {event.status !== 'scheduled' && (
                        <button
                          onClick={() => setStatus(event.id, 'scheduled')}
                          className="w-full text-left px-3.5 py-2.5 text-[12px] font-medium text-ink hover:bg-line transition-colors flex items-center gap-2"
                        >
                          <Icon name="calendar" size={12} color="var(--ink-2)" />
                          Mark as scheduled
                        </button>
                      )}
                      {/* Edit */}
                      <button
                        onClick={() => enterEdit(event)}
                        className="w-full text-left px-3.5 py-2.5 text-[12px] font-medium text-ink hover:bg-line transition-colors flex items-center gap-2"
                      >
                        <Icon name="log" size={12} color="var(--ink-2)" />
                        Edit
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="w-full text-left px-3.5 py-2.5 text-[12px] font-medium hover:bg-line transition-colors flex items-center gap-2"
                        style={{ color: '#FF5468' }}
                      >
                        <Icon name="minus" size={12} color="#FF5468" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status label */}
              {event.status !== 'scheduled' && mode === 'view' && (
                <div className="text-[11px] font-semibold" style={{
                  color: event.status === 'attended' ? '#00E5A0' : event.status === 'no_show' ? '#FF5468' : '#7AA7F5'
                }}>
                  {event.status === 'no_show' ? 'No show' : event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </div>
              )}

              {/* Edit mode */}
              {mode === 'edit' && es && (
                <div className="flex flex-col gap-2 pt-1 border-t border-line">
                  <div className="flex gap-1.5">
                    {INTENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditState((p) => ({ ...p, [event.id]: { ...es, intent: opt.value } }))}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                          background: es.intent === opt.value ? (INTENT_COLOR[opt.value] ?? '#fff') + '22' : 'var(--bg-2)',
                          border: `1px solid ${es.intent === opt.value ? (INTENT_COLOR[opt.value] ?? '#fff') : 'var(--line)'}`,
                          color: es.intent === opt.value ? (INTENT_COLOR[opt.value] ?? '#fff') : 'var(--ink-2)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    value={es.date}
                    onChange={(e) => setEditState((p) => ({ ...p, [event.id]: { ...es, date: e.target.value } }))}
                    className="mono w-full px-3 py-1.5 rounded-lg text-[13px] font-medium text-ink outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleEdit(event.id)}
                      disabled={isLoading}
                      className="flex-1 py-1.5 rounded-lg text-[12px] font-bold text-bg-1 disabled:opacity-40"
                      style={{ background: TYPE_COLOR[event.activity_type] ?? '#00E5A0' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => exitMode(event.id)}
                      className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold text-ink-2"
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Reschedule date picker */}
              {mode === 'reschedule' && (
                <div className="flex gap-2 items-center pt-1 border-t border-line">
                  <input
                    type="date"
                    value={rescheduleDate[event.id] ?? ''}
                    onChange={(e) => setRescheduleDate((p) => ({ ...p, [event.id]: e.target.value }))}
                    autoFocus
                    className="mono flex-1 px-3 py-1.5 rounded-lg text-[13px] font-medium text-ink outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid #7AA7F566' }}
                  />
                  <button
                    onClick={() => handleReschedule(event.id)}
                    disabled={!rescheduleDate[event.id] || isLoading}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-bg-1 disabled:opacity-40"
                    style={{ background: '#7AA7F5' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => exitMode(event.id)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-ink-2"
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Action buttons — only when scheduled and in view mode */}
              {event.status === 'scheduled' && mode === 'view' && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setStatus(event.id, 'attended')}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                    style={{ background: '#00E5A022', border: '1px solid #00E5A044', color: '#00E5A0' }}
                  >
                    <Icon name="check" size={12} color="#00E5A0" />
                    Attended
                  </button>
                  <button
                    onClick={() => setStatus(event.id, 'no_show')}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                    style={{ background: '#FF546822', border: '1px solid #FF546844', color: '#FF5468' }}
                  >
                    <Icon name="minus" size={12} color="#FF5468" />
                    No show
                  </button>
                  <button
                    onClick={() => { setCardMode((p) => ({ ...p, [event.id]: 'reschedule' })); setRescheduleDate((p) => ({ ...p, [event.id]: '' })) }}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                    style={{ background: '#7AA7F522', border: '1px solid #7AA7F544', color: '#7AA7F5' }}
                  >
                    <Icon name="calendar" size={12} color="#7AA7F5" />
                    Reschedule
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
