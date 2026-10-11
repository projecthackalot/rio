/**
 * Applies pending SQL migrations from supabase/migrations to the database in
 * SUPABASE_DB_URL (from .env.local). Equivalent to `supabase db push` for
 * machines without the CLI/Docker:
 *   - one transaction per file, stops at the first failure,
 *   - records each applied version in supabase_migrations.schema_migrations
 *     (the table the Supabase CLI uses), so later CLI pushes stay in sync,
 *   - a file whose objects already exist but isn't recorded can be marked as
 *     applied with --mark-applied=<version>[,<version>].
 *
 *   npm run db:migrate -- --dry-run
 *   npm run db:migrate -- --mark-applied=20231009000000,20231010000000
 *   npm run db:migrate
 *
 * Never logs the connection string.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
loadEnvFile('.env.local')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const markApplied = (args.find((a) => a.startsWith('--mark-applied='))?.split('=')[1] ?? '').split(',').filter(Boolean)

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('db:migrate: set SUPABASE_DB_URL in .env.local (Supabase → Connect → Session pooler URI).')
  process.exit(1)
}

const dir = join(process.cwd(), 'supabase', 'migrations')
const files = readdirSync(dir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort()

async function main() {
  // TLS is always verified. Supabase signs database certificates with its own root CA:
  // download it (Dashboard → Database → Settings → SSL → Download certificate) and set
  // SUPABASE_DB_CA_CERT to its path if verification against the system CAs fails.
  const caPath = process.env.SUPABASE_DB_CA_CERT
  const ssl = caPath ? { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true } : { rejectUnauthorized: true }
  const client = new Client({ connectionString: dbUrl, ssl, statement_timeout: 120_000 })
  try {
    await client.connect()
  } catch (error) {
    const msg = (error as Error).message
    if (/certificate|self[- ]signed|unable to verify/i.test(msg)) {
      throw new Error(`TLS verification failed (${msg}). Download the Supabase CA certificate and set SUPABASE_DB_CA_CERT=<path> in .env.local.`)
    }
    throw error
  }
  try {
    await client.query(`create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`)
    const { rows } = await client.query<{ version: string }>('select version from supabase_migrations.schema_migrations')
    const applied = new Set(rows.map((r) => r.version))

    for (const v of markApplied) {
      const file = files.find((f) => f.startsWith(v))
      if (!file) throw new Error(`--mark-applied: no migration file for version ${v}`)
      if (!applied.has(v) && !dryRun) {
        await client.query('insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict do nothing', [v, file.slice(15, -4)])
      }
      applied.add(v)
      console.log(`marked applied  ${file}`)
    }

    const pending = files.filter((f) => !applied.has(f.slice(0, 14)))
    if (!pending.length) {
      console.log('db:migrate: database is up to date.')
      return
    }
    for (const file of pending) {
      if (dryRun) {
        console.log(`would apply     ${file}`)
        continue
      }
      const sql = readFileSync(join(dir, file), 'utf8')
      process.stdout.write(`applying        ${file} … `)
      try {
        await client.query('begin')
        await client.query(sql)
        await client.query('insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)', [
          file.slice(0, 14),
          file.slice(15, -4),
          [sql],
        ])
        await client.query('commit')
        console.log('ok')
      } catch (error) {
        await client.query('rollback').catch(() => {})
        console.log('FAILED')
        throw new Error(`${file}: ${(error as Error).message}`)
      }
    }
    console.log(dryRun ? 'db:migrate: dry run only, nothing changed.' : 'db:migrate: all migrations applied.')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(`db:migrate: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
