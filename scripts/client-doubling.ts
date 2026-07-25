/**
 * Time-to-double client base from 1 → current.
 * Run: node --import tsx scripts/client-doubling.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string) {
  const ms = new Date(b + 'T00:00').getTime() - new Date(a + 'T00:00').getTime()
  return Math.round(ms / 86400000)
}

function fmtDays(d: number) {
  if (d < 7) return `${d}d`
  const weeks = d / 7
  if (weeks < 8) return `${d}d (${weeks.toFixed(1)}w)`
  const months = d / 30.44
  return `${d}d (${weeks.toFixed(1)}w / ${months.toFixed(1)}mo)`
}

async function main() {
  const { db } = await import('../db')
  const { clients } = await import('../db/schema')
  const { asc } = await import('drizzle-orm')

  const rows = await db
    .select({
      name: clients.name,
      since_date: clients.since_date,
      cancel_date: clients.cancel_date,
      status: clients.status,
    })
    .from(clients)
    .orderBy(asc(clients.since_date))

  if (rows.length === 0) {
    console.log('No clients found.')
    return
  }

  const today = toISO(new Date())

  const signed = rows
    .filter((c) => c.since_date)
    .map((c) => ({
      name: c.name,
      since: c.since_date as string,
      cancel: c.cancel_date as string | null,
    }))
    .sort((a, b) => a.since.localeCompare(b.since))

  const firstDate = signed[0].since
  const currentActive = signed.filter((c) => {
    if (c.since > today) return false
    if (c.cancel && c.cancel <= today) return false
    return true
  }).length

  console.log('\n=== Client base doubling (cumulative signups by since_date) ===\n')
  console.log(`First client:  ${signed[0].name} on ${firstDate}`)
  console.log(`Total signed:  ${signed.length}`)
  console.log(`Active today:  ${currentActive}`)
  console.log(`Elapsed:       ${fmtDays(daysBetween(firstDate, today))} (${firstDate} → ${today})\n`)

  const milestones: { n: number; date: string; name: string }[] = []
  signed.forEach((c, i) => {
    milestones.push({ n: i + 1, date: c.since, name: c.name })
  })

  const targets: number[] = []
  for (let n = 1; n <= signed.length; n *= 2) targets.push(n)
  if (targets[targets.length - 1] !== signed.length) targets.push(signed.length)

  console.log('Doubling checkpoints (cumulative clients ever signed):\n')
  console.log(
    'Clients'.padEnd(10) +
    'Date'.padEnd(14) +
    'Days from prev'.padEnd(28) +
    'Days from start'.padEnd(22) +
    'Client that crossed'
  )
  console.log('-'.repeat(100))

  let prevDate = firstDate
  for (const target of targets) {
    const hit = milestones.find((m) => m.n === target)!
    const fromPrev = daysBetween(prevDate, hit.date)
    const fromStart = daysBetween(firstDate, hit.date)
    const label = target === signed.length && !Number.isInteger(Math.log2(target))
      ? `${target} (current)`
      : String(target)
    console.log(
      label.padEnd(10) +
      hit.date.padEnd(14) +
      (target === 1 ? '—'.padEnd(28) : fmtDays(fromPrev).padEnd(28)) +
      fmtDays(fromStart).padEnd(22) +
      hit.name
    )
    prevDate = hit.date
  }

  const completedDoublings: number[] = []
  for (let i = 1; i < targets.length; i++) {
    const a = milestones.find((m) => m.n === targets[i - 1])!
    const b = milestones.find((m) => m.n === targets[i])!
    if (targets[i] === targets[i - 1] * 2) {
      completedDoublings.push(daysBetween(a.date, b.date))
    }
  }

  if (completedDoublings.length) {
    const avg = completedDoublings.reduce((s, d) => s + d, 0) / completedDoublings.length
    console.log(`\nCompleted doublings: ${completedDoublings.length}`)
    console.log(`Avg days per doubling: ${fmtDays(Math.round(avg))}`)
    console.log(`Doubling times: ${completedDoublings.map((d) => fmtDays(d)).join(' → ')}`)
  }

  const allDates = [...new Set([
    ...signed.map((c) => c.since),
    ...signed.filter((c) => c.cancel).map((c) => c.cancel as string),
    today,
  ])].sort()

  function activeAsOf(asOf: string) {
    return signed.filter((c) => c.since <= asOf && (!c.cancel || c.cancel > asOf)).length
  }

  const activeTargets: number[] = []
  for (let n = 1; n <= currentActive; n *= 2) activeTargets.push(n)
  if (activeTargets[activeTargets.length - 1] !== currentActive) activeTargets.push(currentActive)

  console.log('\n=== Doubling checkpoints (active clients as of date) ===\n')
  console.log(
    'Active'.padEnd(10) +
    'Date first hit'.padEnd(16) +
    'Days from prev'.padEnd(28) +
    'Days from start'
  )
  console.log('-'.repeat(80))

  prevDate = firstDate
  for (const target of activeTargets) {
    const hitDate = allDates.find((d) => activeAsOf(d) >= target) ?? today
    const fromPrev = daysBetween(prevDate, hitDate)
    const fromStart = daysBetween(firstDate, hitDate)
    const label = target === currentActive && !Number.isInteger(Math.log2(target))
      ? `${target} (current)`
      : String(target)
    console.log(
      label.padEnd(10) +
      hitDate.padEnd(16) +
      (target === 1 ? '—'.padEnd(28) : fmtDays(fromPrev).padEnd(28)) +
      fmtDays(fromStart)
    )
    prevDate = hitDate
  }

  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
