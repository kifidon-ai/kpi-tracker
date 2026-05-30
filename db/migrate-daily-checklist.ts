import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_checklist (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      date_key text NOT NULL,
      item_id text NOT NULL,
      rep_id text NOT NULL REFERENCES reps(id),
      checked_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (date_key, item_id, rep_id)
    )
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_daily_checklist_date ON daily_checklist (date_key)
  `)
  console.log('Done: daily_checklist table ready')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
