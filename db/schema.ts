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
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name:        text('name').notNull(),
  plan:        text('plan').notNull().default('Starter'),
  mrr:         integer('mrr').notNull().default(0),
  since_date:  date('since_date').notNull().default(sql`CURRENT_DATE`),
  cancel_date: date('cancel_date'),
  owner_id:    text('owner_id').notNull().references(() => reps.id),
  status:      text('status').notNull().default('active'),
  created_at:  timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

export const activity_log_entries = pgTable('activity_log_entries', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  rep_id:      text('rep_id').notNull().references(() => reps.id),
  metric_key:  text('metric_key').notNull(),
  label:       text('label').notNull(),
  icon:        text('icon').notNull(),
  color:       varchar('color', { length: 12 }).notNull(),
  delta:       integer('delta').notNull().default(1),
  calendar_id: uuid('calendar_id').references(() => calendar.id),
  logged_at:   timestamp('logged_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => [
  index('idx_log_entries_rep').on(t.rep_id),
  index('idx_log_entries_logged_at').on(t.logged_at),
  index('idx_log_entries_calendar').on(t.calendar_id),
])

export const targets = pgTable('targets', {
  id:       uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  period:   text('period').notNull().unique(),
  dials:    integer('dials').notNull().default(0),
  dm_conv:  integer('dm_conv').notNull().default(0),
  vm:       integer('vm').notNull().default(0),
  disc:     integer('disc').notNull().default(0),
  demo:     integer('demo').notNull().default(0),
  onb:      integer('onb').notNull().default(0),
  closed:   integer('closed').notNull().default(0),
})

export const closed_deals = pgTable('closed_deals', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  rep_id:        text('rep_id').references(() => reps.id),
  company_name:  text('company_name').notNull(),
  monthly_price: doublePrecision('monthly_price').notNull().default(0),
  closed_date:   date('closed_date').notNull().default(sql`CURRENT_DATE`),
  created_at:    timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

export const calendar = pgTable('calendar', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  rep_id:           text('rep_id').references(() => reps.id),
  company_name:     text('company_name').notNull(),
  activity_type:    text('activity_type').notNull(),
  scheduled_date:   date('scheduled_date').notNull(),
  intent:           text('intent').notNull().default('medium'),
  status:           text('status').notNull().default('scheduled'),
  reschedule_count: integer('reschedule_count').notNull().default(0),
  created_at:       timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => [
  index('idx_calendar_rep').on(t.rep_id),
  index('idx_calendar_date').on(t.scheduled_date),
])

export const daily_checklist = pgTable('daily_checklist', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  date_key:   text('date_key').notNull(),
  item_id:    text('item_id').notNull(),
  rep_id:     text('rep_id').notNull().references(() => reps.id),
  checked_at: timestamp('checked_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => [
  index('idx_daily_checklist_date').on(t.date_key),
])

export const tasks = pgTable('tasks', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title:          text('title').notNull(),
  description:    text('description'),
  status:         text('status').notNull().default('todo'),
  assignee_ids:   text('assignee_ids').array().notNull().default(sql`'{}'::text[]`),
  created_by_id:  text('created_by_id').notNull().references(() => reps.id),
  deadline:       date('deadline'),
  position:       integer('position').notNull().default(0),
  created_at:     timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updated_at:     timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (t) => [
  index('idx_tasks_status').on(t.status),
])
