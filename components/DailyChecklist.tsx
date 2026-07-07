'use client'

import { useState, useEffect } from 'react'
import type { Rep } from '@/lib/types'
import { SectionTitle } from './ui/primitives'
import { Avatar } from './ui/Avatar'
import { createClient } from '@/utils/supabase/client'
import { getDailyChecklistAction, checkDailyItemAction, uncheckDailyItemAction, resetSectionAction } from '@/app/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemMode = 'multi' | 'shared' | 'assigned'

interface Item {
  id: string
  label: string
  bullet?: boolean
  mode?: ItemMode
  assignedNames?: string[]   // lowercase first-name fragments
  children?: Item[]
}

interface Section {
  id: string
  title: string
  time: string
  color: string
  items: Item[]
}

// ─── Checklist data ───────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'lead-mgmt',
    title: 'Lead Management',
    time: '9:30am – 10am',
    color: '#00D4FF',
    items: [
      { id: 'lm-1', label: 'Day of Reminder emails', mode: 'multi' },
      { id: 'lm-2', label: 'T-1 Reminder Emails',   mode: 'multi' },
    ],
  },
  {
    id: 'post-sprint',
    title: 'Post Sprint Checklist',
    time: '10am – 4:30pm',
    color: '#FFB020',
    items: [
      { id: 'ps-1', label: 'Send out Discovery bookings', mode: 'multi' },
      { id: 'ps-2', label: 'Respond to any follow up emails', mode: 'multi' },
    ],
  },
  {
    id: 'prospect-mgmt',
    title: 'Prospect Management',
    time: '4:30pm – End of Day · Weekend',
    color: '#00E5A0',
    items: [
      { id: 'pm-1', label: 'Responded to follow up emails', mode: 'multi' },
      { id: 'pm-2', label: 'Updated Attio Pipeline for the next day', mode: 'multi' },
      { id: 'pm-3', label: 'Set tasks for this weeks clients', mode: 'multi' },
      { id: 'pm-4', label: 'Colour Code the following meetings based on assignment', mode: 'multi' },
      { id: 'pm-5', label: 'Transcribe Cold calls and put them in attio Notes', mode: 'multi' },
      { id: 'pm-6', label: 'Confirm Discovery/Demo today have notes', mode: 'multi' },
      { id: 'pm-7', label: 'Make sure discovery and demos analytics are tracked in KPI', mode: 'multi' },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayKeyET(): string {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

function getRelevantReps(item: Item, activeReps: Rep[]): Rep[] {
  if (item.mode === 'assigned' && item.assignedNames?.length) {
    return activeReps.filter((r) =>
      item.assignedNames!.some((n) => r.name.toLowerCase().includes(n))
    )
  }
  return activeReps
}

type Expected = { itemId: string; mode: ItemMode; repIds: string[] }

function collectExpected(items: Item[], activeReps: Rep[]): Expected[] {
  const out: Expected[] = []
  for (const item of items) {
    if (!item.bullet && item.mode) {
      const reps = getRelevantReps(item, activeReps)
      out.push({ itemId: item.id, mode: item.mode, repIds: reps.map((r) => r.id) })
    }
    if (item.children) out.push(...collectExpected(item.children, activeReps))
  }
  return out
}

function calcProgress(expected: Expected[], checks: Record<string, string[]>) {
  let total = 0, done = 0
  for (const { itemId, mode, repIds } of expected) {
    const checkedBy = checks[itemId] ?? []
    if (mode === 'shared') {
      total += 1
      if (checkedBy.length > 0) done += 1
    } else {
      total += repIds.length
      done += repIds.filter((id) => checkedBy.includes(id)).length
    }
  }
  return { total, done }
}

// ─── Avatar row ───────────────────────────────────────────────────────────────

function AvatarRow({
  reps,
  checkedBy,
  currentRepId,
  mode,
  color,
  onToggle,
}: {
  reps: Rep[]
  checkedBy: string[]
  currentRepId: string | null
  mode: ItemMode
  color: string
  onToggle: (repId: string, nowChecked: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      {reps.map((rep) => {
        const done = checkedBy.includes(rep.id)
        const isMe = rep.id === currentRepId
        // shared: anyone can check if nobody has; only checker can uncheck
        const canClick = isMe || (mode === 'shared' && checkedBy.length === 0)

        return (
          <button
            key={rep.id}
            type="button"
            title={done ? `${rep.name.split(' ')[0]} ✓` : rep.name.split(' ')[0]}
            onClick={canClick ? () => onToggle(rep.id, !done) : undefined}
            style={{
              padding: 0, lineHeight: 0, borderRadius: '50%',
              cursor: canClick ? 'pointer' : 'default',
              opacity: done ? 1 : 0.25,
              boxShadow: done ? `0 0 0 2px ${color}` : 'none',
              transition: 'opacity 150ms, box-shadow 150ms',
            }}
          >
            <Avatar rep={rep} size={24} />
          </button>
        )
      })}
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function CheckRow({
  item, depth, activeReps, currentRepId, checks, color, onToggle,
}: {
  item: Item
  depth: number
  activeReps: Rep[]
  currentRepId: string | null
  checks: Record<string, string[]>
  color: string
  onToggle: (itemId: string, repId: string, nowChecked: boolean, mode: ItemMode) => void
}) {
  if (item.bullet) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', paddingLeft: depth * 20 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--ink-3)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)', userSelect: 'none' }}>{item.label}</span>
        </div>
        {(item.children ?? []).map((c) => (
          <CheckRow key={c.id} item={c} depth={depth + 1} activeReps={activeReps} currentRepId={currentRepId} checks={checks} color={color} onToggle={onToggle} />
        ))}
      </div>
    )
  }

  if (!item.mode) return null

  const checkedBy = checks[item.id] ?? []
  const relevantReps = getRelevantReps(item, activeReps)
  const isDone = item.mode === 'shared'
    ? checkedBy.length > 0
    : relevantReps.length > 0 && relevantReps.every((r) => checkedBy.includes(r.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', paddingLeft: depth * 20 }}>
        <span style={{
          flex: 1, fontSize: 13, lineHeight: 1.4, userSelect: 'none',
          color: isDone ? 'var(--ink-3)' : 'var(--ink)',
          textDecoration: isDone ? 'line-through' : 'none',
        }}>
          {item.label}
        </span>
        <AvatarRow
          reps={relevantReps}
          checkedBy={checkedBy}
          currentRepId={currentRepId}
          mode={item.mode}
          color={color}
          onToggle={(repId, nowChecked) => onToggle(item.id, repId, nowChecked, item.mode!)}
        />
      </div>
      {(item.children ?? []).map((c) => (
        <CheckRow key={c.id} item={c} depth={depth + 1} activeReps={activeReps} currentRepId={currentRepId} checks={checks} color={color} onToggle={onToggle} />
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface DailyChecklistProps {
  reps: Rep[]
  currentRepId: string | null
}

export function DailyChecklist({ reps, currentRepId }: DailyChecklistProps) {
  const activeReps = reps.filter((r) => r.is_active)
  const [dateKey, setDateKey] = useState(getTodayKeyET)
  const [checks, setChecks] = useState<Record<string, string[]>>({})

  // Load from DB on mount / date change
  useEffect(() => {
    getDailyChecklistAction(dateKey).then((rows) => {
      const map: Record<string, string[]> = {}
      for (const { item_id, rep_id } of rows) {
        map[item_id] = [...(map[item_id] ?? []), rep_id]
      }
      setChecks(map)
    })
  }, [dateKey])

  // Real-time: see teammates' avatars light up instantly
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('daily_cl_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_checklist' }, (p) => {
        const { date_key, item_id, rep_id } = p.new as Record<string, string>
        if (date_key !== dateKey) return
        setChecks((prev) => {
          const cur = prev[item_id] ?? []
          return cur.includes(rep_id) ? prev : { ...prev, [item_id]: [...cur, rep_id] }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'daily_checklist' }, (p) => {
        const { date_key, item_id, rep_id } = p.old as Record<string, string>
        if (date_key !== dateKey) return
        setChecks((prev) => ({ ...prev, [item_id]: (prev[item_id] ?? []).filter((id) => id !== rep_id) }))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [dateKey])

  // Midnight rollover
  useEffect(() => {
    const id = setInterval(() => {
      const today = getTodayKeyET()
      if (today !== dateKey) { setDateKey(today); setChecks({}) }
    }, 60_000)
    return () => clearInterval(id)
  }, [dateKey])

  async function toggle(itemId: string, repId: string, nowChecked: boolean, mode: ItemMode) {
    if (mode === 'shared' && !nowChecked) {
      const checkedBy = checks[itemId] ?? []
      if (!checkedBy.includes(repId)) return // only the checker can uncheck
    }
    setChecks((prev) => {
      const cur = prev[itemId] ?? []
      return { ...prev, [itemId]: nowChecked ? (cur.includes(repId) ? cur : [...cur, repId]) : cur.filter((id) => id !== repId) }
    })
    if (nowChecked) await checkDailyItemAction(dateKey, itemId, repId)
    else await uncheckDailyItemAction(dateKey, itemId, repId)
  }

  async function resetSection(itemIds: string[]) {
    const itemIdSet = new Set(itemIds)
    setChecks((prev) => {
      const updated = { ...prev }
      for (const itemId of itemIds) {
        delete updated[itemId]
      }
      return updated
    })
    await resetSectionAction(dateKey, itemIds)
  }

  const allExpected = SECTIONS.flatMap((s) => collectExpected(s.items, activeReps))
  const { total, done } = calcProgress(allExpected, checks)
  const pct = total > 0 ? (done / total) * 100 : 0
  const allDone = total > 0 && done === total

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div>
          <SectionTitle>GTM Daily Checklist</SectionTitle>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: -4 }}>
            {new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })} · resets midnight ET
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: allDone ? '#00E5A0' : 'var(--ink)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
            {done}<span style={{ color: 'var(--ink-3)', fontSize: 16 }}>/{total}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>completed</div>
        </div>
      </div>

      <div style={{ height: 4, background: 'var(--line)', borderRadius: 99, marginBottom: 26, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: allDone ? '#00E5A0' : 'linear-gradient(90deg,#00D4FF,#3B82F6)', borderRadius: 99, transition: 'width 300ms ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {SECTIONS.map((section) => {
          const secExp = collectExpected(section.items, activeReps)
          const { total: st, done: sd } = calcProgress(secExp, checks)
          const isTimmy = currentRepId === 'c6632466-befd-416f-abea-f0cfaa311ae1'
          const isPostSprint = section.id === 'post-sprint'

          return (
            <div key={section.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 3, height: 16, background: section.color, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink)', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 }}>{section.title}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{section.time}</span>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: sd === st && st > 0 ? section.color : 'var(--ink-3)', marginLeft: 6 }}>{sd}/{st}</span>
                {isTimmy && isPostSprint && (
                  <button
                    type="button"
                    onClick={() => resetSection(section.items.map(item => item.id))}
                    style={{
                      fontSize: 10,
                      padding: '4px 8px',
                      background: 'transparent',
                      border: `1px solid ${section.color}22`,
                      borderRadius: 4,
                      color: section.color,
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 150ms',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = section.color + '11'
                      e.currentTarget.style.borderColor = section.color + '66'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = section.color + '22'
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div style={{ background: 'var(--column-bg)', border: '1px solid var(--line)', borderLeft: `3px solid ${section.color}`, borderRadius: 10, padding: '8px 14px' }}>
                {section.items.map((item) => (
                  <CheckRow key={item.id} item={item} depth={0} activeReps={activeReps} currentRepId={currentRepId} checks={checks} color={section.color} onToggle={toggle} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
