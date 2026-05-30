import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
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
  console.log('Tasks table ready')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
