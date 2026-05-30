'use client'

import { useState, useEffect } from 'react'

export type SoundType = 'activity' | 'deal' | 'task'

function playChime(type: SoundType) {
  try {
    const ctx = new AudioContext()

    function note(freq: number, offset: number, duration: number, vol: number) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + offset
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(vol, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
      osc.start(t)
      osc.stop(t + duration)
    }

    if (type === 'deal') {
      // Triumphant: C5 → E5 → G5
      note(523.25, 0,    0.5, 0.30)
      note(659.25, 0.13, 0.5, 0.30)
      note(783.99, 0.26, 0.7, 0.35)
    } else if (type === 'activity') {
      // Rising two-tone: E5 → G5
      note(659.25, 0,    0.4, 0.25)
      note(783.99, 0.16, 0.5, 0.25)
    } else {
      // Single soft ding: A4
      note(440, 0, 0.6, 0.18)
    }

    setTimeout(() => ctx.close(), 2000)
  } catch {}
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    setPermission(Notification.permission)
    setSoundEnabled(localStorage.getItem('ss-sound') !== 'off')
  }, [])

  async function requestPermission() {
    if (typeof Notification === 'undefined') return 'denied' as NotificationPermission
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev
      localStorage.setItem('ss-sound', next ? 'on' : 'off')
      return next
    })
  }

  function notify(title: string, body?: string, sound?: SoundType) {
    if (soundEnabled && sound) playChime(sound)
    if (permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico', silent: true })
      } catch {}
    }
  }

  return { permission, requestPermission, notify, soundEnabled, toggleSound }
}
