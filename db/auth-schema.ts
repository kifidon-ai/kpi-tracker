import { pgSchema, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'

const authSchema = pgSchema('auth')

export const authUsers = authSchema.table('users', {
  id:                  uuid('id').primaryKey(),
  email:               text('email'),
  raw_user_meta_data:  jsonb('raw_user_meta_data'),
  created_at:          timestamp('created_at', { withTimezone: true, mode: 'string' }),
})
