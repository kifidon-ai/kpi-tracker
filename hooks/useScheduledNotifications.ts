'use client'

import { useEffect, useRef } from 'react'
import type { SoundType } from './useNotifications'

const SCHEDULE = [
  { hour: 9,  minute: 30, title: 'Lead Management',       body: 'Lead management session — time to work your pipeline', sound: 'activity' as SoundType },
  { hour: 10, minute: 0,  title: 'Prospecting',            body: 'Prospecting block starting — dial up',                 sound: 'activity' as SoundType },
  { hour: 16, minute: 30, title: 'Prospecting Management', body: 'Prospecting management wrap-up',                       sound: 'activity' as SoundType },
]

function getETComponents(date: Date): { hour: number; minute: number; isWeekend: boolean } {
  const weekday = date.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  const [h, m] = timeStr.split(':').map(Number)
  return { hour: h % 24, minute: m, isWeekend: weekday === 'Sat' || weekday === 'Sun' }
}

export function useScheduledNotifications(
  repId: string | null,
  notify: (title: string, body?: string, sound?: SoundType) => void,
) {
  const notifyRef = useRef(notify)
  useEffect(() => { notifyRef.current = notify }, [notify])

  useEffect(() => {
    if (!repId) return

    function check() {
      const { hour, minute, isWeekend } = getETComponents(new Date())
      if (isWeekend) return

      // Use ET date as the dedup key so the fire-once guard resets each day
      const todayKey = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })

      for (const s of SCHEDULE) {
        if (hour === s.hour && minute === s.minute) {
          const key = `ss-sched-${s.title}-${todayKey}`
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1')
            notifyRef.current(s.title, s.body, s.sound)
          }
        }
      }
    }

    check()
    const id = setInterval(check, 45_000) // 45s so we never skip a minute window
    return () => clearInterval(id)
  }, [repId])
}
