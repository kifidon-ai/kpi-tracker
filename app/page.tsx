import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { Shell } from '@/components/Shell'

export const revalidate = 0

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [
    { data: reps },
    { data: clients },
    { data: activity },
    { data: feed },
    { data: targets },
  ] = await Promise.all([
    supabase.from('reps').select('*').order('created_at'),
    supabase.from('clients').select('*').order('mrr', { ascending: false }),
    supabase.from('activity_daily').select('*').order('date'),
    supabase
      .from('activity_log_entries')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(60),
    supabase.from('targets').select('*'),
  ])

  return (
    <Shell
      reps={reps ?? []}
      clients={clients ?? []}
      activity={activity ?? []}
      feed={feed ?? []}
      targets={targets ?? []}
    />
  )
}
