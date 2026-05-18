import type { Config } from 'drizzle-kit'

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: ['reps', 'clients', 'activity_daily', 'activity_log_entries', 'targets', 'closed_deals'],
} satisfies Config
