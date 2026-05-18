'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Rep, Client, ActivityDaily, ActivityLogEntry, Target } from '@/lib/types'
import { fmtMoney } from '@/lib/helpers'
import { Icon } from './ui/Icon'
import { LiveTracker } from './LiveTracker'
import { TeamPerformance } from './TeamPerformance'
import { createClient } from '@/utils/supabase/client'

interface ShellProps {
  reps: Rep[]
  clients: Client[]
  activity: ActivityDaily[]
  feed: ActivityLogEntry[]
  targets: Target[]
}

type Tab = 'live' | 'team'

export function Shell({ reps, clients, activity, feed, targets }: ShellProps) {
  const [tab, setTab] = useState<Tab>('live')
  const router = useRouter()

  const mrr = clients.filter((c) => c.status === 'active').reduce((s, c) => s + c.mrr, 0)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  const activeClientCount = clients.filter((c) => c.status === 'active').length

  const dailyTarget = targets.find((t) => t.period === 'daily') ?? null

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'live', label: 'Live tracker',     icon: 'log' },
    { id: 'team', label: 'Team performance', icon: 'team' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1)' }}>
      <header style={{
        padding: '18px 28px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        borderBottom: '1px solid #1E2538',
        position: 'sticky',
        top: 0,
        background: 'rgba(10,14,26,0.92)',
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
              <div style={{ fontSize: 11, color: '#5A6685', fontFamily: 'JetBrains Mono, monospace' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: '8px 14px', background: '#0F1422', border: '1px solid #1E2538', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#8B95B2' }}>MRR</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#00E5A0' }}>{fmtMoney(mrr)}</span>
            </div>
            <button
              onClick={signOut}
              style={{ padding: '8px 14px', background: '#0F1422', border: '1px solid #1E2538', borderRadius: 8, fontSize: 12, color: '#5A6685', fontWeight: 600 }}
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
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 18px',
                  background: 'transparent',
                  color: active ? '#fff' : '#8B95B2',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  borderBottom: active ? '2px solid #00D4FF' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                <Icon name={t.icon} size={15} color={active ? '#00D4FF' : '#8B95B2'} />
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
            initialFeed={feed}
            dailyTarget={dailyTarget}
          />
        )}
        {tab === 'team' && (
          <TeamPerformance
            reps={reps}
            activity={activity}
            targets={targets}
            initialMrr={mrr}
            activeClientCount={activeClientCount}
          />
        )}
      </main>
    </div>
  )
}
