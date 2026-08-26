import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

async function check() {
  try {
    // Check when calendar data is from
    const result = await sql`
      SELECT COUNT(*) as total, MIN(created_at) as oldest, MAX(created_at) as newest
      FROM calendar
    `
    console.log('Calendar table stats:')
    console.log(`  Total entries: ${result[0].total}`)
    console.log(`  Oldest: ${result[0].oldest}`)
    console.log(`  Newest: ${result[0].newest}`)

    // Check 10 most recent
    const recent = await sql`
      SELECT id, company_name, activity_type, created_at
      FROM calendar
      ORDER BY created_at DESC
      LIMIT 10
    `
    console.log('\n10 most recent calendar entries:')
    for (const r of recent) {
      console.log(`  ${r.activity_type}: ${r.company_name} (${r.created_at})`)
    }

    await sql.end()
  } catch (e: any) {
    console.error('Error:', e.message)
    process.exit(1)
  }
}

check()
