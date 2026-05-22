import type { ActivityLogEntry, Totals } from './types'

export function aggregate(entries: ActivityLogEntry[]): Totals {
  const t: Totals = { dials: 0, conv: 0, vm: 0, disc: 0, demo: 0, onb: 0, closed: 0 }
  for (const e of entries) {
    const d = e.delta
    if (e.metric_key in t) (t as unknown as Record<string, number>)[e.metric_key] += d
  }
  return t
}

export function inRange(dateStr: string, range: string): boolean {
  const d = new Date(dateStr + 'T00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (range === 'day') {
    return d.toDateString() === today.toDateString()
  }
  if (range === 'week') {
    const start = new Date(today)
    const daysFromMonday = today.getDay() === 0 ? 6 : today.getDay() - 1
    start.setDate(today.getDate() - daysFromMonday)
    return d >= start && d <= today
  }
  if (range === 'month') {
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && d <= today
  }
  return true
}

export function fmtMoney(n: number): string {
  return '$' + n.toLocaleString() + ' USD'
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

export function pct(a: number, b: number): number {
  if (!b) return 0
  return (a / b) * 100
}

export type LiveRange = 'day' | 'week' | 'month'

export function getPeriodBounds(range: LiveRange, offset: number): { start: Date; end: Date } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (range === 'day') {
    const d = new Date(today)
    d.setDate(today.getDate() - offset)
    return { start: d, end: d }
  }
  if (range === 'week') {
    const dow = today.getDay()
    const daysFromMonday = dow === 0 ? 6 : dow - 1
    const thisMonday = new Date(today)
    thisMonday.setDate(today.getDate() - daysFromMonday)
    const start = new Date(thisMonday)
    start.setDate(thisMonday.getDate() - offset * 7)
    const end = offset === 0 ? new Date(today) : new Date(start)
    if (offset > 0) end.setDate(start.getDate() + 6)
    return { start, end }
  }
  const start = new Date(today.getFullYear(), today.getMonth() - offset, 1)
  const end = offset === 0
    ? new Date(today)
    : new Date(today.getFullYear(), today.getMonth() - offset + 1, 0)
  return { start, end }
}

export function getPeriodLabel(range: LiveRange, offset: number, b: { start: Date; end: Date }): string {
  if (range === 'day') {
    if (offset === 0) return 'Today'
    if (offset === 1) return 'Yesterday'
    return b.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  if (range === 'week') {
    if (offset === 0) return 'This week'
    const s = b.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = b.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${s} – ${e}`
  }
  if (offset === 0) return 'This month'
  return b.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function relativeTime(iso: string): string {
  const now = new Date()
  const t = new Date(iso)
  const diff = Math.round((now.getTime() - t.getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return diff + 'm ago'
  const h = Math.floor(diff / 60)
  if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24)
  return d + 'd ago'
}
