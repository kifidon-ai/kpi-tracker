import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

async function verify() {
  try {
    const activities = await sql`
      SELECT COUNT(*) as count FROM activity_log_entries
      WHERE logged_at >= now() - interval '20 hours'
    `
    
    const meetings = await sql`
      SELECT COUNT(*) as count FROM calendar
      WHERE created_at >= now() - interval '20 hours'
    `

    const recentMeetings = await sql`
      SELECT company_name, activity_type
      FROM calendar
      WHERE created_at >= now() - interval '20 hours'
      ORDER BY created_at DESC
    `

    console.log('✨ DATA RESTORED SUCCESSFULLY')
    console.log(`   📊 Activity log entries (last 20 hrs): ${activities[0].count}`)
    console.log(`   📅 Calendar meetings (last 20 hrs): ${meetings[0].count}`)
    
    if (recentMeetings.length > 0) {
      console.log('\n   Recent meetings:')
      for (const m of recentMeetings) {
        console.log(`     • ${m.activity_type}: ${m.company_name}`)
      }
    }

    await sql.end()
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

verify()
