import type { InferSelectModel } from 'drizzle-orm'
import type {
  reps,
  clients,
  activity_daily,
  activity_log_entries,
  targets,
  closed_deals,
} from '@/db/schema'

export type Rep             = InferSelectModel<typeof reps>
export type Client          = InferSelectModel<typeof clients>
export type ActivityDaily   = InferSelectModel<typeof activity_daily>
export type ActivityLogEntry = InferSelectModel<typeof activity_log_entries>
export type Target          = InferSelectModel<typeof targets>
export type ClosedDeal      = InferSelectModel<typeof closed_deals>

export interface Totals {
  dials:  number
  conv:   number
  vm:     number
  disc:   number
  demo:   number
  onb:    number
  closed: number
}

export interface MetricDef {
  k:     string
  label: string
  short: string
  icon:  string
  color: string
}

export interface MetricGroup {
  group: string
  items: MetricDef[]
}

export type CountsByRep  = Record<string, Record<string, number>>
export type RangeOption  = 'day' | 'week' | 'month' | 'all'
