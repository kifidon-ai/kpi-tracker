import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

async function check() {
  try {
    // Get calendar table structure
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'calendar'
      ORDER BY ordinal_position
    `

    console.log('📋 Calendar table columns:')
    columns.forEach((col: any) => {
      console.log(`   - ${col.column_name}: ${col.data_type}`)
    })

    // Check if company_name exists
    const hasCompanyName = columns.some((col: any) => col.column_name === 'company_name')
    console.log(hasCompanyName ? '\n✅ company_name is BACK!' : '\n❌ company_name still missing')

    // Get sample data
    const samples = await sql`SELECT * FROM calendar LIMIT 3`
    console.log('\n📝 Sample row:')
    if (samples.length > 0) {
      console.log(JSON.stringify(samples[0], null, 2))
    }

    await sql.end()
    process.exit(0)
  } catch (e: any) {
    console.error('Error:', e.message)
    process.exit(1)
  }
}

check()
