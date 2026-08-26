import { db } from '@/db'
import { calendar } from '@/db/schema'
import { sql, isNull } from 'drizzle-orm'

async function check() {
  // Check if calendar table has data
  const calendarCount = await db.select({ count: sql<number>`count(*)::int` }).from(calendar)
  console.log(`📅 Total calendar events: ${calendarCount[0].count}`)

  // Get sample meetings to check structure
  const samples = await db.select().from(calendar).limit(3)
  console.log('\n📋 Sample meetings:')
  console.log(JSON.stringify(samples, null, 2))

  // Check columns
  const columns = Object.keys(samples[0] || {})
  console.log('\n🔍 Available columns:')
  columns.forEach(col => console.log(`   - ${col}`))

  // Check if company_name is back
  if (columns.includes('company_name')) {
    console.log('\n✅ company_name column is BACK!')
  } else {
    console.log('\n❌ company_name column still missing')
  }

  process.exit(0)
}

check().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
