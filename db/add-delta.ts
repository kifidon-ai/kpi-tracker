import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  await db.execute(sql`
    ALTER TABLE activity_log_entries
    ADD COLUMN IF NOT EXISTS delta integer NOT NULL DEFAULT 1
  `)
  console.log('Done: delta column added')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
