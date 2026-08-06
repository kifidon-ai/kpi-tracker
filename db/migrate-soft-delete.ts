import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  // 011 — soft-delete column on calendar
  await db.execute(sql`
    ALTER TABLE calendar ADD COLUMN IF NOT EXISTS deleted_at timestamptz
  `)
  console.log('Added deleted_at to calendar')

  // 012 — soft-delete column on activity_log_entries
  await db.execute(sql`
    ALTER TABLE activity_log_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz
  `)
  console.log('Added deleted_at to activity_log_entries')

  console.log('Soft-delete migration complete')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
