import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

async function check() {
  try {
    const cols = await sql`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'calendar'
      AND column_name IN ('company_name', 'client_id', 'activity_type')
      ORDER BY ordinal_position
    `

    console.log('Calendar schema columns:')
    for (const c of cols) {
      console.log(`  ${c.column_name}: nullable=${c.is_nullable}, default=${c.column_default}`)
    }

    await sql.end()
  } catch (e: any) {
    console.error('Error:', e.message)
    process.exit(1)
  }
}

check()
