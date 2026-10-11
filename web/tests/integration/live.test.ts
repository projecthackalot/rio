/**
 * Live integration tests against a real Supabase project (PostgREST, Auth,
 * Storage), including genuinely concurrent claims from separate sessions —
 * something the single-connection PGlite suite cannot exercise.
 *
 * Opt-in: needs a DISPOSABLE project with the migrations applied and the demo
 * seed loaded (npm run seed:demo), plus:
 *   RIO_TEST_SUPABASE_URL, RIO_TEST_SUPABASE_ANON_KEY, RIO_TEST_PASSWORD
 * Skipped (and reported as skipped) otherwise. These tests create claims.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const url = process.env.RIO_TEST_SUPABASE_URL
const anon = process.env.RIO_TEST_SUPABASE_ANON_KEY
const password = process.env.RIO_TEST_PASSWORD
const enabled = Boolean(url && anon && password)

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url!, anon!, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: password! })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return client
}

describe.skipIf(!enabled)('live Supabase', () => {
  let priya: SupabaseClient
  let rohan: SupabaseClient
  let zoya: SupabaseClient

  beforeAll(async () => {
    ;[priya, rohan, zoya] = await Promise.all([signIn('priya.demo@rio.test'), signIn('rohan.demo@rio.test'), signIn('zoya.demo@rio.test')])
  })

  it('rejects role escalation and wallet edits through the REST API', async () => {
    const { data: me } = await rohan.auth.getUser()
    const role = await rohan.from('profiles').update({ role: 'admin' }).eq('id', me.user!.id)
    expect(role.error?.code).toBe('42501')
    const wallet = await rohan.from('wallet_accounts').update({ balance_paise: 99_999_999 }).eq('user_id', me.user!.id)
    expect(wallet.error?.code).toBe('42501')
    const rpc = await rohan.rpc('admin_set_role', { p_user: me.user!.id, p_role: 'warden', p_hostels: [] })
    expect(rpc.error?.message).toContain('RIO_NOT_AUTHORIZED')
  })

  it('never exposes another resident’s room', async () => {
    const { data } = await rohan.from('profile_private').select('user_id, room')
    const { data: me } = await rohan.auth.getUser()
    expect((data ?? []).every((r) => r.user_id === me.user!.id)).toBe(true)
  })

  it('lets exactly one of two simultaneous claimants win', async () => {
    const { data: listing } = await priya
      .from('listings')
      .insert({ title: `Race test ${Date.now()}`, category_slug: 'other', start_price_paise: 1000, floor_price_paise: 500, departure_at: null })
      .select('id')
      .single()
    expect(listing?.id).toBeTruthy()
    const results = await Promise.all([rohan.rpc('claim_listing', { p_listing: listing!.id }), zoya.rpc('claim_listing', { p_listing: listing!.id })])
    const winners = results.filter((r) => !r.error)
    const losers = results.filter((r) => r.error)
    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(1)
    expect(losers[0].error!.message).toMatch(/RIO_UNAVAILABLE|claims_one_open_per_listing/)
    // Clean up: cancel the winning claim so escrow is refunded.
    const winnerClient = results[0].error ? zoya : rohan
    await winnerClient.rpc('cancel_claim', { p_claim: winners[0].data })
  })

  it('keeps dispute evidence private', async () => {
    const { data } = await zoya.storage.from('dispute-evidence').list('', { limit: 100 })
    const { data: me } = await zoya.auth.getUser()
    for (const entry of data ?? []) expect(entry.name === me.user!.id || entry.id === null).toBe(true)
  })
})

describe.skipIf(enabled)('live Supabase (not configured)', () => {
  it.skip('set RIO_TEST_SUPABASE_URL / RIO_TEST_SUPABASE_ANON_KEY / RIO_TEST_PASSWORD to run', () => {})
})
