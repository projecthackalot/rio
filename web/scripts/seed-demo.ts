/**
 * Demo seed for a DEVELOPMENT / DEMO Supabase project only.
 *
 *   RIO_DEMO_SEED=true RIO_DEMO_PASSWORD='...' npm run seed:demo
 *
 * Creates a campus with two hostels, demo accounts (students, a warden, a
 * staff member, an admin) and listings at different auction stages, with
 * times relative to *now* so the Dutch auction and final-hour routing can be
 * demonstrated without any clock manipulation. Idempotent: re-running reuses
 * existing demo users and only adds listings for users who have none.
 *
 * Uses the service-role key, so it refuses to run unless explicitly enabled,
 * never in production, and never without an operator-chosen password.
 * Listings have no photos (cards show category illustrations) — upload real
 * photos through the app.
 */
import { connectDb, loadLocalEnv } from './lib/env'
import { createClient } from '@supabase/supabase-js'

loadLocalEnv()

function fail(msg: string): never {
  console.error(`seed-demo: ${msg}`)
  process.exit(1)
}

if (process.env.RIO_DEMO_SEED !== 'true') fail('refusing to run: set RIO_DEMO_SEED=true for a development/demo project.')
if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') fail('refusing to run in production.')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.RIO_DEMO_PASSWORD
if (!url || !serviceKey) fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
if (!password || password.length < 10) fail('set RIO_DEMO_PASSWORD (at least 10 characters) for the demo accounts.')

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const H = 3_600_000
const now = Date.now()
const iso = (offsetHours: number) => new Date(now + offsetHours * H).toISOString()

const PEOPLE = [
  { key: 'priya', email: 'priya.demo@rio.test', name: 'Priya Nair', role: 'student', hostel: 'A' },
  { key: 'rohan', email: 'rohan.demo@rio.test', name: 'Rohan Mehta', role: 'student', hostel: 'A' },
  { key: 'aarav', email: 'aarav.demo@rio.test', name: 'Aarav Sharma', role: 'student', hostel: 'A' },
  { key: 'zoya', email: 'zoya.demo@rio.test', name: 'Zoya Khan', role: 'student', hostel: 'B' },
  { key: 'meera', email: 'warden.demo@rio.test', name: 'Meera Iyer', role: 'warden', hostel: 'A' },
  { key: 'suresh', email: 'staff.demo@rio.test', name: 'Suresh Kumar', role: 'staff', hostel: 'A' },
  { key: 'admin', email: 'admin.demo@rio.test', name: 'RIO Admin', role: 'admin', hostel: null },
] as const

async function ensureHostels() {
  const { data: campus, error } = await db
    .from('campuses')
    .upsert({ name: 'Demo University', city: 'Greater Noida' }, { onConflict: 'name' })
    .select('id')
    .single()
  if (error) fail(`campus: ${error.message}`)
  const out: Record<string, string> = {}
  for (const [k, name] of [
    ['A', 'Boys Hostel A'],
    ['B', 'Girls Hostel B'],
  ] as const) {
    const { data, error: e } = await db.from('hostels').upsert({ campus_id: campus.id, name }, { onConflict: 'campus_id,name' }).select('id').single()
    if (e) fail(`hostel: ${e.message}`)
    out[k] = data.id
  }
  return out
}

async function ensureUser(email: string, name: string): Promise<string> {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users.find((u) => u.email === email)
  if (existing) return existing.id
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } })
  if (error || !data.user) fail(`create ${email}: ${error?.message}`)
  return data.user.id
}

const LISTINGS = [
  {
    owner: 'aarav',
    title: 'Symphony air cooler, 40 L',
    category: 'air-cooler',
    condition: 'good',
    start: 1800,
    floor: 500,
    listedAgo: 120,
    departsIn: 50,
    rentable: false,
    description: 'Works well, water pump replaced last semester. Wheels on all four corners. Collect from Block A.',
  },
  {
    owner: 'aarav',
    title: 'Single foam mattress, 4 inch',
    category: 'foam-mattress',
    condition: 'fair',
    start: 1200,
    floor: 300,
    listedAgo: 46,
    departsIn: 2.5,
    rentable: false,
    description: 'Used for two years, cover washed. Slight dip in the middle.',
  },
  {
    owner: 'aarav',
    title: 'Electric kettle, 1.5 L',
    category: 'kettle-immersion',
    condition: 'good',
    start: 500,
    floor: 150,
    listedAgo: 40,
    departsIn: 0.5,
    rentable: false,
    description: 'Auto shut-off works. In the final hour now, so it should go to staff.',
  },
  {
    owner: 'priya',
    title: 'Study table with chair',
    category: 'study-table-chair',
    condition: 'like_new',
    start: 1500,
    floor: 400,
    listedAgo: 10,
    departsIn: 400,
    rentable: true,
    description: 'Bought this year. Table has a drawer; chair is cushioned. Happy to rent it out by the week.',
  },
  {
    owner: 'priya',
    title: 'Drafter with A2 board',
    category: 'drafter-board',
    condition: 'good',
    start: 450,
    floor: 150,
    listedAgo: 5,
    departsIn: 400,
    rentable: true,
    description: 'Omega drafter, all scales intact. Board has a few pin marks.',
  },
  {
    owner: 'rohan',
    title: 'Bucket and mug set',
    category: 'other',
    condition: 'worn',
    start: 120,
    floor: 40,
    listedAgo: 2,
    departsIn: null,
    rentable: false,
    description: 'Fixed price, no rush. Basic but clean.',
  },
  {
    owner: 'zoya',
    title: 'Table fan cum air cooler, compact',
    category: 'air-cooler',
    condition: 'like_new',
    start: 1400,
    floor: 600,
    listedAgo: 24,
    departsIn: 150,
    rentable: true,
    description: 'Small and quiet, good for single rooms.',
  },
] as const

/**
 * `--refresh`: demo times are relative to when the seed first ran, so after a
 * while every departure has passed. This moves listed/departure times of demo
 * listings that are not in a transaction back to "now + the original offsets",
 * and withdraws listings left behind by automated test runs.
 */
async function refreshDemo(ids: Record<string, string>) {
  for (const l of LISTINGS) {
    const { data, error } = await db
      .from('listings')
      .update({ listed_at: iso(-l.listedAgo), departure_at: l.departsIn === null ? null : iso(l.departsIn), status: 'ACTIVE' })
      .eq('owner_id', ids[l.owner])
      .eq('title', l.title)
      .in('status', ['ACTIVE', 'WITHDRAWN'])
      .select('id')
    if (error) fail(`refresh ${l.title}: ${error.message}`)
    console.log(`seed-demo: refreshed ${l.title} (${data?.length ?? 0})`)
  }
  const { data: leftovers, error } = await db
    .from('listings')
    .update({ status: 'WITHDRAWN' })
    .eq('status', 'ACTIVE')
    .or('title.like.E2E %,title.like.Selenium %,title.like.Race test %')
    .select('id')
  if (error) fail(`withdraw test listings: ${error.message}`)
  console.log(`seed-demo: withdrew ${leftovers?.length ?? 0} leftover test listings`)

  // Top demo students' sandbox wallets back up to the opening ₹3,000 (tests spend it).
  if (!process.env.SUPABASE_DB_URL) {
    console.log('seed-demo: SUPABASE_DB_URL not set, skipping wallet top-up')
    return
  }
  const pg = await connectDb(30_000)
  try {
    const students = PEOPLE.filter((p) => p.role === 'student').map((p) => ids[p.key])
    const { rows } = await pg.query<{ user_id: string; balance_paise: string }>(
      'select user_id, balance_paise::text from public.wallet_accounts where user_id = any($1::uuid[])',
      [students],
    )
    for (const r of rows) {
      const shortfall = 300_000 - Number(r.balance_paise)
      if (shortfall <= 0) continue
      await pg.query(`select private.post_ledger($1, 'DEMO_TOPUP', $2, $3, p_note => 'Demo wallet top-up (sandbox, not real money)')`, [
        r.user_id,
        shortfall,
        `demo-topup:${r.user_id}:${Date.now()}`,
      ])
      console.log(`seed-demo: topped up a demo wallet by ₹${shortfall / 100}`)
    }
  } finally {
    await pg.end()
  }
}

async function main() {
  console.log('seed-demo: sandbox data only — no real money, no real people.')
  const hostels = await ensureHostels()
  const ids: Record<string, string> = {}
  for (const p of PEOPLE) {
    ids[p.key] = await ensureUser(p.email, p.name)
    const { error } = await db
      .from('profiles')
      .update({ full_name: p.name, role: p.role, hostel_id: p.hostel ? hostels[p.hostel] : null })
      .eq('id', ids[p.key])
    if (error) fail(`profile ${p.email}: ${error.message}`)
    if (p.role === 'warden' || p.role === 'staff') {
      await db.from('hostel_assignments').upsert({ user_id: ids[p.key], hostel_id: hostels[p.hostel!] }, { onConflict: 'user_id,hostel_id' })
    }
  }
  await db
    .from('profile_private')
    .update({ block: 'A', room: '214', departure_at: iso(50) })
    .eq('user_id', ids.aarav)

  for (const owner of new Set(LISTINGS.map((l) => l.owner))) {
    const { count } = await db.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', ids[owner])
    if (count) {
      console.log(`seed-demo: ${owner} already has listings, skipping.`)
      continue
    }
    const person = PEOPLE.find((p) => p.key === owner)!
    const rows = LISTINGS.filter((l) => l.owner === owner).map((l) => ({
      owner_id: ids[owner],
      hostel_id: person.hostel ? hostels[person.hostel] : null,
      title: l.title,
      description: l.description,
      category_slug: l.category,
      condition: l.condition,
      start_price_paise: l.start * 100,
      floor_price_paise: l.floor * 100,
      listed_at: iso(-l.listedAgo),
      departure_at: l.departsIn === null ? null : iso(l.departsIn),
      is_rentable: l.rentable,
    }))
    const { error } = await db.from('listings').insert(rows)
    if (error) fail(`listings for ${owner}: ${error.message}`)
  }

  if (process.argv.includes('--refresh')) await refreshDemo(ids)

  console.log('seed-demo: done. Demo accounts (password = RIO_DEMO_PASSWORD):')
  for (const p of PEOPLE) console.log(`  ${p.role.padEnd(7)} ${p.email}`)
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
