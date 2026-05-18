export interface Rep {
  id: string
  name: string
  initials: string
  color: string
  joined_date: string | null
  role: string
}

export interface Client {
  id: string
  name: string
  plan: 'Starter' | 'Growth' | 'Scale'
  mrr: number
  since_date: string
  owner_id: string
  status: 'active' | 'trial'
}

export interface ActivityDaily {
  id: string
  rep_id: string
  date: string
  dials: number
  conv: number
  vm: number
  disc: number
  demo: number
  onb: number
  closed: number
}

export interface ActivityLogEntry {
  id: string
  rep_id: string
  metric_key: string
  label: string
  icon: string
  color: string
  logged_at: string
}

export interface Target {
  id: string
  period: 'daily' | 'weekly' | 'monthly'
  dials: number
  conv: number
  vm: number
  disc: number
  demo: number
  onb: number
  closed: number
}

export interface Totals {
  dials: number
  conv: number
  vm: number
  disc: number
  demo: number
  onb: number
  closed: number
}

export interface MetricDef {
  k: string
  label: string
  short: string
  icon: string
  color: string
}

export interface MetricGroup {
  group: string
  items: MetricDef[]
}

// Counts keyed by rep id then metric key
export type CountsByRep = Record<string, Record<string, number>>

export type RangeOption = 'day' | 'week' | 'month' | 'all'
