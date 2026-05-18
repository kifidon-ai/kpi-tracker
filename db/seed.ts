import { db } from './index'
import { reps } from './schema'
import { authUsers } from './auth-schema'

const COLORS = ['#00D4FF', '#8B5CF6', '#00E5A0', '#F59E0B', '#EF4444', '#EC4899']

async function seed() {
  const users = await db.select().from(authUsers)

  if (!users.length) {
    console.log('No users found in auth.users')
    process.exit(0)
  }

  let seeded = 0
  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const meta = (user.raw_user_meta_data ?? {}) as Record<string, string>
    const name = meta.full_name?.trim() || meta.name?.trim() || user.email?.split('@')[0] || 'Unknown'
    const parts = name.split(' ').filter(Boolean)
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()

    const result = await db
      .insert(reps)
      .values({
        id:          crypto.randomUUID(),
        name,
        initials,
        color:       COLORS[i % COLORS.length],
        joined_date: user.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        role:        'SDR',
        user_id:     user.id,
      })
      .onConflictDoNothing({ target: reps.user_id })

    seeded++
    console.log(`  ✓ ${name} (${initials}) — ${user.email}`)
  }

  console.log(`\nDone: ${seeded} user(s) synced to reps`)
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
