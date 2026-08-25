/**
 * Runs schema changes directly via Drizzle when drizzle-kit push is unavailable.
 * Add new migrations as numbered steps below — each step is idempotent.
 */
import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  // 001 — add hour column to activity_daily
  await db.execute(sql`
    ALTER TABLE activity_daily
    ADD COLUMN IF NOT EXISTS hour integer NOT NULL DEFAULT 0
  `)
  await db.execute(sql`
    ALTER TABLE activity_daily
    DROP CONSTRAINT IF EXISTS activity_daily_rep_date
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activity_daily_rep_date_hour'
      ) THEN
        ALTER TABLE activity_daily
        ADD CONSTRAINT activity_daily_rep_date_hour UNIQUE (rep_id, date, hour);
      END IF;
    END $$
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_activity_daily_hour ON activity_daily (hour)
  `)

  // 002 — backfill activity_daily from activity_log_entries
  // Groups raw log entries by rep/date/hour and sets the correct column counts.
  // Uses SET (not ADD) so re-running is idempotent and reflects the true log state.
  await db.execute(sql`
    INSERT INTO activity_daily (rep_id, date, hour, dials, conv, vm, disc, demo, onb, closed)
    SELECT
      rep_id,
      DATE(logged_at AT TIME ZONE 'UTC')                       AS date,
      EXTRACT(HOUR FROM logged_at AT TIME ZONE 'UTC')::int     AS hour,
      COUNT(*) FILTER (WHERE metric_key = 'dials')::int        AS dials,
      COUNT(*) FILTER (WHERE metric_key = 'conv')::int         AS conv,
      COUNT(*) FILTER (WHERE metric_key = 'vm')::int           AS vm,
      COUNT(*) FILTER (WHERE metric_key = 'disc')::int         AS disc,
      COUNT(*) FILTER (WHERE metric_key = 'demo')::int         AS demo,
      COUNT(*) FILTER (WHERE metric_key = 'onb')::int          AS onb,
      COUNT(*) FILTER (WHERE metric_key = 'closed')::int       AS closed
    FROM activity_log_entries
    GROUP BY rep_id,
             DATE(logged_at AT TIME ZONE 'UTC'),
             EXTRACT(HOUR FROM logged_at AT TIME ZONE 'UTC')::int
    ON CONFLICT (rep_id, date, hour) DO UPDATE SET
      dials  = EXCLUDED.dials,
      conv   = EXCLUDED.conv,
      vm     = EXCLUDED.vm,
      disc   = EXCLUDED.disc,
      demo   = EXCLUDED.demo,
      onb    = EXCLUDED.onb,
      closed = EXCLUDED.closed
  `)

  // 003 — add delta column to activity_log_entries
  await db.execute(sql`
    ALTER TABLE activity_log_entries
    ADD COLUMN IF NOT EXISTS delta integer NOT NULL DEFAULT 1
  `)

  // 004 — drop activity_daily (all data now lives in activity_log_entries)
  await db.execute(sql`DROP TABLE IF EXISTS activity_daily CASCADE`)

  // 005 — add is_active column to reps
  await db.execute(sql`
    ALTER TABLE reps ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true
  `)

  // 006 — set is_active based on name
  await db.execute(sql`
    UPDATE reps SET is_active = false
    WHERE name ILIKE '%shary%' OR name ILIKE '%alex%'
  `)
  await db.execute(sql`
    UPDATE reps SET is_active = true
    WHERE name ILIKE '%timmy%' OR name ILIKE '%mujeeb%'
  `)

  // 007 — upsert per_person weekly target row
  await db.execute(sql`
    INSERT INTO targets (id, period, dials, conv, vm, disc, demo, onb, closed)
    VALUES (gen_random_uuid(), 'per_person', 250, 50, 0, 20, 7, 0, 3)
    ON CONFLICT (period) DO UPDATE SET
      dials  = 250,
      conv   = 50,
      vm     = 0,
      disc   = 20,
      demo   = 7,
      onb    = 0,
      closed = 3
  `)

  // 008 — tasks table for kanban task tracker
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'todo',
      assignee_id text REFERENCES reps(id),
      created_by_id text NOT NULL REFERENCES reps(id),
      deadline date,
      position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_id)
  `)

  // 009 — replace single assignee_id with assignee_ids text[]
  await db.execute(sql`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids text[] NOT NULL DEFAULT '{}'
  `)
  await db.execute(sql`
    UPDATE tasks SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND assignee_ids = '{}'
  `)
  await db.execute(sql`
    ALTER TABLE tasks DROP COLUMN IF EXISTS assignee_id
  `)
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_tasks_assignee
  `)

  // 010 — cancel_date on clients (churn; drops from speedometer after this date)
  await db.execute(sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS cancel_date date
  `)

  // 011 — soft-delete column on calendar
  await db.execute(sql`
    ALTER TABLE calendar ADD COLUMN IF NOT EXISTS deleted_at timestamptz
  `)

  // 012 — soft-delete column on activity_log_entries
  await db.execute(sql`
    ALTER TABLE activity_log_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz
  `)

  // 013 — normalize schema: metrics lookup table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS metrics (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      color VARCHAR(12) NOT NULL
    )
  `)

  // 014 — add rep_id to targets and update period index
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'targets' AND column_name = 'rep_id'
      ) THEN
        ALTER TABLE targets ADD COLUMN rep_id TEXT NOT NULL REFERENCES reps(id);
      END IF;
    END $$
  `)
  await db.execute(sql`
    DROP INDEX IF EXISTS targets_period_unique
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_targets_rep_period ON targets(rep_id, period)
  `)

  // 015 — add client_id to calendar and remove company_name/monthly_price
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'calendar' AND column_name = 'client_id'
      ) THEN
        ALTER TABLE calendar ADD COLUMN client_id UUID NOT NULL REFERENCES clients(id);
      END IF;
    END $$
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_calendar_client ON calendar(client_id)
  `)
  await db.execute(sql`
    ALTER TABLE calendar DROP COLUMN IF EXISTS company_name
  `)
  await db.execute(sql`
    ALTER TABLE calendar DROP COLUMN IF EXISTS monthly_price
  `)

  // 016 — recreate closed_deals table with proper FKs
  await db.execute(sql`
    DROP TABLE IF EXISTS closed_deals CASCADE
  `)
  await db.execute(sql`
    CREATE TABLE closed_deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id),
      activity_log_id UUID NOT NULL REFERENCES activity_log_entries(id),
      closed_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_closed_deals_client ON closed_deals(client_id)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_closed_deals_activity_log ON closed_deals(activity_log_id)
  `)

  // 017 — update activity_log_entries to use metrics FK
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_log_entries' AND column_name = 'label'
      ) THEN
        ALTER TABLE activity_log_entries
        DROP COLUMN label,
        DROP COLUMN icon,
        DROP COLUMN color;
      END IF;
    END $$
  `)

  // 018 — drop daily_checklist table
  await db.execute(sql`
    DROP TABLE IF EXISTS daily_checklist CASCADE
  `)

  console.log('Migrations complete')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
