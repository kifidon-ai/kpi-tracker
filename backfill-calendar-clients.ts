import { db } from '@/db'
import { calendar, clients } from '@/db/schema'
import { eq, isNull } from 'drizzle-orm'

async function backfillCalendarClients() {
  console.log('🔄 Backfilling calendar client_ids...\n')

  // Get all calendar events with null client_id, grouped by rep_id
  const nullClientEvents = await db
    .select({
      id: calendar.id,
      rep_id: calendar.rep_id,
      activity_type: calendar.activity_type,
      scheduled_date: calendar.scheduled_date,
    })
    .from(calendar)
    .where(isNull(calendar.client_id))

  console.log(`Found ${nullClientEvents.length} events with null client_id\n`)

  // Group by rep_id
  const eventsByRep = new Map<string, typeof nullClientEvents>()
  for (const event of nullClientEvents) {
    if (!eventsByRep.has(event.rep_id)) {
      eventsByRep.set(event.rep_id, [])
    }
    eventsByRep.get(event.rep_id)!.push(event)
  }

  // For each rep, get their clients
  let updated = 0
  for (const [repId, events] of eventsByRep) {
    const repClients = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.owner_id, repId))

    if (repClients.length === 0) {
      console.log(`⚠️  Rep ${repId}: No clients owned by this rep (${events.length} events skipped)`)
      continue
    }

    // Round-robin assign events to this rep's clients
    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      const clientIdx = i % repClients.length
      const clientId = repClients[clientIdx].id
      const clientName = repClients[clientIdx].name

      await db
        .update(calendar)
        .set({ client_id: clientId })
        .where(eq(calendar.id, event.id))

      updated++
    }

    console.log(
      `✅ Rep ${repId.slice(0, 8)}: Linked ${events.length} events to ${repClients.length} client(s)`
    )
  }

  console.log(`\n✨ Backfill complete! Updated ${updated} calendar events`)
  process.exit(0)
}

backfillCalendarClients().catch(e => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
