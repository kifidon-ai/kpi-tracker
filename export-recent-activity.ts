import { db } from '@/db'
import { activity_log_entries, closed_deals, tasks } from '@/db/schema'
import { gte, sql } from 'drizzle-orm'
import { createWriteStream } from 'fs'
import { stringify } from 'csv-stringify/sync'
import { join } from 'path'

async function exportRecentActivity() {
  const now = new Date()
  const fifteenHoursAgo = new Date(now.getTime() - 15 * 60 * 60 * 1000)
  const isoTime = fifteenHoursAgo.toISOString()

  console.log(`⏱️  Exporting activity from the last 15 hours (since ${isoTime})\n`)

  const outputDir = 'db-exports'

  // Export activity log entries
  const activities = await db
    .select()
    .from(activity_log_entries)
    .where(gte(activity_log_entries.logged_at, isoTime))

  console.log(`  📝 activity_log_entries: ${activities.length} rows`)
  if (activities.length > 0) {
    const csv = stringify(activities, { header: true, columns: Object.keys(activities[0]) })
    const filepath = join(outputDir, 'activity_log_entries_recent.csv')
    const stream = createWriteStream(filepath)
    stream.write(csv)
    stream.end()
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve())
      stream.on('error', reject)
    })
  }

  // Export closed deals
  const deals = await db
    .select()
    .from(closed_deals)
    .where(gte(closed_deals.created_at, isoTime))

  console.log(`  🎯 closed_deals: ${deals.length} rows`)
  if (deals.length > 0) {
    const csv = stringify(deals, { header: true, columns: Object.keys(deals[0]) })
    const filepath = join(outputDir, 'closed_deals_recent.csv')
    const stream = createWriteStream(filepath)
    stream.write(csv)
    stream.end()
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve())
      stream.on('error', reject)
    })
  }

  // Export tasks
  const tasksList = await db
    .select()
    .from(tasks)
    .where(gte(tasks.updated_at, isoTime))

  console.log(`  ✅ tasks: ${tasksList.length} rows`)
  if (tasksList.length > 0) {
    const csv = stringify(tasksList, { header: true, columns: Object.keys(tasksList[0]) })
    const filepath = join(outputDir, 'tasks_recent.csv')
    const stream = createWriteStream(filepath)
    stream.write(csv)
    stream.end()
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve())
      stream.on('error', reject)
    })
  }

  console.log(`\n✨ Recent activity exported! Total: ${activities.length + deals.length + tasksList.length} records`)
  console.log(`📁 Saved to db-exports/`)
  process.exit(0)
}

exportRecentActivity().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
