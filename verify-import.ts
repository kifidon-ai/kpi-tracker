import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

async function verify() {
  try {
    // Check activity log counts
    const activityResult = await sql`
      SELECT COUNT(*) as total FROM activity_log_entries
    `
    console.log(`✅ Activity log entries: ${activityResult[0].total}`)

    // Check calendar counts
    const calendarResult = await sql`
      SELECT COUNT(*) as total FROM calendar
    `
    console.log(`✅ Calendar entries: ${calendarResult[0].total}`)

    // Check recent activities
    const recent = await sql`
      SELECT COUNT(*) as total
      FROM activity_log_entries
      WHERE logged_at >= now() - interval '20 hours'
    `
    console.log(`✅ Recent activities (last 20 hrs): ${recent[0].total}`)

    // Check calendar by type
    const byType = await sql`
      SELECT activity_type, COUNT(*) as count
      FROM calendar
      ORDER BY created_at DESC
      LIMIT 10
    `
    console.log('\n📅 Recent meetings by type:')
    for (const row of byType) {
      console.log(`   ${row.activity_type}: ${row.count}`)
    }

    // Check for calendar meetings with company names
    const meetings = await sql`
      SELECT id, company_name, activity_type, created_at
      FROM calendar
      WHERE created_at >= now() - interval '20 hours'
      ORDER BY created_at DESC
    `
    console.log(`\n📝 Recent calendar meetings (${meetings.length}):`)
    for (const m of meetings) {
      console.log(`   ${m.activity_type}: ${m.company_name}`)
    }

    await sql.end()
  } catch (e: any) {
    console.error('Error:', e.message)
    process.exit(1)
  }
}

verify()
