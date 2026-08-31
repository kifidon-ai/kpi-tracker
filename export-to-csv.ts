import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'
import postgres from 'postgres'
import { stringify } from 'csv-stringify/sync'

const DATABASE_URL = process.env.DATABASE_URL!

async function exportAllTablesToCSV() {
  const sql = postgres(DATABASE_URL, { prepare: false })
  const outputDir = join(process.cwd(), 'db-exports')

  try {
    mkdirSync(outputDir, { recursive: true })
    console.log(`📁 Export directory: ${outputDir}\n`)

    // Get all tables from public schema
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `

    console.log(`Found ${tables.length} tables to export:\n`)

    for (const { table_name } of tables) {
      try {
        // Get all data from table
        const rows = await sql.unsafe(`SELECT * FROM "${table_name}"`)

        if (rows.length === 0) {
          console.log(`  ⏭️  ${table_name} (0 rows - skipped)`)
          continue
        }

        // Convert to CSV
        const csv = stringify(rows, {
          header: true,
          columns: Object.keys(rows[0] || {}),
        })

        // Write to file
        const filename = `${table_name}.csv`
        const filepath = join(outputDir, filename)
        const stream = createWriteStream(filepath)

        stream.write(csv)
        stream.end()

        await new Promise((resolve, reject) => {
          stream.on('finish', resolve)
          stream.on('error', reject)
        })

        console.log(`  ✅ ${table_name} (${rows.length} rows) → ${filename}`)
      } catch (error) {
        console.error(`  ❌ ${table_name} failed:`, error)
      }
    }

    console.log(`\n✨ Export complete! All CSV files saved to ${outputDir}`)
  } catch (error) {
    console.error('Export failed:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

exportAllTablesToCSV()
