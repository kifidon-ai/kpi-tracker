import { db } from '@/db'
import { calendar } from '@/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

async function getDemosThisWeek() {
  // Get this week's Monday to Sunday
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay()
  const daysFromMonday = dow === 0 ? 6 : dow - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysFromMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  const mondayISO = monday.toISOString().split('T')[0]
  const sundayISO = sunday.toISOString().split('T')[0]
  
  console.log(`Querying for demos from ${mondayISO} to ${sundayISO}`)
  
  const demos = await db
    .select()
    .from(calendar)
    .where(and(
      eq(calendar.activity_type, 'demo'),
      gte(calendar.scheduled_date, mondayISO),
      lte(calendar.scheduled_date, sundayISO)
    ))
  
  return demos
}

getDemosThisWeek().then(demos => {
  console.log(`\nDemos scheduled this week: ${demos.length}`)
  demos.forEach(d => {
    console.log(`- ${d.company_name} (${d.scheduled_date}) - Rep: ${d.rep_id} - Status: ${d.status}`)
  })
})
