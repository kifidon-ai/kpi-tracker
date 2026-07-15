import type { ActivityLogEntry, Client, Totals } from './types'

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

/** True if client was onboarded on/before asOf and had not cancelled yet. */
export function isClientActiveAsOf(c: Pick<Client, 'since_date' | 'cancel_date'>, asOf: string): boolean {
  if (!c.since_date || (c.since_date as string) > asOf) return false
  if (c.cancel_date && (c.cancel_date as string) <= asOf) return false
  return true
}

/** True if the client had any active days within [startISO, endISO]. */
export function isClientActiveDuringPeriod(
  c: Pick<Client, 'since_date' | 'cancel_date'>,
  startISO: string,
  endISO: string,
): boolean {
  if (!c.since_date || (c.since_date as string) > endISO) return false
  if (c.cancel_date && (c.cancel_date as string) < startISO) return false
  return true
}

/** Complete billing months from since_date through asOf (minimum 1 if active on asOf). */
export function fullMonthsActive(
  sinceDate: string,
  asOf: string,
  cancelDate?: string | null,
): number {
  const end = cancelDate && cancelDate <= asOf ? cancelDate : asOf
  if (!sinceDate || end < sinceDate) return 0

  const start = new Date(sinceDate + 'T00:00')
  const endD = new Date(end + 'T00:00')

  let months = 0
  const cursor = new Date(start)
  while (true) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
    if (next > endD) break
    months++
    cursor.setTime(next.getTime())
  }

  return Math.max(months, 1)
}

/** Cumulative subscription value: MRR × full months active through asOf. */
export function clientRevenueContribution(
  c: Pick<Client, 'since_date' | 'cancel_date' | 'mrr'>,
  asOf: string,
): number {
  if (!c.since_date || !isClientActiveAsOf(c, asOf)) return 0
  return c.mrr * fullMonthsActive(c.since_date as string, asOf, c.cancel_date)
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
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  const start = new Date(today.getFullYear(), today.getMonth() - offset, 1)
  const end = new Date(today.getFullYear(), today.getMonth() - offset + 1, 0)
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

export function getTodayKeyET(): string {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

/** ISO timestamp for 11:59 PM Eastern on a calendar date (for backdating activity logs). */
export function loggedAtEndOfDayET(dateISO: string): string {
  const offsetPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(`${dateISO}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-05:00'
  const offset = offsetPart.replace('GMT', '')
  return `${dateISO}T23:59:00${offset}`
}
