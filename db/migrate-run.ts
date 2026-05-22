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

  console.log('Migrations complete')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
