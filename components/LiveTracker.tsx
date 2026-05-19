'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Rep, Client, ActivityDaily, ActivityLogEntry, Target, CountsByRep } from '@/lib/types'
import { METRIC_GROUPS, ALL_METRICS, KEY_METRICS } from '@/lib/constants'
import { relativeTime, getPeriodBounds, getPeriodLabel, type LiveRange } from '@/lib/helpers'
import { Icon } from './ui/Icon'
import { Avatar } from './ui/Avatar'
import { Card, Pill, SectionTitle, TargetBar, Segmented } from './ui/primitives'
import { Ring } from './charts'
import { ClosedDealModal } from './ClosedDealModal'
import {
  getWeeklyCountsAction,
  logActivityAction,
  decrementActivityAction,
  logClosedDealAction,
} from '@/app/actions'

interface LiveTrackerProps {
  reps: Rep[]
  initialFeed: ActivityLogEntry[]
  dailyTarget: Target | null
  onDealClosed?: (client: Client) => void
  onActivityUpdated?: (row: ActivityDaily) => void
}

const WEEKLY_TARGETS = { dials: 200, conv: 100, vm: 0, disc: 10, demo: 5 }
const WEEKLY_KEY_METRICS = ['dials', 'conv', 'disc', 'demo'] as const

export function LiveTracker({ reps, initialFeed, dailyTarget, onDealClosed, onActivityUpdated }: LiveTrackerProps) {
  const [activeRep, setActiveRep] = useState<string>(reps[0]?.id ?? 'team')
  const [feed, setFeed] = useState<ActivityLogEntry[]>(initialFeed)
  const [countsByRep, setCountsByRep] = useState<CountsByRep>({})
  const [now, setNow] = useState(new Date())
  const [showClosedModal, setShowClosedModal] = useState(false)
  const [range, setRange] = useState<LiveRange>('week')
  const [offset, setOffset] = useState(0)

  const bounds = useMemo(() => getPeriodBounds(range, offset), [range, offset])
  const isHistorical = offset > 0
  const label = getPeriodLabel(range, offset, bounds)

  const startISO = bounds.start.toISOString().slice(0, 10)
  const endISO   = bounds.end.toISOString().slice(0, 10)

  // Current week start — used by decrementActivityAction to find entries to delete
  const weekStartISO = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }, [])

  function handleRangeChange(v: string) {
    setRange(v as LiveRange)
    setOffset(0)
  }

  // tick relative timestamps every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Reload counts whenever the period changes
  useEffect(() => {
    getWeeklyCountsAction(startISO, endISO).then(setCountsByRep)
  }, [startISO, endISO])

  // Poll counts every 3 s so other reps' activity shows without needing Realtime
  useEffect(() => {
    const id = setInterval(() => {
      getWeeklyCountsAction(startISO, endISO).then(setCountsByRep)
    }, 3000)
    return () => clearInterval(id)
  }, [startISO, endISO])

  // Realtime: catches other reps' entries for the feed; deduplicates entries we already added manually
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('activity_log_entries')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log_entries' }, (payload) => {
        const entry = payload.new as ActivityLogEntry
        setFeed((f) => f.some((e) => e.id === entry.id) ? f : [entry, ...f].slice(0, 60))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const isTeam = activeRep === 'team'
  const rep = reps.find((r) => r.id === activeRep) ?? null

  // Active rep's own counts (used for timeline + log tiles)
  const counts = isTeam
    ? reps.reduce<Record<string, number>>((acc, r) => {
        const rc = countsByRep[r.id] ?? {}
        ALL_METRICS.forEach((m) => { acc[m.k] = (acc[m.k] ?? 0) + (rc[m.k] ?? 0) })
        return acc
      }, {})
    : (countsByRep[activeRep] ?? {})

  // Always team totals (used for ring charts vs team goal)
  const teamCounts = reps.reduce<Record<string, number>>((acc, r) => {
    const rc = countsByRep[r.id] ?? {}
    ALL_METRICS.forEach((m) => { acc[m.k] = (acc[m.k] ?? 0) + (rc[m.k] ?? 0) })
    return acc
  }, {})

  // Targets are team-wide (not per-rep)
  const weeklyTargets: Record<string, number> = { ...WEEKLY_TARGETS }

  const logActivity = useCallback(async (metricKey: string) => {
    if (isTeam || !rep) return
    const def = ALL_METRICS.find((m) => m.k === metricKey)
    if (!def) return

    setCountsByRep((prev) => ({
      ...prev,
      [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: ((prev[activeRep] ?? {})[metricKey] ?? 0) + 1 },
    }))

    try {
      const result = await logActivityAction(activeRep, def.k, def.label + ' logged', def.icon, def.color)
      setFeed((f) => f.some((e) => e.id === result.entry.id) ? f : [result.entry, ...f].slice(0, 60))
      if (result.dailyRow) onActivityUpdated?.(result.dailyRow)
    } catch {
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: Math.max(0, ((prev[activeRep] ?? {})[metricKey] ?? 1) - 1) },
      }))
    }
  }, [isTeam, rep, activeRep, onActivityUpdated])

  const decrement = useCallback(async (metricKey: string) => {
    if (isTeam || !rep) return

    const current = (countsByRep[activeRep] ?? {})[metricKey] ?? 0
    if (current <= 0) return

    setCountsByRep((prev) => ({
      ...prev,
      [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: current - 1 },
    }))

    const result = await decrementActivityAction(activeRep, metricKey, weekStartISO)

    if (!result.deleted) {
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: current },
      }))
    } else {
      if (result.id) setFeed((f) => f.filter((e) => e.id !== result.id))
      if (result.dailyRow) onActivityUpdated?.(result.dailyRow)
    }
  }, [isTeam, rep, activeRep, countsByRep, weekStartISO, onActivityUpdated])

  const logClosedDeal = useCallback(async (data: { companyName: string; monthlyPrice: number; closedDate: string }) => {
    setShowClosedModal(false)
    if (!rep) return

    setCountsByRep((prev) => ({
      ...prev,
      [activeRep]: { ...(prev[activeRep] ?? {}), closed: ((prev[activeRep] ?? {}).closed ?? 0) + 1 },
    }))

    try {
      const result = await logClosedDealAction({
        repId: activeRep,
        companyName: data.companyName,
        monthlyPrice: data.monthlyPrice,
        closedDate: data.closedDate,
      })
      onDealClosed?.(result.client)
    } catch {
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), closed: Math.max(0, ((prev[activeRep] ?? {}).closed ?? 1) - 1) },
      }))
    }
  }, [rep, activeRep, onDealClosed])

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="flex flex-col gap-[18px]">

      {/* Rep selector */}
      <Card padding={16}>
        <div className="flex justify-between items-center flex-wrap gap-3.5">
          <div>
            <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">
              {isHistorical ? 'Historical view' : `Live tracker · ${todayStr}`}
            </div>
            <div className="text-lg font-bold mt-1">
              {isTeam ? 'Whole team' : rep?.name}
              <span className="text-[13px] font-normal text-ink-2 ml-2">
                {isTeam ? '· read-only' : isHistorical ? '· historical' : `· ${rep?.role}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOffset((o) => o + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-2 hover:text-white hover:bg-[#1E2538] transition-colors text-base leading-none"
              >←</button>
              <span className="text-[12px] text-ink-2 font-medium w-[130px] text-center">{label}</span>
              <button
                onClick={() => setOffset((o) => Math.max(0, o - 1))}
                disabled={offset === 0}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-2 hover:text-white hover:bg-[#1E2538] transition-colors text-base leading-none disabled:opacity-25 disabled:cursor-not-allowed"
              >→</button>
            </div>
            <Segmented
              value={range}
              onChange={handleRangeChange}
              options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
            />
          </div>
        </div>
        <div className="mt-3.5 flex gap-1 bg-bg-2 p-1 rounded-[10px] border border-line flex-wrap">
            <button
              onClick={() => setActiveRep('team')}
              className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[7px] transition-all"
              style={{
                background: isTeam ? '#00D4FF22' : 'transparent',
                border: isTeam ? '1px solid #00D4FF66' : '1px solid transparent',
              }}
            >
              <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)' }}>
                <Icon name="team" size={12} color="#0A0E1A" />
              </div>
              <span className="text-[12px] font-semibold" style={{ color: isTeam ? '#00D4FF' : '#8B95B2' }}>Team</span>
            </button>
            {reps.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRep(r.id)}
                className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[7px] transition-all"
                style={{
                  background: activeRep === r.id ? r.color + '22' : 'transparent',
                  border: activeRep === r.id ? `1px solid ${r.color}66` : '1px solid transparent',
                }}
              >
                <Avatar rep={r} size={22} />
                <span className="text-[12px] font-semibold" style={{ color: activeRep === r.id ? r.color : '#8B95B2' }}>
                  {r.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
      </Card>

      {/* Key metrics — pipeline timeline + team rings */}
      <Card>
        <div className="flex justify-between items-start mb-3">
          <SectionTitle>
            {isTeam ? 'Team activity' : `${rep?.name.split(' ')[0]}'s activity`}
            <span className="text-[11px] font-normal text-ink-3 ml-2">{label.toLowerCase()}</span>
          </SectionTitle>
        </div>

        {/* Timeline: rep's own numbers, no goal */}
        <div className="flex items-start pt-1">
          {WEEKLY_KEY_METRICS.map((k, i) => {
            const def = ALL_METRICS.find((m) => m.k === k)!
            const v = (counts[k] as number) ?? 0
            return (
              <div key={k} className={`flex items-center ${i < WEEKLY_KEY_METRICS.length - 1 ? 'flex-1' : 'flex-none'}`}>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.8px]" style={{ color: def.color }}>{def.short}</div>
                  <div className="mono text-[36px] font-extrabold text-white leading-none">{v}</div>
                  <div className="text-[10px] text-ink-3">{def.label}</div>
                </div>
                {i < WEEKLY_KEY_METRICS.length - 1 && (
                  <div className="flex-1 flex items-center px-4 min-w-10">
                    <div className="flex-1 h-px bg-[#2A3350]" />
                    <span className="text-[#2A3350] text-[10px] leading-none">▶</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Ring charts: always team totals vs team goal */}
        <div className="mt-6 pt-5 border-t border-line">
          <div className="text-[10px] font-semibold uppercase tracking-[1px] text-ink-3 mb-3">Team vs goal</div>
          <div className="grid grid-cols-4 gap-3.5">
            {WEEKLY_KEY_METRICS.map((k) => {
              const def = ALL_METRICS.find((m) => m.k === k)!
              const v = (teamCounts[k] as number) ?? 0
              const t = weeklyTargets[k] ?? 1
              return (
                <div key={k} className="flex flex-col items-center gap-2.5 py-1">
                  <Ring value={v} target={t} color={def.color} size={110} stroke={9} label={def.short} />
                  <div className="text-center">
                    <div className="mono text-[13px] font-bold">
                      {v}<span className="text-ink-3 font-normal"> / {t}</span>
                    </div>
                    <div className="text-[10.5px] text-ink-2 mt-0.5">{def.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Log Activity + Feed */}
      <div className="grid grid-cols-[3fr_1fr] gap-[18px] items-start">
        <Card padding={0}>
          <div className="px-5 py-4 border-b border-line flex justify-between items-center">
            <div>
              <div className="text-[13px] font-bold">Log activity</div>
              <div className="text-[10.5px] text-ink-3 mt-0.5">
                {isTeam ? 'read-only · pick a rep to log' : `tap +1 to log for ${rep?.name.split(' ')[0]}`}
              </div>
            </div>
            {!isTeam && rep && <Avatar rep={rep} size={32} />}
          </div>

          {isHistorical && (
            <div className="mx-4 mt-3.5 px-3.5 py-2.5 rounded-lg flex items-center gap-2 text-[11px] text-ink-2"
              style={{ background: '#FFB80011', border: '1px solid #FFB80044' }}>
              <Icon name="log" size={13} color="#FFB800" />
              <span>Viewing {label.toLowerCase()} — logging is disabled for past periods.</span>
            </div>
          )}
          {!isHistorical && isTeam && (
            <div className="mx-4 mt-3.5 px-3.5 py-2.5 rounded-lg flex items-center gap-2 text-[11px] text-ink-2"
              style={{ background: '#00D4FF11', border: '1px solid #00D4FF44' }}>
              <Icon name="team" size={13} color="#00D4FF" />
              <span>Switch to a rep to log activity.</span>
            </div>
          )}

          {/* Columns layout: one column per metric group */}
          <div className="flex gap-4 p-4">
            {METRIC_GROUPS.map((group) => (
              <div key={group.group} className="flex-1 flex flex-col gap-2.5">
                {/* Column header */}
                <div className="pb-2.5 mb-0.5 border-b-2 border-line-2">
                  <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-ink-1">{group.group}</div>
                </div>
                {/* Tiles stacked vertically */}
                {group.items.map((def) => {
                  const v = (counts[def.k] as number) ?? 0
                  const t = weeklyTargets[def.k]
                  return (
                    <LogTile
                      key={def.k}
                      def={def}
                      value={v}
                      target={t}
                      disabled={isTeam || isHistorical}
                      onInc={def.k === 'closed' ? () => setShowClosedModal(true) : () => logActivity(def.k)}
                      onDec={() => decrement(def.k)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </Card>

        {/* Activity feed */}
        <Card padding={0} style={{ position: 'sticky', top: 120 }}>
          <div className="px-[18px] py-4 flex justify-between items-center border-b border-line">
            <div className="text-[13px] font-bold">Activity feed</div>
            <Pill color="#00D4FF">live</Pill>
          </div>
          <div className="max-h-[620px] overflow-y-auto px-3.5 pb-3.5 pt-1">
            {feed.length === 0 && (
              <div className="py-10 px-3 text-center text-ink-3 text-[12px]">
                No activity yet — start tapping +1.
              </div>
            )}
            {feed.map((item) => {
              const r = reps.find((x) => x.id === item.rep_id)
              return (
                <div key={item.id} className="grid items-center gap-2 py-2.5 px-0.5 border-b border-line"
                  style={{ gridTemplateColumns: '28px 22px 1fr auto' }}>
                  <div className="w-7 h-7 rounded-[7px] inline-flex items-center justify-center"
                    style={{ background: item.color + '22' }}>
                    <Icon name={item.icon} size={14} color={item.color} />
                  </div>
                  <Avatar rep={r ?? null} size={20} />
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-semibold truncate">{item.label}</div>
                    <div className="text-[10px] text-ink-3">{r?.name.split(' ')[0]}</div>
                  </div>
                  <div className="mono text-[10px] text-ink-3">{relativeTime(item.logged_at)}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {showClosedModal && rep && (
        <ClosedDealModal
          rep={rep}
          onSave={logClosedDeal}
          onCancel={() => setShowClosedModal(false)}
        />
      )}
    </div>
  )
}

// --- Log tile ---
interface LogTileProps {
  def: { k: string; label: string; short: string; icon: string; color: string }
  value: number
  target?: number
  disabled: boolean
  onInc: () => void
  onDec: () => void
}

function LogTile({ def, value, target, disabled, onInc, onDec }: LogTileProps) {
  return (
    <div
      className="rounded-[11px] p-3 flex flex-col gap-2 justify-between"
      style={{
        background: '#1A2035',
        border: `1px solid ${def.color}44`,
        minHeight: disabled ? 'auto' : 130,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-[26px] h-[26px] rounded-[7px] inline-flex items-center justify-center shrink-0"
          style={{ background: def.color + '22' }}>
          <Icon name={def.icon} size={13} color={def.color} />
        </div>
        <div className="text-[11.5px] font-semibold text-ink-1 leading-tight overflow-hidden text-ellipsis">{def.short}</div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="mono text-[26px] font-extrabold text-white leading-none">{value}</span>
          {target != null && target > 0 && <span className="mono text-[10px] text-ink-3">/ {target}</span>}
        </div>
        {target != null && target > 0 && (
          <div className="mt-[5px]">
            <TargetBar value={value} target={target} color={def.color} height={4} />
          </div>
        )}
      </div>
      {!disabled && (
        <div className="flex gap-1.5">
          <button
            onClick={onInc}
            className="flex-1 py-2 px-2.5 rounded-lg font-bold text-[12px] inline-flex items-center justify-center text-bg-1"
            style={{ background: def.color }}
          >
            +1
          </button>
          <button
            onClick={onDec}
            className="py-2 px-2.5 rounded-lg font-bold text-[12px] inline-flex items-center justify-center text-ink-2 shrink-0"
            style={{ background: '#252D45', border: '1px solid #333E5C' }}
          >
            −1
          </button>
        </div>
      )}
    </div>
  )
}
