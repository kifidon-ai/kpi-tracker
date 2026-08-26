import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

const meetingIds = [
  '0726caeb-815c-4c82-93d9-9f5cc2ea6945',
  '35d53e33-6b33-4ad5-a28b-f91e9bc78dc4',
  '4c7fb48a-098a-4ab2-8de8-60b0d03bebfc',
  '4e4289e5-855e-42b5-a004-66935f8de433',
  '9d9c9c67-0eec-4dc0-bf8b-3a681d2022bd',
  'a84205fb-1904-4362-9627-6f05e89a9107',
  'b7995415-2546-450f-917d-bff95cb94b90',
  'bfa15a7c-2438-47bd-9a0c-228492258e62',
  'ce565d4b-bdbe-48a6-b5a1-5ce6872bf3c6',
  'e9342b5f-0938-4239-87c1-87defae0d552',
]

async function getMeetings() {
  try {
    // Get meetings from calendar table
    console.log('id,rep_id,company_name,activity_type,scheduled_date,intent,status,reschedule_count,created_at,deleted_at')

    for (const id of meetingIds) {
      const result = await sql`
        SELECT id, rep_id, company_name, activity_type, scheduled_date, intent, status, reschedule_count, created_at, deleted_at
        FROM calendar
        WHERE id = ${id}
      `

      if (result.length > 0) {
        const m = result[0]
        const parts = [
          m.id,
          m.rep_id,
          m.company_name ? `"${String(m.company_name).replace(/"/g, '""')}"` : '',
          m.activity_type,
          m.scheduled_date,
          m.intent,
          m.status,
          m.reschedule_count,
          m.created_at,
          m.deleted_at || ''
        ]
        console.log(parts.join(','))
      } else {
        console.error(`// Meeting ${id} not found`)
      }
    }

    await sql.end()
  } catch (e: any) {
    console.error('Error:', e.message)
    process.exit(1)
  }
}

getMeetings()
