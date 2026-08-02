'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { Rep, Client, ActivityLogEntry, Target } from '@/lib/types'

import { fmtMoney, isClientActiveAsOf } from '@/lib/helpers'
import { Icon } from './ui/Icon'
import { LiveTracker } from './LiveTracker'
import { TeamPerformance } from './TeamPerformance'
import { ThemeToggle } from './ThemeToggle'
import { createClient } from '@/utils/supabase/client'
import { useNotifications, type SoundType } from '@/hooks/useNotifications'
import { useScheduledNotifications } from '@/hooks/useScheduledNotifications'
import { DailyChecklist } from './DailyChecklist'

const TaskTracker = dynamic(
  () => import('./TaskTracker').then((m) => m.TaskTracker),
  {
    loading: () => (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', fontSize: 13 }}>
        Loading task tracker…
      </div>
    ),
  },
)

interface ShellProps {
  reps: Rep[]
  clients: Client[]
  feed: ActivityLogEntry[]
  targets: Target[]
}

type Tab = 'live' | 'team' | 'tasks'

export function Shell({ reps, clients: initialClients, feed: initialFeed, targets }: ShellProps) {
  const [currentRepId, setCurrentRepId] = useState<string | null>(null)
  const [isSuperUser, setIsSuperUser] = useState(false)
  const currentRepIdRef = useRef<string | null>(null)

  const { permission, requestPermission, notify, soundEnabled, toggleSound } = useNotifications()
  useScheduledNotifications(currentRepId, notify)

  const SUPERUSER_EMAILS = ['timmy.ifidon@stepscale.ai']

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      const match = reps.find((r) => r.user_id === data.user!.id)
      if (match && match.is_active) {
        setCurrentRepId(match.id)
        currentRepIdRef.current = match.id
      }
      if (data.user.email && SUPERUSER_EMAILS.includes(data.user.email)) {
        setIsSuperUser(true)
      }
    })
  }, [reps])

  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ss-tab')
      if (saved === 'live' || saved === 'team' || saved === 'tasks') return saved
    }
    return 'team'
  })

  function handleTabChange(t: Tab) {
    setTab(t)
    localStorage.setItem('ss-tab', t)
  }

  const [clients, setClients] = useState<Client[]>(initialClients)
  const [feed, setFeed] = useState<ActivityLogEntry[]>(initialFeed)
  const router = useRouter()

  const repById = Object.fromEntries(reps.map((r) => [r.id, r]))

  // Keep a stable ref to notify so the subscription closure can call it
  const notifyRef = useRef(notify)
  useEffect(() => { notifyRef.current = notify }, [notify])

  // Realtime: keep feed in sync with DB — single source of truth
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('shell_log_entries')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log_entries' }, (payload) => {
        const entry = payload.new as ActivityLogEntry
        setFeed((f) => f.some((e) => e.id === entry.id) ? f : [entry, ...f].slice(0, 1000))

        // Notify for teammate activity only (not your own)
        if (entry.rep_id !== currentRepIdRef.current) {
          const rep = repById[entry.rep_id]
          const sound: SoundType =
            entry.metric_key === 'closed' ? 'deal' :
            entry.metric_key === 'demo' || entry.metric_key === 'disc' || entry.metric_key === 'onb' ? 'activity' :
            'task'
          notifyRef.current(
            rep ? `${rep.name.split(' ')[0]} · ${entry.label}` : entry.label,
            undefined,
            sound,
          )
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'activity_log_entries' }, (payload) => {
        const entry = payload.new as ActivityLogEntry
        setFeed((f) => f.map((e) => e.id === entry.id ? entry : e))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'activity_log_entries' }, (payload) => {
        const id = (payload.old as { id: string }).id
        setFeed((f) => f.filter((e) => e.id !== id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const todayISO = new Date().toISOString().slice(0, 10)
  const mrr = clients.filter((c) => isClientActiveAsOf(c, todayISO)).reduce((s, c) => s + c.mrr, 0)
  const activeClientCount = clients.filter((c) => isClientActiveAsOf(c, todayISO)).length

  function handleDealClosed(client: Client) {
    setClients((prev) => [client, ...prev])
  }

  function handleClientUpdated(client: Client) {
    setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)))
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'team',  label: 'Team performance', icon: 'team' },
    { id: 'live',  label: 'Live tracker',     icon: 'log' },
    { id: 'tasks', label: 'Task tracker',     icon: 'board' },
  ]

  const bellIcon = permission === 'denied' ? 'bell-off' : 'bell'
  const bellColor = permission === 'granted' ? '#00D4FF' : 'var(--ink-3)'
  const bellTitle =
    permission === 'default' ? 'Enable notifications' :
    permission === 'granted' ? 'Notifications on' :
    'Notifications blocked — allow in browser settings'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1)' }}>
      <header style={{
        padding: '18px 28px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        borderBottom: '1px solid var(--line)',
        position: 'sticky',
        top: 0,
        background: 'var(--header-bg)',
        backdropFilter: 'blur(12px)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #00D4FF, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 18L9 12L13 16L21 6" stroke="#0A0E1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="21" cy="6" r="2" fill="#0A0E1A" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>Stepscale Sales</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />

            {/* Bell: request permission or show state */}
            <button
              onClick={permission === 'granted' ? undefined : requestPermission}
              title={bellTitle}
              style={{
                padding: '8px',
                background: permission === 'granted' ? '#00D4FF18' : 'var(--bg-2)',
                border: `1px solid ${permission === 'granted' ? '#00D4FF44' : 'var(--line)'}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: permission === 'denied' ? 'not-allowed' : 'pointer',
                opacity: permission === 'denied' ? 0.4 : 1,
              }}
            >
              <Icon name={bellIcon} size={16} color={bellColor} />
            </button>

            {/* Sound toggle — only shown once notifications are on */}
            {permission === 'granted' && (
              <button
                onClick={toggleSound}
                title={soundEnabled ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
                style={{
                  padding: '8px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={soundEnabled ? 'volume' : 'volume-off'} size={16} color={soundEnabled ? 'var(--ink-2)' : 'var(--ink-3)'} />
              </button>
            )}

            <div style={{ padding: '8px 14px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>MRR</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#00E5A0' }}>{fmtMoney(mrr)}</span>
            </div>
            <button
              onClick={signOut}
              style={{ padding: '8px 14px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}
            >
              Sign out
            </button>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 2 }}>
          {tabs.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 18px',
                  background: 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  borderBottom: active ? '2px solid #00D4FF' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                <Icon name={t.icon} size={15} color={active ? '#00D4FF' : 'var(--ink-2)'} />
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>

      <main style={{ padding: '22px 28px 60px', maxWidth: 1600, margin: '0 auto' }}>
        {tab === 'live' && (
          <LiveTracker
            reps={reps}
            feed={feed}
            targets={targets}
            defaultRepId={currentRepId ?? undefined}
            isSuperUser={isSuperUser}
            onDealClosed={handleDealClosed}
          />
        )}
        {tab === 'team' && (
          <TeamPerformance
            reps={reps}
            clients={clients}
            feed={feed}
            targets={targets}
            initialMrr={mrr}
            activeClientCount={activeClientCount}
            onClientUpdated={handleClientUpdated}
          />
        )}
        {tab === 'tasks' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 40, alignItems: 'start' }}>
            <DailyChecklist reps={reps} currentRepId={currentRepId} />
            <TaskTracker reps={reps} currentRepId={currentRepId} notify={notify} />
          </div>
        )}
      </main>
    </div>
  )
}
