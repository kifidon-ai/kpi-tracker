import { db } from '@/db'
import { calendar, clients } from '@/db/schema'
import { isNull, sql } from 'drizzle-orm'

async function check() {
  // Check calendar events
  const calendarRows = await db.select({
    id: calendar.id,
    client_id: calendar.client_id,
    activity_type: calendar.activity_type,
    scheduled_date: calendar.scheduled_date,
  }).from(calendar).where(isNull(calendar.deleted_at)).limit(5)

  console.log('\n📅 Sample Calendar Events:')
  console.log(JSON.stringify(calendarRows, null, 2))

  // Check if client_ids exist in clients table
  console.log('\n🔍 Checking Client IDs...')
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(calendar).where(isNull(calendar.client_id))
  console.log('Events with NULL client_id:', result[0].count)

  const totalEvents = await db.select({ count: sql<number>`count(*)::int` }).from(calendar)
  console.log('Total events:', totalEvents[0].count)

  // Check clients table
  const clientCountResult = await db.select({ count: sql<number>`count(*)::int` }).from(clients)
  console.log('\nTotal clients:', clientCountResult[0].count)

  const sampleClients = await db.select().from(clients).limit(3)
  console.log('\nSample Clients:')
  console.log(JSON.stringify(sampleClients, null, 2))

  process.exit(0)
}

check().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
