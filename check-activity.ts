import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

async function check() {
  try {
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'activity_log_entries'
      ORDER BY ordinal_position
    `

    console.log('📋 activity_log_entries table columns:')
    columns.forEach((col: any) => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })

    const samples = await sql`SELECT * FROM activity_log_entries LIMIT 1`
    if (samples.length > 0) {
      console.log('\n📝 Sample row:')
      console.log(JSON.stringify(samples[0], null, 2))
    }

    await sql.end()
  } catch (e: any) {
    console.error('Error:', e.message)
    process.exit(1)
  }
}

check()
