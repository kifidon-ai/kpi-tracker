/**
 * Migration 013-018: Normalize schema
 * - Create metrics lookup table
 * - Add rep_id to targets
 * - Link calendar to clients
 * - Restructure closed_deals
 * - Update activity_log_entries
 * - Drop daily_checklist
 */
import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  console.log('Starting schema normalization...')

  // 013 — normalize schema: metrics lookup table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS metrics (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      color VARCHAR(12) NOT NULL
    )
  `)
  console.log('✓ Created metrics table')

  // 014 — add rep_id to targets and update period index
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'targets' AND column_name = 'rep_id'
      ) THEN
        ALTER TABLE targets ADD COLUMN rep_id TEXT REFERENCES reps(id);
      END IF;
    END $$
  `)
  console.log('✓ Added rep_id to targets')

  await db.execute(sql`
    ALTER TABLE targets DROP CONSTRAINT IF EXISTS targets_period_unique
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_targets_rep_period ON targets(rep_id, period)
  `)
  console.log('✓ Updated targets indexes')

  // 015 — add client_id to calendar and remove company_name/monthly_price
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'calendar' AND column_name = 'client_id'
      ) THEN
        ALTER TABLE calendar ADD COLUMN client_id UUID REFERENCES clients(id);
      END IF;
    END $$
  `)
  console.log('✓ Added client_id to calendar')

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_calendar_client ON calendar(client_id)
  `)
  await db.execute(sql`
    ALTER TABLE calendar DROP COLUMN IF EXISTS company_name
  `)
  await db.execute(sql`
    ALTER TABLE calendar DROP COLUMN IF EXISTS monthly_price
  `)
  console.log('✓ Cleaned up calendar table')

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
  console.log('✓ Recreated closed_deals table with proper FKs')

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
  console.log('✓ Cleaned up activity_log_entries table')

  // 018 — drop daily_checklist table
  await db.execute(sql`
    DROP TABLE IF EXISTS daily_checklist CASCADE
  `)
  console.log('✓ Dropped daily_checklist table')

  console.log('\n✅ Schema normalization complete!')
  process.exit(0)
}

run().catch((e) => { console.error('❌ Migration failed:', e); process.exit(1) })
