/**
 * Database tests: run every migration in PGlite (real Postgres 18 in WASM)
 * and exercise RLS, column grants and the business RPCs as real signed-in
 * roles. See tests/db/harness.ts and docs/level-1/TEST_PLAN.md.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import fixtures from '../../src/domain/pricing.fixtures.json'
import { admin, as, createTestDb, createUser, rejects, setListingTimes, type Db, type Tx } from './harness'

let db: Db
let hostelA: string
let hostelB: string
const NAMES = ['alice', 'bob', 'carol', 'dave', 'warden', 'wardenB', 'staff', 'admin'] as const
const u = {} as Record<(typeof NAMES)[number], string>

const one = async <T = Record<string, unknown>>(tx: Tx | Db, sql: string, params: unknown[] = []) => (await tx.query<T>(sql, params)).rows[0]

const rpc = <T = unknown>(userId: string | null, sql: string, params: unknown[] = []) =>
  as(db, userId, async (tx) => (await one<{ v: T }>(tx, sql, params))?.v as T)

const balance = async (userId: string) =>
  Number((await admin<{ b: string }>(db, 'select balance_paise::text b from public.wallet_accounts where user_id = $1', [userId]))[0].b)

async function newListing(
  owner: string,
  opts: { start?: number; floor?: number; category?: string; rentable?: boolean; listedHoursAgo?: number; departsInHours?: number | null } = {},
) {
  const id = await as(
    db,
    owner,
    async (tx) =>
      (
        await one<{ id: string }>(
          tx,
          `insert into public.listings (title, category_slug, start_price_paise, floor_price_paise, departure_at, is_rentable)
         values ('Test item', $1, $2, $3, now() + interval '30 days', $4) returning id`,
          [opts.category ?? 'air-cooler', opts.start ?? 180_000, opts.floor ?? 50_000, opts.rentable ?? false],
        )
      ).id,
  )
  await setListingTimes(db, id, opts.listedHoursAgo ?? 0, opts.departsInHours === undefined ? 720 : opts.departsInHours)
  return id
}

const issue = (userId: string, purpose: string, subject: string) =>
  as(db, userId, async (tx) =>
    one<{ token_id: string; code: string; expires_at: string }>(tx, 'select * from public.issue_handover_token($1, $2)', [purpose, subject]),
  )
const consume = (userId: string, code: string, damage = false, note: string | null = null) =>
  rpc<Record<string, string>>(userId, 'select public.consume_handover_token($1, $2, $3) v', [code, damage, note])

beforeAll(async () => {
  db = await createTestDb()
  const campus = (await admin<{ id: string }>(db, `insert into public.campuses (name) values ('Test Campus') returning id`))[0].id
  ;[hostelA, hostelB] = (
    await admin<{ id: string }>(db, `insert into public.hostels (campus_id, name) values ($1, 'Block A'), ($1, 'Block B') returning id`, [campus])
  ).map((r) => r.id)

  for (const name of NAMES) {
    u[name] = await createUser(db, `${name}@test.local`, { full_name: name, role: 'warden' /* must be ignored */ })
  }
  // Seed roles the trusted way (as the database owner) for the fixtures.
  await admin(db, `update public.profiles set hostel_id = $1`, [hostelA])
  await admin(db, `update public.profiles set hostel_id = $2 where id = $1`, [u.wardenB, hostelB])
  await admin(db, `update public.profiles set role = 'warden' where id in ($1, $2)`, [u.warden, u.wardenB])
  await admin(db, `update public.profiles set role = 'staff' where id = $1`, [u.staff])
  await admin(db, `update public.profiles set role = 'admin' where id = $1`, [u.admin])
  await admin(db, `insert into public.hostel_assignments (user_id, hostel_id) values ($1, $3), ($2, $4), ($5, $3)`, [
    u.warden,
    u.wardenB,
    hostelA,
    hostelB,
    u.staff,
  ])
  await admin(db, `update public.profile_private set room = '214', block = 'A' where user_id = $1`, [u.alice])
})

describe('provisioning and role escalation', () => {
  it('every signup becomes a student with a ₹3,000 sandbox credit, ignoring role metadata', async () => {
    const p = await one<{ role: string; full_name: string }>(db, 'select role, full_name from public.profiles where id = $1', [u.carol])
    expect(p).toEqual({ role: 'student', full_name: 'carol' })
    expect(await balance(u.carol)).toBe(300_000)
    const l = await one<{ type: string; is_sandbox: boolean }>(db, 'select type, is_sandbox from public.ledger_entries where user_id = $1', [u.carol])
    expect(l).toEqual({ type: 'OPENING_CREDIT', is_sandbox: true })
  })

  it('a student cannot change their own role, wallet or ledger', async () => {
    await rejects(
      as(db, u.bob, (tx) => tx.query(`update public.profiles set role = 'warden' where id = $1`, [u.bob])),
      'permission denied',
    )
    await rejects(
      as(db, u.bob, (tx) => tx.query(`update public.wallet_accounts set balance_paise = 99999999`)),
      'permission denied',
    )
    await rejects(
      as(db, u.bob, (tx) =>
        tx.query(
          `insert into public.ledger_entries (user_id, type, amount_paise, balance_after_paise, idempotency_key) values ($1, 'OPENING_CREDIT', 1, 1, 'x')`,
          [u.bob],
        ),
      ),
      'permission denied',
    )
    await rejects(
      as(db, u.bob, (tx) => tx.query(`insert into public.hostel_assignments (user_id, hostel_id) values ($1, $2)`, [u.bob, hostelA])),
      'permission denied',
    )
    await rejects(rpc(u.bob, 'select public.admin_set_role($1, $2, $3) v', [u.bob, 'warden', [hostelA]]), 'RIO_NOT_AUTHORIZED')
    await rejects(rpc(u.warden, 'select public.admin_set_role($1, $2, $3) v', [u.bob, 'warden', [hostelA]]), 'RIO_NOT_AUTHORIZED')
    expect((await one<{ role: string }>(db, 'select role from public.profiles where id = $1', [u.bob])).role).toBe('student')
  })

  it('a student can edit only their own permitted profile fields', async () => {
    await as(db, u.bob, (tx) => tx.query(`update public.profiles set full_name = 'Bob B' where id = $1`, [u.bob]))
    const changed = await as(db, u.bob, async (tx) => (await tx.query(`update public.profiles set full_name = 'Hacked' where id = $1`, [u.alice])).affectedRows)
    expect(changed).toBe(0)
    expect((await one<{ full_name: string }>(db, 'select full_name from public.profiles where id = $1', [u.alice])).full_name).toBe('alice')
  })

  it('only an admin grants elevated roles, never to themselves, and it is audited', async () => {
    await rpc(u.admin, 'select public.admin_set_role($1, $2, $3) v', [u.dave, 'staff', [hostelB]])
    expect((await one<{ role: string }>(db, 'select role from public.profiles where id = $1', [u.dave])).role).toBe('staff')
    await rpc(u.admin, 'select public.admin_set_role($1, $2, $3) v', [u.dave, 'student', []])
    expect(await admin(db, 'select 1 from public.hostel_assignments where user_id = $1', [u.dave])).toHaveLength(0)
    await rejects(rpc(u.admin, 'select public.admin_set_role($1, $2, $3) v', [u.admin, 'student', []]), 'RIO_SELF_ROLE_CHANGE')
    expect((await admin(db, `select count(*)::int n from public.audit_events where action = 'role.set'`))[0]).toEqual({ n: 2 })
  })
})

describe('privacy', () => {
  it('room numbers are visible only to the resident and scoped wardens', async () => {
    const q = 'select room from public.profile_private where user_id = $1'
    expect(await as(db, u.bob, async (tx) => (await tx.query(q, [u.alice])).rows)).toHaveLength(0)
    expect(await as(db, u.wardenB, async (tx) => (await tx.query(q, [u.alice])).rows)).toHaveLength(0)
    expect(await as(db, u.alice, async (tx) => (await tx.query(q, [u.alice])).rows)).toEqual([{ room: '214' }])
    expect(await as(db, u.warden, async (tx) => (await tx.query(q, [u.alice])).rows)).toEqual([{ room: '214' }])
  })

  it('anonymous visitors see no profiles and nobody can read wallets or ledgers of others', async () => {
    await rejects(
      as(db, null, (tx) => tx.query('select * from public.profiles')),
      'permission denied',
    )
    expect(await as(db, u.bob, async (tx) => (await tx.query('select * from public.wallet_accounts where user_id = $1', [u.alice])).rows)).toHaveLength(0)
    expect(await as(db, u.bob, async (tx) => (await tx.query('select * from public.ledger_entries where user_id = $1', [u.alice])).rows)).toHaveLength(0)
    expect(await as(db, u.warden, async (tx) => (await tx.query('select * from public.ledger_entries where user_id = $1', [u.alice])).rows)).toHaveLength(0)
  })
})

describe('listings', () => {
  it('forces owner, status and hostel server-side and rejects spoofed columns', async () => {
    const id = await newListing(u.alice)
    const l = await one<{ owner_id: string; status: string; hostel_id: string }>(db, 'select owner_id, status, hostel_id from public.listings where id = $1', [
      id,
    ])
    expect(l).toEqual({ owner_id: u.alice, status: 'ACTIVE', hostel_id: hostelA })
    await rejects(
      as(db, u.alice, (tx) =>
        tx.query(
          `insert into public.listings (title, category_slug, start_price_paise, floor_price_paise, owner_id) values ('x x x', 'other', 1000, 500, $1)`,
          [u.bob],
        ),
      ),
      'permission denied',
    )
    await rejects(
      as(db, u.alice, (tx) => tx.query(`update public.listings set status = 'SOLD' where id = $1`, [id])),
      'permission denied',
    )
    const n = await as(db, u.bob, async (tx) => (await tx.query(`update public.listings set title = 'pwned!' where id = $1`, [id])).affectedRows)
    expect(n).toBe(0)
  })

  it('validates prices and departure windows', async () => {
    const ins = (start: number, floor: number, dep: string) =>
      as(db, u.alice, (tx) =>
        tx.query(
          `insert into public.listings (title, category_slug, start_price_paise, floor_price_paise, departure_at) values ('Thing', 'other', $1, $2, now() + $3::interval)`,
          [start, floor, dep],
        ),
      )
    await rejects(ins(10_000, 10_000, '10 days'), 'listings_floor_below_start')
    await rejects(ins(10_000, 0, '10 days'), 'listings_floor_below_start')
    await rejects(ins(10_000, 5_000, '2 hours'), 'RIO_DEPARTURE_TOO_SOON')
    await rejects(ins(10_000, 5_000, '400 days'), 'RIO_DEPARTURE_TOO_FAR')
  })

  it('anonymous visitors see active listings only; withdrawn ones stay private', async () => {
    const id = await newListing(u.alice)
    expect(await as(db, null, async (tx) => (await tx.query('select id from public.listing_cards where id = $1', [id])).rows)).toHaveLength(1)
    await rpc(u.alice, 'select public.set_listing_availability($1, false) v', [id])
    expect(await as(db, null, async (tx) => (await tx.query('select id from public.listings where id = $1', [id])).rows)).toHaveLength(0)
    expect(await as(db, u.alice, async (tx) => (await tx.query('select id from public.listings where id = $1', [id])).rows)).toHaveLength(1)
    await rpc(u.alice, 'select public.set_listing_availability($1, true) v', [id])
    await rejects(rpc(u.bob, 'select public.set_listing_availability($1, false) v', [id]), 'RIO_NOT_PARTY')
  })
})

describe('Dutch-auction price parity with TypeScript', () => {
  for (const c of fixtures.cases) {
    it(c.name, async () => {
      const r = await one<{ p: string }>(db, 'select public.rio_current_price($1, $2, $3, $4, $5)::text p', [
        c.startPaise,
        c.floorPaise,
        c.listedAt,
        c.departureAt,
        c.now,
      ])
      expect(Number(r.p)).toBe(c.expected)
    })
  }
})

describe('claims', () => {
  it('claims atomically at the live price, holds sandbox escrow and blocks competitors', async () => {
    const id = await newListing(u.alice, { listedHoursAgo: 10, departsInHours: 158 }) // 168h window, 10h in
    const before = await balance(u.bob)
    const claimId = await rpc<string>(u.bob, 'select public.claim_listing($1) v', [id])
    const c = await one<{ amount_paise: string; status: string }>(db, 'select amount_paise::text, status from public.claims where id = $1', [claimId])
    expect(Number(c.amount_paise)).toBe(172_000)
    expect(await balance(u.bob)).toBe(before - 172_000)
    await rejects(rpc(u.carol, 'select public.claim_listing($1) v', [id]), 'RIO_UNAVAILABLE')
    await rejects(rpc(u.bob, 'select public.claim_listing($1) v', [id]), 'RIO_UNAVAILABLE')
    await rejects(
      as(db, u.carol, (tx) => tx.query(`insert into public.claims (listing_id, claimer_id, amount_paise) values ($1, $2, 1)`, [id, u.carol])),
      'permission denied',
    )
  })

  it('the partial unique index rejects a second open claim even if the lock were bypassed', async () => {
    const id = await newListing(u.alice, { category: 'other' })
    await admin(db, `insert into public.claims (listing_id, claimer_id, amount_paise) values ($1, $2, 100)`, [id, u.bob])
    await rejects(
      admin(db, `insert into public.claims (listing_id, claimer_id, amount_paise) values ($1, $2, 100)`, [id, u.carol]),
      'claims_one_open_per_listing',
    )
  })

  it('rejects own-listing claims, hoarding, insufficient funds and final-hour claims', async () => {
    const own = await newListing(u.alice, { category: 'foam-mattress' })
    await rejects(rpc(u.alice, 'select public.claim_listing($1) v', [own]), 'RIO_OWN_LISTING')

    const second = await newListing(u.alice) // bob already has an air cooler claim
    await rejects(rpc(u.bob, 'select public.claim_listing($1) v', [second]), 'RIO_CATEGORY_LIMIT')

    const pricey = await newListing(u.alice, { category: 'study-table-chair', start: 9_000_000, floor: 8_000_000 })
    await rejects(rpc(u.carol, 'select public.claim_listing($1) v', [pricey]), 'RIO_INSUFFICIENT_FUNDS')

    const closing = await newListing(u.alice, { category: 'drafter-board', listedHoursAgo: 100, departsInHours: 0.5 })
    await rejects(rpc(u.carol, 'select public.claim_listing($1) v', [closing]), 'RIO_TRADING_CLOSED')

    await rejects(rpc(u.warden, 'select public.claim_listing($1) v', [own]), 'RIO_STUDENTS_ONLY')
  })

  it('cancelling refunds escrow and the listing can be claimed again', async () => {
    const id = await newListing(u.alice, { category: 'kettle-immersion', start: 50_000, floor: 15_000 })
    const before = await balance(u.carol)
    const first = await rpc<string>(u.carol, 'select public.claim_listing($1) v', [id])
    await rpc(u.carol, 'select public.cancel_claim($1) v', [first])
    expect(await balance(u.carol)).toBe(before)
    await rejects(rpc(u.carol, 'select public.cancel_claim($1) v', [first]), 'RIO_ILLEGAL_STATE')
    const second = await rpc<string>(u.carol, 'select public.claim_listing($1) v', [id])
    expect(second).not.toBe(first)
    await rpc(u.alice, 'select public.cancel_claim($1) v', [second]) // seller may decline too
    await rejects(rpc(u.dave, 'select public.cancel_claim($1) v', [second]), 'RIO_NOT_PARTY')
  })
})

describe('QR handover tokens', () => {
  let listing: string
  let claim: string

  beforeAll(async () => {
    listing = await newListing(u.alice, { category: 'drafter-board', start: 45_000, floor: 15_000 })
    claim = await rpc<string>(u.carol, 'select public.claim_listing($1) v', [listing])
  })

  it('only the giver can issue, codes are stored hashed and the hash is unreadable', async () => {
    await rejects(issue(u.carol, 'CLAIM', claim), 'RIO_NOT_PARTY')
    const t = await issue(u.alice, 'CLAIM', claim)
    expect(t.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/)
    const stored = await admin<{ h: string }>(db, `select encode(token_hash, 'hex') h from public.handover_tokens where id = $1`, [t.token_id])
    expect(stored[0].h).toHaveLength(64)
    expect(stored[0].h).not.toContain(t.code)
    await rejects(
      as(db, u.alice, (tx) => tx.query('select token_hash from public.handover_tokens')),
      'permission denied',
    )
  })

  it('rejects wrong receivers, malformed, expired and replaced codes', async () => {
    const t = await issue(u.alice, 'CLAIM', claim)
    await rejects(consume(u.bob, t.code), 'RIO_NOT_RECEIVER')
    await rejects(consume(u.alice, t.code), 'RIO_NOT_RECEIVER')
    await rejects(consume(u.carol, 'not-a-code'), 'RIO_INVALID_CODE')
    await rejects(consume(u.carol, 'ZZZZZZZZZZZZZZZZ'), 'RIO_INVALID_CODE')

    await admin(db, `update public.handover_tokens set expires_at = now() - interval '1 second' where id = $1`, [t.token_id])
    await rejects(consume(u.carol, t.code), 'RIO_CODE_EXPIRED')

    const a = await issue(u.alice, 'CLAIM', claim)
    await issue(u.alice, 'CLAIM', claim)
    await rejects(consume(u.carol, a.code), 'RIO_CODE_REPLACED')
  })

  it('settles exactly once: payout on first scan, reuse rejected', async () => {
    const t = await issue(u.alice, 'CLAIM', claim)
    const sellerBefore = await balance(u.alice)
    const res = await consume(u.carol, t.code.toLowerCase().replace(/(.{4})/g, '$1-'))
    expect(res.purpose).toBe('CLAIM')
    expect(await balance(u.alice)).toBe(sellerBefore + 45_000)
    expect((await one<{ status: string }>(db, 'select status from public.listings where id = $1', [listing])).status).toBe('SOLD')
    await rejects(consume(u.carol, t.code), 'RIO_CODE_USED')
    expect(await balance(u.alice)).toBe(sellerBefore + 45_000)
    await rejects(issue(u.alice, 'CLAIM', claim), 'RIO_ILLEGAL_STATE')
  })

  it('the ledger refuses to apply the same settlement key twice', async () => {
    await rejects(admin(db, `select private.post_ledger($1, 'SALE_PAYOUT', 45000, 'claim:' || $2 || ':payout')`, [u.alice, claim]), 'RIO_DUPLICATE_SETTLEMENT')
  })
})

describe('rentals and rent-to-own', () => {
  it('charges rent + deposit, enforces the departure buffer and one rental at a time', async () => {
    const id = await newListing(u.alice, { category: 'study-table-chair', start: 150_000, floor: 40_000, rentable: true, departsInHours: 200 })
    await rejects(rpc(u.bob, `select public.start_rental($1, 'MONTH') v`, [id]), 'RIO_RENTAL_TOO_LONG')
    const before = await balance(u.bob)
    const rental = await rpc<string>(u.bob, `select public.start_rental($1, 'WEEK') v`, [id])
    const r = await one<{ rent_paise: string; deposit_paise: string }>(db, 'select rent_paise::text, deposit_paise::text from public.rentals where id = $1', [
      rental,
    ])
    expect([Number(r.rent_paise), Number(r.deposit_paise)]).toEqual([15_000, 30_000])
    expect(await balance(u.bob)).toBe(before - 45_000)
    await rejects(rpc(u.carol, `select public.start_rental($1, 'DAY') v`, [id]), 'RIO_UNAVAILABLE')
    await rejects(rpc(u.carol, 'select public.claim_listing($1) v', [id]), 'RIO_UNAVAILABLE')

    const nonRentable = await newListing(u.alice, { category: 'other' })
    await rejects(rpc(u.bob, `select public.start_rental($1, 'DAY') v`, [nonRentable]), 'RIO_NOT_RENTABLE')
  })

  it('pickup pays rent to the owner; a clean return refunds the full deposit', async () => {
    const id = await newListing(u.alice, { category: 'foam-mattress', start: 120_000, floor: 30_000, rentable: true })
    const renterStart = await balance(u.carol)
    const ownerStart = await balance(u.alice)
    const rental = await rpc<string>(u.carol, `select public.start_rental($1, 'DAY') v`, [id])

    await rejects(issue(u.alice, 'RENTAL_RETURN', rental), 'RIO_ILLEGAL_STATE')
    const pickup = await issue(u.alice, 'RENTAL_PICKUP', rental)
    await consume(u.carol, pickup.code)
    expect(await balance(u.alice)).toBe(ownerStart + 2_400)

    await rejects(issue(u.alice, 'RENTAL_RETURN', rental), 'RIO_NOT_PARTY') // renter gives on return
    const ret = await issue(u.carol, 'RENTAL_RETURN', rental)
    await consume(u.alice, ret.code)
    expect(await balance(u.carol)).toBe(renterStart - 2_400)
    const r = await one<{ status: string }>(db, 'select status from public.rentals where id = $1', [rental])
    expect(r.status).toBe('RETURNED')
    expect((await one<{ status: string }>(db, 'select status from public.listings where id = $1', [id])).status).toBe('ACTIVE')
  })

  it('rent-to-own credits 50% of rent, respects the floor and refunds the deposit', async () => {
    const id = await newListing(u.alice, { category: 'kettle-immersion', start: 50_000, floor: 45_000, rentable: true, departsInHours: 800 })
    const rental = await rpc<string>(u.dave, `select public.start_rental($1, 'MONTH') v`, [id]) // rent ₹125, deposit ₹100
    await rejects(rpc(u.dave, 'select public.convert_rental_to_purchase($1) v', [rental]), 'RIO_ILLEGAL_STATE') // not picked up
    await consume(u.dave, (await issue(u.alice, 'RENTAL_PICKUP', rental)).code)
    const before = await balance(u.dave)
    const buy = await rpc<string>(u.dave, 'select public.convert_rental_to_purchase($1) v', [rental])
    // current ₹500 − credit ₹62.50 = ₹437.50 → floor ₹450 applies
    expect(Number(buy)).toBe(45_000)
    expect(await balance(u.dave)).toBe(before + 10_000 - 45_000)
    await rejects(rpc(u.dave, 'select public.convert_rental_to_purchase($1) v', [rental]), 'RIO_ILLEGAL_STATE')
    expect((await one<{ status: string }>(db, 'select status from public.listings where id = $1', [id])).status).toBe('SOLD')
  })
})

describe('disputes', () => {
  it('damage reported on return: only a scoped, uninvolved warden decides; 25% of deposit goes to the owner', async () => {
    const id = await newListing(u.alice, { category: 'air-cooler', start: 180_000, floor: 50_000, rentable: true })
    const rental = await rpc<string>(u.carol, `select public.start_rental($1, 'DAY') v`, [id]) // deposit ₹360
    await consume(u.carol, (await issue(u.alice, 'RENTAL_PICKUP', rental)).code)
    const ret = await issue(u.carol, 'RENTAL_RETURN', rental)
    await rejects(consume(u.alice, ret.code, true, 'short'), 'RIO_REASON_REQUIRED')
    const res = await consume(u.alice, (await issue(u.carol, 'RENTAL_RETURN', rental)).code, true, 'Cracked water tank and missing grille')
    const disputeId = res.dispute_id

    await rejects(rpc(u.bob, `select public.resolve_dispute($1, 'RESOLVED_DAMAGE', 'nope nope') v`, [disputeId]), 'RIO_NOT_AUTHORIZED')
    await rejects(rpc(u.wardenB, `select public.resolve_dispute($1, 'RESOLVED_DAMAGE', 'other hostel') v`, [disputeId]), 'RIO_NOT_AUTHORIZED')
    await rejects(rpc(u.warden, `select public.resolve_dispute($1, 'RESOLVED_RELEASE', 'continue rental') v`, [disputeId]), 'RIO_INVALID_OUTCOME')

    const owner = await balance(u.alice)
    const renter = await balance(u.carol)
    await rpc(u.warden, `select public.resolve_dispute($1, 'RESOLVED_DAMAGE', 'Photos confirm damage') v`, [disputeId])
    expect(await balance(u.alice)).toBe(owner + 9_000)
    expect(await balance(u.carol)).toBe(renter + 27_000)
    await rejects(rpc(u.warden, `select public.resolve_dispute($1, 'RESOLVED_REFUND', 'again!') v`, [disputeId]), 'RIO_DISPUTE_CLOSED')
  })

  it('claim disputes freeze escrow and can be refunded; evidence must be the reporter’s own upload', async () => {
    const id = await newListing(u.alice, { category: 'other', start: 20_000, floor: 10_000 })
    const claim = await rpc<string>(u.bob, 'select public.claim_listing($1) v', [id])
    await rejects(
      rpc(u.bob, 'select public.open_dispute($1, null, $2, $3) v', [claim, 'Item not as described at all', `${u.alice}/x.png`]),
      'RIO_INVALID_EVIDENCE',
    )
    await rejects(rpc(u.carol, 'select public.open_dispute($1, null, $2) v', [claim, 'I am not even involved here']), 'RIO_NOT_PARTY')
    const before = await balance(u.bob)
    const dispute = await rpc<string>(u.bob, 'select public.open_dispute($1, null, $2, $3) v', [claim, 'Item not as described at all', `${u.bob}/photo.png`])
    await rejects(issue(u.alice, 'CLAIM', claim), 'RIO_ILLEGAL_STATE')
    await rpc(u.warden, `select public.resolve_dispute($1, 'RESOLVED_REFUND', 'Seller agreed') v`, [dispute])
    expect(await balance(u.bob)).toBe(before + 20_000)
    expect((await one<{ status: string }>(db, 'select status from public.claims where id = $1', [claim])).status).toBe('REFUNDED')
  })

  it('private evidence is readable only by parties and scoped wardens', async () => {
    const path = (await admin<{ evidence_path: string }>(db, `select evidence_path from public.disputes where evidence_path is not null`))[0].evidence_path
    await admin(db, `insert into storage.objects (bucket_id, name, owner) values ('dispute-evidence', $1, $2)`, [path, u.bob])
    const read = (who: string | null) =>
      as(db, who, async (tx) => (await tx.query(`select name from storage.objects where bucket_id = 'dispute-evidence' and name = $1`, [path])).rows.length)
    expect(await read(u.bob)).toBe(1)
    expect(await read(u.alice)).toBe(1)
    expect(await read(u.warden)).toBe(1)
    expect(await read(u.carol)).toBe(0)
    expect(await read(u.wardenB)).toBe(0)
    expect(await read(null)).toBe(0)
  })

  it('storage uploads are confined to the uploader’s own folder', async () => {
    await rejects(
      as(db, u.bob, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('listing-media', $1)`, [`${u.alice}/l/evil.png`])),
      'row-level security',
    )
    await as(db, u.bob, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('listing-media', $1)`, [`${u.bob}/l/ok.png`]))
  })
})

describe('final-hour staff transfers', () => {
  it('routes only in the final hour, only by a scoped warden, and custody transfers once', async () => {
    const early = await newListing(u.alice, { category: 'other', departsInHours: 5 })
    await rejects(rpc(u.warden, 'select public.route_to_staff($1) v', [early]), 'RIO_NOT_ROUTABLE')

    const id = await newListing(u.alice, { category: 'other', listedHoursAgo: 48, departsInHours: 0.5 })
    await rejects(rpc(u.bob, 'select public.route_to_staff($1) v', [id]), 'RIO_NOT_AUTHORIZED')
    await rejects(rpc(u.wardenB, 'select public.route_to_staff($1) v', [id]), 'RIO_NOT_AUTHORIZED')
    const transfer = await rpc<string>(u.warden, 'select public.route_to_staff($1) v', [id])
    await rejects(rpc(u.warden, 'select public.route_to_staff($1) v', [id]), 'RIO_ALREADY_ROUTED')

    const t = await issue(u.alice, 'STAFF_CUSTODY', transfer)
    await rejects(consume(u.bob, t.code), 'RIO_NOT_RECEIVER')
    await rejects(consume(u.wardenB, t.code), 'RIO_NOT_RECEIVER')
    await consume(u.staff, t.code)
    expect((await one<{ status: string }>(db, 'select status from public.listings where id = $1', [id])).status).toBe('STAFF_CUSTODY')
    await rejects(consume(u.warden, t.code), 'RIO_CODE_USED')
    await rejects(issue(u.alice, 'STAFF_CUSTODY', transfer), 'RIO_ILLEGAL_STATE')
  })

  it('wardens get scoped impact and no-dues reports', async () => {
    const impact = await as(db, u.warden, async (tx) => one<{ items_diverted: string }>(tx, 'select * from public.impact_summary($1)', [hostelA]))
    expect(Number(impact.items_diverted)).toBeGreaterThan(0)
    await rejects(
      as(db, u.wardenB, (tx) => tx.query('select * from public.impact_summary($1)', [hostelA])),
      'RIO_NOT_AUTHORIZED',
    )
    await rejects(
      as(db, u.bob, (tx) => tx.query('select * from public.no_dues_report($1)', [hostelA])),
      'RIO_NOT_AUTHORIZED',
    )
    const report = await as(
      db,
      u.warden,
      async (tx) => (await tx.query<{ user_id: string; cleared: boolean }>('select * from public.no_dues_report($1)', [hostelA])).rows,
    )
    expect(report.find((r) => r.user_id === u.alice)?.cleared).toBe(false)
  })
})

describe('ledger integrity', () => {
  it('every wallet balance equals the sum of its sandbox ledger entries', async () => {
    const rows = await admin<{ user_id: string; diff: string }>(
      db,
      `select w.user_id, (w.balance_paise - coalesce(sum(e.amount_paise), 0))::text diff
       from public.wallet_accounts w left join public.ledger_entries e on e.user_id = w.user_id
       group by w.user_id, w.balance_paise`,
    )
    expect(rows.length).toBeGreaterThan(5)
    for (const r of rows) expect(Number(r.diff)).toBe(0)
    expect(await admin(db, 'select 1 from public.ledger_entries where not is_sandbox')).toHaveLength(0)
  })
})
