/**
 * PGlite test harness: boots an in-process Postgres, applies the Supabase shim
 * and every file in supabase/migrations (in order, one transaction each, like
 * the Supabase CLI), and offers helpers to run SQL as a specific signed-in
 * user under RLS — exactly how PostgREST executes requests.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

const ROOT = join(__dirname, '..', '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')

export type Db = PGlite
export type Tx = Transaction

export async function createTestDb(hooks: { beforeMigration?: Record<string, (db: Db) => Promise<void>> } = {}): Promise<Db> {
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } })
  await db.exec(readFileSync(join(__dirname, 'supabase-shim.sql'), 'utf8'))
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    const hook = Object.entries(hooks.beforeMigration ?? {}).find(([prefix]) => file.startsWith(prefix))?.[1]
    if (hook) await hook(db)
    try {
      await db.exec(`begin;\n${sql}\ncommit;`)
    } catch (error) {
      await db.exec('rollback').catch(() => {})
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
  }
  return db
}

/** Creates an auth user; the on_auth_user_created trigger provisions the profile + wallet. */
export async function createUser(db: Db, email: string, meta: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.query<{ id: string }>('insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id', [
    email,
    JSON.stringify(meta),
  ])
  return rows[0].id
}

/** Runs `fn` inside a transaction as `authenticated` with auth.uid() = userId (or as anon when null). */
export async function as<T>(db: Db, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' }
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`)
    return fn(tx)
  })
}

/** Runs SQL as the database owner (bypasses RLS) — for fixtures and assertions only. */
export async function admin<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}

/** Expects the promise to reject with a Postgres error whose message contains `fragment`. */
export async function rejects(promise: Promise<unknown>, fragment: string): Promise<void> {
  try {
    await promise
  } catch (error) {
    const message = (error as Error).message
    if (!message.includes(fragment)) {
      throw new Error(`Expected error containing "${fragment}", got: ${message}`)
    }
    return
  }
  throw new Error(`Expected rejection containing "${fragment}", but it succeeded`)
}

/** Moves a listing's clock: shifts listed_at/departure_at so `now()` lands at the given offset. */
export async function setListingTimes(db: Db, listingId: string, listedHoursAgo: number, departsInHours: number | null) {
  await db.query(
    `update public.listings set listed_at = now() - make_interval(secs => $2 * 3600),
       departure_at = case when $3::float8 is null then null else now() + make_interval(secs => $3::float8 * 3600) end
     where id = $1`,
    [listingId, listedHoursAgo, departsInHours],
  )
}
