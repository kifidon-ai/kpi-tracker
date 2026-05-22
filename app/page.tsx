import { db } from '@/db'
import {
  reps as repsTable,
  clients as clientsTable,
  activity_log_entries as activityLogTable,
  targets as targetsTable,
} from '@/db/schema'
import { desc, asc } from 'drizzle-orm'
import { Shell } from '@/components/Shell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [reps, clients, feed, targets] = await Promise.all([
    db.select().from(repsTable).orderBy(asc(repsTable.created_at)),
    db.select().from(clientsTable).orderBy(desc(clientsTable.mrr)),
    db.select().from(activityLogTable).orderBy(desc(activityLogTable.logged_at)).limit(1000),
    db.select().from(targetsTable),
  ])

  return (
    <Shell
      reps={reps}
      clients={clients}
      feed={feed}
      targets={targets}
    />
  )
}
