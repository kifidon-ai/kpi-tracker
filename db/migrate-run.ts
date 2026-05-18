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

  console.log('Migrations complete')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
