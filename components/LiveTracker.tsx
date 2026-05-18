'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Rep, Client, ActivityLogEntry, Target, CountsByRep } from '@/lib/types'
import { METRIC_GROUPS, ALL_METRICS, KEY_METRICS } from '@/lib/constants'
import { relativeTime } from '@/lib/helpers'
import { Icon } from './ui/Icon'
import { Avatar } from './ui/Avatar'
import { Card, Pill, SectionTitle, TargetBar } from './ui/primitives'
import { Ring } from './charts'

interface LiveTrackerProps {
  reps: Rep[]
  initialFeed: ActivityLogEntry[]
  dailyTarget: Target | null
}

const WEEKLY_TARGETS = { dials: 200, conv: 100, vm: 0, disc: 10, demo: 5 }
const WEEKLY_KEY_METRICS = ['dials', 'conv', 'disc', 'demo'] as const

export function LiveTracker({ reps, initialFeed, dailyTarget }: LiveTrackerProps) {
  const supabase = createClient()
  const [activeRep, setActiveRep] = useState<string>(reps[0]?.id ?? 'team')
  const [feed, setFeed] = useState<ActivityLogEntry[]>(initialFeed)
  const [countsByRep, setCountsByRep] = useState<CountsByRep>({})
  const [now, setNow] = useState(new Date())

  // Monday of the current week (ISO date string)
  const weekStartISO = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }, [])

  // tick relative timestamps every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // load this week's logged counts from Supabase on mount
  useEffect(() => {
    supabase
      .from('activity_log_entries')
      .select('rep_id, metric_key')
      .gte('logged_at', weekStartISO + 'T00:00:00')
      .then(({ data }) => {
        if (!data) return
        const counts: CountsByRep = {}
        data.forEach(({ rep_id, metric_key }) => {
          if (!counts[rep_id]) counts[rep_id] = {}
          counts[rep_id][metric_key] = (counts[rep_id][metric_key] ?? 0) + 1
        })
        setCountsByRep(counts)
      })
  }, [])

  // realtime subscription: new log entries appear in feed
  useEffect(() => {
    const channel = supabase
      .channel('activity_log_entries')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log_entries' }, (payload) => {
        const entry = payload.new as ActivityLogEntry
        setFeed((f) => [entry, ...f].slice(0, 60))
        setCountsByRep((prev) => ({
          ...prev,
          [entry.rep_id]: {
            ...(prev[entry.rep_id] ?? {}),
            [entry.metric_key]: ((prev[entry.rep_id] ?? {})[entry.metric_key] ?? 0) + 1,
          },
        }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const isTeam = activeRep === 'team'
  const rep = reps.find((r) => r.id === activeRep) ?? null

  const counts = isTeam
    ? reps.reduce<Record<string, number>>((acc, r) => {
        const rc = countsByRep[r.id] ?? {}
        ALL_METRICS.forEach((m) => { acc[m.k] = (acc[m.k] ?? 0) + (rc[m.k] ?? 0) })
        return acc
      }, {})
    : (countsByRep[activeRep] ?? {})

  const weeklyTargets: Record<string, number> = isTeam
    ? Object.fromEntries(Object.entries(WEEKLY_TARGETS).map(([k, v]) => [k, v * reps.length]))
    : { ...WEEKLY_TARGETS }

  const logActivity = useCallback(async (metricKey: string) => {
    if (isTeam || !rep) return
    const def = ALL_METRICS.find((m) => m.k === metricKey)
    if (!def) return

    // optimistic update
    setCountsByRep((prev) => ({
      ...prev,
      [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: ((prev[activeRep] ?? {})[metricKey] ?? 0) + 1 },
    }))

    const { data, error } = await supabase
      .from('activity_log_entries')
      .insert({ rep_id: activeRep, metric_key: def.k, label: def.label + ' logged', icon: def.icon, color: def.color })
      .select()
      .single()

    if (error) {
      // rollback optimistic update
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: Math.max(0, ((prev[activeRep] ?? {})[metricKey] ?? 1) - 1) },
      }))
    }
    // realtime channel will add the new entry to the feed
  }, [isTeam, rep, activeRep])

  const decrement = useCallback(async (metricKey: string) => {
    if (isTeam || !rep) return

    const current = (countsByRep[activeRep] ?? {})[metricKey] ?? 0
    if (current <= 0) return

    // optimistic update
    setCountsByRep((prev) => ({
      ...prev,
      [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: current - 1 },
    }))

    const { data: entries } = await supabase
      .from('activity_log_entries')
      .select('id')
      .eq('rep_id', activeRep)
      .eq('metric_key', metricKey)
      .gte('logged_at', weekStartISO + 'T00:00:00')
      .order('logged_at', { ascending: false })
      .limit(1)

    if (!entries?.length) {
      // nothing to delete — rollback
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: current },
      }))
      return
    }

    const { error } = await supabase
      .from('activity_log_entries')
      .delete()
      .eq('id', entries[0].id)

    if (error) {
      setCountsByRep((prev) => ({
        ...prev,
        [activeRep]: { ...(prev[activeRep] ?? {}), [metricKey]: current },
      }))
    } else {
      setFeed((f) => f.filter((e) => e.id !== entries[0].id))
    }
  }, [isTeam, rep, activeRep, countsByRep])

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Rep selector */}
      <Card padding={16}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: '#5A6685', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
              Live tracker · {todayStr}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {isTeam ? 'Whole team' : rep?.name}
              <span style={{ fontSize: 13, fontWeight: 400, color: '#8B95B2', marginLeft: 8 }}>
                {isTeam ? '· read-only' : `· ${rep?.role}`}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#0F1422', padding: 4, borderRadius: 10, border: '1px solid #1E2538', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveRep('team')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7,
                background: isTeam ? '#00D4FF22' : 'transparent',
                border: isTeam ? '1px solid #00D4FF66' : '1px solid transparent',
              }}
            >
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="team" size={12} color="#0A0E1A" />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: isTeam ? '#00D4FF' : '#8B95B2' }}>Team</span>
            </button>
            {reps.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRep(r.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7,
                  background: activeRep === r.id ? r.color + '22' : 'transparent',
                  border: activeRep === r.id ? `1px solid ${r.color}66` : '1px solid transparent',
                }}
              >
                <Avatar rep={r} size={22} />
                <span style={{ fontSize: 12, fontWeight: 600, color: activeRep === r.id ? r.color : '#8B95B2' }}>
                  {r.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Key metric rings */}
      <Card>
        <SectionTitle right={<Pill color="#5A6685">{isTeam ? 'team · this week' : 'this week'}</Pill>}>
          Key metrics vs target
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {WEEKLY_KEY_METRICS.map((k) => {
            const def = ALL_METRICS.find((m) => m.k === k)!
            const v = (counts[k] as number) ?? 0
            const t = weeklyTargets[k] ?? 1
            return (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
                <Ring value={v} target={t} color={def.color} size={120} stroke={10} label={def.short} />
                <div style={{ textAlign: 'center' }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                    {v}<span style={{ color: '#5A6685', fontWeight: 400 }}> / {t}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#8B95B2', marginTop: 2 }}>{def.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Log Activity + Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 18, alignItems: 'flex-start' }}>
        <Card padding={0}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E2538', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Log activity</div>
              <div style={{ fontSize: 10.5, color: '#5A6685', marginTop: 2 }}>
                {isTeam ? 'read-only · pick a rep to log' : `tap +1 to log for ${rep?.name.split(' ')[0]}`}
              </div>
            </div>
            {!isTeam && rep && <Avatar rep={rep} size={32} />}
          </div>

          {isTeam && (
            <div style={{ padding: '10px 14px', margin: '14px 16px 0', background: '#00D4FF11', border: '1px solid #00D4FF44', borderRadius: 8, fontSize: 11, color: '#8B95B2', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="team" size={13} color="#00D4FF" />
              <span>Switch to a rep to log activity.</span>
            </div>
          )}

          <div style={{ padding: 16 }}>
            {METRIC_GROUPS.map((group, gi) => (
              <div key={group.group} style={{ marginBottom: gi === METRIC_GROUPS.length - 1 ? 0 : 16 }}>
                <div style={{ fontSize: 9.5, color: '#5A6685', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8, padding: '0 2px' }}>
                  {group.group}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {group.items.map((def) => {
                    const v = (counts[def.k] as number) ?? 0
                    const t = weeklyTargets[def.k]
                    return (
                      <LogTile
                        key={def.k}
                        def={def}
                        value={v}
                        target={t}
                        disabled={isTeam}
                        onInc={() => logActivity(def.k)}
                        onDec={() => decrement(def.k)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Activity feed */}
        <Card padding={0} style={{ position: 'sticky', top: 120 }}>
          <div style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E2538' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Activity feed</div>
            <Pill color="#00D4FF">live</Pill>
          </div>
          <div style={{ maxHeight: 620, overflowY: 'auto', padding: '4px 14px 14px' }}>
            {feed.length === 0 && (
              <div style={{ padding: '40px 12px', textAlign: 'center', color: '#5A6685', fontSize: 12 }}>
                No activity yet — start tapping +1.
              </div>
            )}
            {feed.map((item) => {
              const r = reps.find((x) => x.id === item.rep_id)
              return (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '28px 22px 1fr auto', alignItems: 'center', gap: 8, padding: '10px 2px', borderBottom: '1px solid #1E2538' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: item.color + '22', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={item.icon} size={14} color={item.color} />
                  </div>
                  <Avatar rep={r ?? null} size={20} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: '#5A6685' }}>{r?.name.split(' ')[0]}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: '#5A6685' }}>{relativeTime(item.logged_at)}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
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
    <div style={{
      background: '#1A2035',
      border: `1px solid ${def.color}44`,
      borderRadius: 11,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      height: disabled ? 'auto' : 140,
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: def.color + '22', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={def.icon} size={13} color={def.color} />
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#D8DEEF', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.short}</div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</span>
          {target != null && target > 0 && <span className="mono" style={{ fontSize: 10, color: '#5A6685' }}>/ {target}</span>}
        </div>
        {target != null && target > 0 && (
          <div style={{ marginTop: 5 }}>
            <TargetBar value={value} target={target} color={def.color} height={4} />
          </div>
        )}
      </div>
      {!disabled && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onInc}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8,
              background: def.color, color: '#0A0E1A',
              fontWeight: 700, fontSize: 12,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            +1
          </button>
          <button
            onClick={onDec}
            style={{
              padding: '8px 10px', borderRadius: 8,
              background: '#252D45', border: '1px solid #333E5C',
              color: '#8B95B2', fontWeight: 700, fontSize: 12,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            −1
          </button>
        </div>
      )}
    </div>
  )
}
