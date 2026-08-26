import { db } from '@/db'
import { clients } from '@/db/schema'
import { sql } from 'drizzle-orm'

async function count() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(clients)
  console.log(`📊 Total clients: ${result[0].count}`)
  process.exit(0)
}

count().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
