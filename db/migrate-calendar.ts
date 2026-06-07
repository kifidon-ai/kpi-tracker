import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS calendar (
      id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      rep_id           text        REFERENCES reps(id),
      company_name     text        NOT NULL,
      activity_type    text        NOT NULL,
      scheduled_date   date        NOT NULL,
      intent           text        NOT NULL DEFAULT 'medium',
      status           text        NOT NULL DEFAULT 'scheduled',
      reschedule_count integer     NOT NULL DEFAULT 0,
      created_at       timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_calendar_rep  ON calendar (rep_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar (scheduled_date)`)
  console.log('Calendar table ready')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
