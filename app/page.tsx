import { db } from '@/db'
import {
  reps as repsTable,
  clients as clientsTable,
  activity_daily as activityDailyTable,
  activity_log_entries as activityLogTable,
  targets as targetsTable,
  closed_deals as closedDealsTable,
} from '@/db/schema'
import { desc, asc } from 'drizzle-orm'
import { Shell } from '@/components/Shell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [reps, clients, activity, feed, targets, closedDeals] = await Promise.all([
    db.select().from(repsTable).orderBy(asc(repsTable.created_at)),
    db.select().from(clientsTable).orderBy(desc(clientsTable.mrr)),
    db.select().from(activityDailyTable).orderBy(asc(activityDailyTable.date)),
    db.select().from(activityLogTable).orderBy(desc(activityLogTable.logged_at)).limit(60),
    db.select().from(targetsTable),
    db.select().from(closedDealsTable).orderBy(desc(closedDealsTable.closed_date)),
  ])

  return (
    <Shell
      reps={reps}
      clients={clients}
      activity={activity}
      feed={feed}
      targets={targets}
      closedDeals={closedDeals}
    />
  )
}
