import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  await db.execute(sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS cancel_date date
  `)
  console.log('cancel_date column ready on clients')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
