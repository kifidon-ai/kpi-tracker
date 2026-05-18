import type { ActivityDaily, Totals } from './types'

export function aggregate(rows: ActivityDaily[]): Totals {
  return rows.reduce(
    (a, r) => ({
      dials:  a.dials  + r.dials,
      conv:   a.conv   + r.conv,
      vm:     a.vm     + r.vm,
      disc:   a.disc   + r.disc,
      demo:   a.demo   + r.demo,
      onb:    a.onb    + r.onb,
      closed: a.closed + r.closed,
    }),
    { dials: 0, conv: 0, vm: 0, disc: 0, demo: 0, onb: 0, closed: 0 },
  )
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
    start.setDate(today.getDate() - 6)
    return d >= start && d <= today
  }
  if (range === 'month') {
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }
  return true
}

export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K'
  return '$' + n.toLocaleString()
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

export function pct(a: number, b: number): number {
  if (!b) return 0
  return (a / b) * 100
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
