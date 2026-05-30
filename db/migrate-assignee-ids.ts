import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
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
  console.log('Done: assignee_id → assignee_ids[]')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
