import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var _pgClient: ReturnType<typeof postgres> | undefined
}

// Reuse connection in dev (hot reload creates multiple instances otherwise)
const client = globalThis._pgClient ?? postgres(process.env.DATABASE_URL!, {
  prepare: false, // required for Supabase transaction pooler
})

if (process.env.NODE_ENV !== 'production') {
  globalThis._pgClient = client
}

export const db = drizzle(client, { schema })
