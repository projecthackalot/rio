/**
 * `npm run doctor`: checks every connection RIO depends on, in dependency
 * order, and explains failures in plain language. Read-only: it changes
 * nothing. Exit code 0 when everything required passes, 1 otherwise.
 *
 *   1. Environment variables present and well-formed (no secrets printed)
 *   2. Supabase project reachable (DNS, REST, Auth)
 *   3. Auth configuration (email sign-up, Google provider)
 *   4. Database connection (TLS-verified) and migration history
 *   5. Schema objects the app queries (view, RPCs, buckets)
 *   6. Security posture visible to the public (anon can't read private data)
 *   7. Demo accounts can sign in (when RIO_DEMO_PASSWORD is set)
 */
import { lookup } from 'node:dns/promises'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { connectDb, loadLocalEnv } from './lib/env'

loadLocalEnv()

type Status = 'pass' | 'fail' | 'warn' | 'skip'
const results: { status: Status; name: string; detail: string }[] = []
const ICON: Record<Status, string> = { pass: 'PASS', fail: 'FAIL', warn: 'WARN', skip: 'SKIP' }

function record(status: Status, name: string, detail = '') {
  results.push({ status, name, detail })
  console.log(`  [${ICON[status]}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function check(name: string, fn: () => Promise<string | void>, onFail: Status = 'fail'): Promise<boolean> {
  try {
    const detail = await fn()
    record('pass', name, detail ?? '')
    return true
  } catch (error) {
    record(onFail, name, error instanceof Error ? error.message : String(error))
    return false
  }
}

const env = (k: string) => process.env[k]?.trim() ?? ''
const timeout = (ms: number) => AbortSignal.timeout(ms)

async function main() {
  console.log('\nRIO doctor — connection and configuration check (read-only)\n')

  // 1. Environment
  console.log('1. Environment (.env.local)')
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  await check('NEXT_PUBLIC_SUPABASE_URL', async () => {
    if (!url) throw new Error('missing — copy it from Supabase → Project Settings → API')
    const u = new URL(url)
    if (u.protocol !== 'https:') throw new Error('must start with https://')
    return u.host
  })
  await check('NEXT_PUBLIC_SUPABASE_ANON_KEY', async () => {
    if (anon.length < 20) throw new Error('missing or too short')
    return 'present'
  })
  await check(
    'NEXT_PUBLIC_SITE_URL',
    async () => {
      const s = env('NEXT_PUBLIC_SITE_URL')
      if (!s) throw new Error('not set: auth emails and Google sign-in need it (required in production)')
      return new URL(s).origin
    },
    'warn',
  )
  await check('No privileged key exposed to the browser', async () => {
    const leaked = Object.keys(process.env).filter((k) => k.startsWith('NEXT_PUBLIC_') && /SERVICE|SECRET|PASSWORD|DB_URL/i.test(k))
    if (leaked.length) throw new Error(`these must not be NEXT_PUBLIC_: ${leaked.join(', ')}`)
  })

  // 2. Reachability
  console.log('\n2. Supabase project reachable')
  const host = url ? new URL(url).hostname : ''
  const dnsOk = await check('Project hostname resolves (DNS)', async () => {
    if (!host) throw new Error('no URL')
    try {
      await lookup(host)
    } catch {
      let internet = false
      try {
        await lookup('supabase.com')
        internet = true
      } catch {}
      throw new Error(
        internet
          ? `${host} does not resolve, but supabase.com does. The project is PAUSED (free projects pause after ~7 idle days) or deleted. Supabase dashboard → open the project → "Restore project".`
          : 'no DNS at all: check your internet connection',
      )
    }
  })
  const restOk =
    dnsOk &&
    (await check('REST API (PostgREST)', async () => {
      const r = await fetch(`${url}/rest/v1/categories?select=slug&limit=1`, { headers: { apikey: anon }, signal: timeout(20_000) })
      if (r.status === 404 || r.status === 400) throw new Error(`HTTP ${r.status}: tables missing — run npm run db:migrate`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return 'categories readable'
    }))
  if (!dnsOk) record('skip', 'REST API (PostgREST)', 'project not reachable')
  let authSettings: Record<string, unknown> | null = null
  if (dnsOk) {
    await check('Auth API (GoTrue)', async () => {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon }, signal: timeout(20_000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      authSettings = (await r.json()) as Record<string, unknown>
      return 'healthy'
    })
  } else record('skip', 'Auth API (GoTrue)', 'project not reachable')

  // 3. Auth configuration
  console.log('\n3. Sign-in configuration')
  if (authSettings) {
    const s = authSettings as { external?: Record<string, boolean>; disable_signup?: boolean; mailer_autoconfirm?: boolean }
    record(
      s.external?.email && !s.disable_signup ? 'pass' : 'fail',
      'Email sign-up enabled',
      s.disable_signup ? 'sign-ups are disabled in Supabase Auth settings' : '',
    )
    record(
      s.mailer_autoconfirm ? 'warn' : 'pass',
      'Email confirmation required',
      s.mailer_autoconfirm ? 'auto-confirm is on: anyone can sign up without proving the email' : '',
    )
    record(
      s.external?.google ? 'pass' : 'warn',
      'Google sign-in provider',
      s.external?.google ? 'enabled' : 'disabled — configure it (docs/level-1/DEPLOY.md §4); the Google button shows an error until then',
    )
  } else record('skip', 'Auth settings', 'Auth API not reachable')

  // 4. Database
  console.log('\n4. Database (direct, TLS-verified)')
  if (!env('SUPABASE_DB_URL')) {
    record('skip', 'Database connection', 'SUPABASE_DB_URL not set (only needed for migrations, seeding and this check)')
  } else {
    try {
      const db = await connectDb(30_000)
      try {
        const v = await db.query<{ v: string }>('select version() v')
        record('pass', 'Database connection', v.rows[0].v.split(' ').slice(0, 2).join(' '))
        const files = readdirSync(join(process.cwd(), 'supabase', 'migrations'))
          .filter((f) => /^\d{14}_/.test(f))
          .map((f) => f.slice(0, 14))
        const applied = new Set(
          (await db.query<{ version: string }>('select version from supabase_migrations.schema_migrations').catch(() => ({ rows: [] }))).rows.map(
            (r) => r.version,
          ),
        )
        const pending = files.filter((f) => !applied.has(f))
        record(
          pending.length ? 'fail' : 'pass',
          'Migrations applied',
          pending.length ? `pending: ${pending.join(', ')} — run npm run db:migrate` : `${files.length}/${files.length}`,
        )

        // 5. Schema objects
        console.log('\n5. Schema objects the app uses')
        const need = [
          'claim_listing',
          'cancel_claim',
          'start_rental',
          'issue_handover_token',
          'consume_handover_token',
          'open_dispute',
          'resolve_dispute',
          'route_to_staff',
          'rio_current_price',
        ]
        const fns = new Set(
          (
            await db.query<{ proname: string }>(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)
          ).rows.map((r) => r.proname),
        )
        const missing = need.filter((f) => !fns.has(f))
        record(missing.length ? 'fail' : 'pass', 'Business functions', missing.length ? `missing: ${missing.join(', ')}` : `${need.length} present`)
        const view = await db.query(`select 1 from information_schema.views where table_schema = 'public' and table_name = 'listing_cards'`)
        record(view.rowCount ? 'pass' : 'fail', 'listing_cards view', view.rowCount ? '' : 'missing — run npm run db:migrate')
        const buckets = (
          await db.query<{ id: string; public: boolean }>(`select id, public from storage.buckets where id in ('listing-media','dispute-evidence')`)
        ).rows
        const ok = buckets.find((b) => b.id === 'listing-media')?.public === true && buckets.find((b) => b.id === 'dispute-evidence')?.public === false
        record(ok ? 'pass' : 'fail', 'Storage buckets', ok ? 'listing-media public, dispute-evidence private' : `found: ${JSON.stringify(buckets)}`)
        const priv = (
          await db.query<{ anon_profiles: boolean; set_role: boolean; write_ledger: boolean; price_fn: boolean }>(`select
            has_table_privilege('anon','public.profiles','select') anon_profiles,
            has_column_privilege('authenticated','public.profiles','role','update') set_role,
            has_table_privilege('authenticated','public.ledger_entries','insert') write_ledger,
            has_function_privilege('anon','public.rio_current_price(bigint,bigint,timestamptz,timestamptz,timestamptz)','execute') price_fn`)
        ).rows[0]
        record(
          !priv.anon_profiles && !priv.set_role && !priv.write_ledger ? 'pass' : 'fail',
          'Privileges locked down',
          JSON.stringify({ anonReadsProfiles: priv.anon_profiles, userCanSetRole: priv.set_role, userCanWriteLedger: priv.write_ledger }),
        )
        record(priv.price_fn ? 'pass' : 'fail', 'Live price callable by visitors', priv.price_fn ? '' : 'rio_current_price not executable by anon')
      } finally {
        await db.end()
      }
    } catch (error) {
      // connectDb() already turned the failure into an actionable message.
      record('fail', 'Database connection', error instanceof Error ? error.message : String(error))
    }
  }

  // 6. Public security posture via the API
  console.log('\n6. What anonymous visitors can see (via the API)')
  if (restOk) {
    await check('Profiles hidden from visitors', async () => {
      const r = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, { headers: { apikey: anon }, signal: timeout(20_000) })
      if (r.ok) throw new Error('anonymous request could read profiles')
      return `HTTP ${r.status} as expected`
    })
    await check('Live prices readable by visitors', async () => {
      const r = await fetch(`${url}/rest/v1/listing_cards?select=current_price_paise&limit=1`, { headers: { apikey: anon }, signal: timeout(20_000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`)
      return 'ok'
    })
  } else record('skip', 'API security checks', 'REST API not reachable')

  // 7. Demo accounts
  console.log('\n7. Demo accounts')
  const pw = env('RIO_DEMO_PASSWORD')
  if (!restOk || !pw) record('skip', 'Demo sign-in', !pw ? 'RIO_DEMO_PASSWORD not set' : 'REST API not reachable')
  else {
    for (const email of ['priya.demo@rio.test', 'warden.demo@rio.test']) {
      await check(`Sign in as ${email}`, async () => {
        const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { apikey: anon, 'content-type': 'application/json' },
          body: JSON.stringify({ email, password: pw }),
          signal: timeout(20_000),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.status === 400 ? 'wrong password or account missing — run npm run seed:demo' : await r.text()}`)
        return 'ok'
      })
    }
  }

  const fails = results.filter((r) => r.status === 'fail')
  const warns = results.filter((r) => r.status === 'warn')
  console.log(
    `\nSummary: ${results.filter((r) => r.status === 'pass').length} passed, ${warns.length} warnings, ${fails.length} failed, ${results.filter((r) => r.status === 'skip').length} skipped`,
  )
  if (fails.length) console.log(`First thing to fix: ${fails[0].name} — ${fails[0].detail}`)
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => {
  console.error(`doctor crashed: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
