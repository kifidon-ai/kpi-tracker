import { db } from '@/db'
import { targets } from '@/db/schema'
import { eq } from 'drizzle-orm'

async function updateTargets() {
  const result = await db
    .update(targets)
    // onb = 10/week for the whole team (not per person — LiveTracker skips headcount mult)
    .set({ dials: 250, dm_conv: 50, disc: 20, demo: 7, onb: 10, closed: 3 })
    .where(eq(targets.period, 'per_person'))
    .returning()

  console.log('Updated per_person targets:', result)
  process.exit(0)
}

updateTargets().catch(err => {
  console.error(err)
  process.exit(1)
})
