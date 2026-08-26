import { db } from '@/db'
import { calendar } from '@/db/schema'
import { gte } from 'drizzle-orm'
import { createWriteStream } from 'fs'
import { stringify } from 'csv-stringify/sync'
import { join } from 'path'

async function exportRecentMeetings() {
  const now = new Date()
  const fifteenHoursAgo = new Date(now.getTime() - 15 * 60 * 60 * 1000)
  const isoTime = fifteenHoursAgo.toISOString()

  console.log(`⏱️  Exporting meetings booked in last 15 hours (since ${isoTime})\n`)

  const meetings = await db
    .select()
    .from(calendar)
    .where(gte(calendar.created_at, isoTime))

  console.log(`📅 Meetings created in last 15 hours:`)
  console.log(`   - Total: ${meetings.length}`)

  // Count by type
  const byType = meetings.reduce((acc, m) => {
    acc[m.activity_type] = (acc[m.activity_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  for (const [type, count] of Object.entries(byType)) {
    console.log(`   - ${type}: ${count}`)
  }

  if (meetings.length > 0) {
    const csv = stringify(meetings, { header: true, columns: Object.keys(meetings[0]) })
    const filepath = join('db-exports', 'calendar_meetings_recent.csv')
    const stream = createWriteStream(filepath)
    stream.write(csv)
    stream.end()

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve())
      stream.on('error', reject)
    })

    console.log(`\n✨ Saved to db-exports/calendar_meetings_recent.csv`)
  } else {
    console.log(`\n⚠️  No meetings created in the last 15 hours`)
  }

  process.exit(0)
}

exportRecentMeetings().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
