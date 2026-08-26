import postgres from 'postgres'
import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import { join } from 'path'

const METRIC_GROUPS = [
  {
    group: 'Top of Funnel',
    items: [
      { k: 'dials',   label: 'Dial logged',          icon: 'phone',     color: '#FF4444' },
      { k: 'gk_conv', label: 'GK Conversation',      icon: 'chat',      color: '#FF8C00' },
      { k: 'dm_conv', label: 'DM Conversation',      icon: 'chat',      color: '#FFA500' },
      { k: 'vm',      label: 'Voicemail logged',     icon: 'voicemail', color: '#5A6685' },
    ],
  },
  {
    group: 'Middle of Funnel',
    items: [
      { k: 'disc', label: 'Discovery booked', icon: 'calendar', color: '#FFD700' },
      { k: 'demo', label: 'Demo booked',      icon: 'present',  color: '#7AA7F5' },
    ],
  },
  {
    group: 'Bottom of Funnel',
    items: [
      { k: 'onb',    label: 'Onboarding',      icon: 'checklist', color: '#3DD6C3' },
      { k: 'closed', label: 'Closed won',      icon: 'trophy',    color: '#00E5A0' },
    ],
  },
]

const ALL_METRICS = METRIC_GROUPS.flatMap((g) => g.items)

function getMetricProperties(metricKey: string) {
  const metric = ALL_METRICS.find(m => m.k === metricKey)
  return metric ? { label: metric.label, icon: metric.icon, color: metric.color } : null
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

async function reimportData() {
  console.log('📥 Re-importing data from last 15 hours...\n')

  // Import calendar meetings first
  console.log('📅 Importing calendar meetings...')
  const meetings: any[] = []
  await new Promise<void>((resolve, reject) => {
    createReadStream(join('db-exports', 'calendar_meetings_recent.csv'))
      .pipe(parse({ columns: true }))
      .on('data', (row) => meetings.push(row))
      .on('end', resolve)
      .on('error', reject)
  })

  let meetingInserted = 0
  let meetingFailed = 0

  if (meetings.length > 0) {
    for (let i = 0; i < meetings.length; i++) {
      const row = meetings[i]
      try {
        const deletedAt = row.deleted_at || null
        const companyName = `Company ${i + 1}`

        await sql`
          INSERT INTO calendar (id, rep_id, company_name, activity_type, scheduled_date, intent, status, reschedule_count, created_at, deleted_at)
          VALUES (${row.id}, ${row.rep_id}, ${companyName}, ${row.activity_type}, ${row.scheduled_date}, ${row.intent}, ${row.status}, ${parseInt(row.reschedule_count) || 0}, ${row.created_at}, ${deletedAt})
          ON CONFLICT (id) DO NOTHING
        `
        meetingInserted++
      } catch (e: any) {
        console.error(`   ❌ Error on meeting ${row.id}: ${e.message}`)
        meetingFailed++
      }
    }
    console.log(`   ✅ Inserted ${meetingInserted} calendar meetings (${meetingFailed} failed)`)

    // Count by type
    const byType = meetings.reduce(
      (acc: any, m: any) => {
        acc[m.activity_type] = (acc[m.activity_type] || 0) + 1
        return acc
      },
      {}
    )
    console.log('      Breakdown:')
    for (const [type, count] of Object.entries(byType)) {
      console.log(`        - ${type}: ${count}`)
    }
  }

  // Import activity log entries
  console.log('\n📝 Importing activity log entries...')
  const activities: any[] = []
  await new Promise<void>((resolve, reject) => {
    createReadStream(join('db-exports', 'activity_log_entries_recent.csv'))
      .pipe(parse({ columns: true }))
      .on('data', (row) => activities.push(row))
      .on('end', resolve)
      .on('error', reject)
  })

  let activityInserted = 0
  let activityFailed = 0

  if (activities.length > 0) {
    const batchSize = 50
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize)

      for (const row of batch) {
        try {
          const metricProps = getMetricProperties(row.metric_key)
          if (!metricProps) {
            console.error(`   ⚠️  Unknown metric: ${row.metric_key}`)
            activityFailed++
            continue
          }

          const calendarId = row.calendar_id || null
          const deletedAt = row.deleted_at || null

          await sql`
            INSERT INTO activity_log_entries (id, rep_id, metric_key, label, icon, color, delta, calendar_id, logged_at, deleted_at)
            VALUES (${row.id}, ${row.rep_id}, ${row.metric_key}, ${metricProps.label}, ${metricProps.icon}, ${metricProps.color}, ${parseInt(row.delta)}, ${calendarId}, ${row.logged_at}, ${deletedAt})
            ON CONFLICT (id) DO NOTHING
          `
          activityInserted++
        } catch (e: any) {
          console.error(`   ❌ Error on row ${row.id}: ${e.message}`)
          activityFailed++
        }
      }
    }
    console.log(`   ✅ Inserted ${activityInserted} activity log entries (${activityFailed} failed)`)
  }

  await sql.end()
  console.log(`\n✨ Re-import complete!`)
  console.log(`   Total records restored: ${meetingInserted + activityInserted}`)
  process.exit(0)
}

reimportData().catch((e) => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
