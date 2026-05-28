import { pgTable, text, varchar, integer, doublePrecision, date, timestamp, uuid, index, boolean } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Use snake_case field names so InferSelectModel matches existing component code

export const reps = pgTable('reps', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  initials:    varchar('initials', { length: 4 }).notNull(),
  color:       varchar('color', { length: 12 }).notNull(),
  joined_date: date('joined_date'),
  role:        text('role').notNull().default('SDR'),
  created_at:  timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  user_id:     uuid('user_id').unique(),
  is_active:   boolean('is_active').notNull().default(true),
})

export const clients = pgTable('clients', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name:       text('name').notNull(),
  plan:       text('plan').notNull().default('Starter'),
  mrr:        integer('mrr').notNull().default(0),
  since_date: date('since_date').notNull().default(sql`CURRENT_DATE`),
  owner_id:   text('owner_id').notNull().references(() => reps.id),
  status:     text('status').notNull().default('active'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

export const activity_log_entries = pgTable('activity_log_entries', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  rep_id:     text('rep_id').notNull().references(() => reps.id),
  metric_key: text('metric_key').notNull(),
  label:      text('label').notNull(),
  icon:       text('icon').notNull(),
  color:      varchar('color', { length: 12 }).notNull(),
  delta:      integer('delta').notNull().default(1),
  logged_at:  timestamp('logged_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => [
  index('idx_log_entries_rep').on(t.rep_id),
  index('idx_log_entries_logged_at').on(t.logged_at),
])

export const targets = pgTable('targets', {
  id:     uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  period: text('period').notNull().unique(),
  dials:  integer('dials').notNull().default(0),
  conv:   integer('conv').notNull().default(0),
  vm:     integer('vm').notNull().default(0),
  disc:   integer('disc').notNull().default(0),
  demo:   integer('demo').notNull().default(0),
  onb:    integer('onb').notNull().default(0),
  closed: integer('closed').notNull().default(0),
})

export const closed_deals = pgTable('closed_deals', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  rep_id:        text('rep_id').references(() => reps.id),
  company_name:  text('company_name').notNull(),
  monthly_price: doublePrecision('monthly_price').notNull().default(0),
  closed_date:   date('closed_date').notNull().default(sql`CURRENT_DATE`),
  created_at:    timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})
