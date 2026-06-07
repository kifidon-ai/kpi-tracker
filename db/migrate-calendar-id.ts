import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  await db.execute(sql`
    ALTER TABLE activity_log_entries
    ADD COLUMN calendar_id uuid REFERENCES calendar(id)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_log_entries_calendar ON activity_log_entries (calendar_id)
  `)
  console.log('Added calendar_id to activity_log_entries')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
