/** Listing reports with warden moderation, and seller ratings tied to completed transactions. */
import { beforeAll, describe, expect, it } from 'vitest'
import { admin, as, createTestDb, createUser, rejects, type Db } from './harness'

let db: Db
let hostel = ''
const u = { seller: '', buyer: '', other: '', warden: '' }
const rpc = <T = unknown>(who: string | null, sql: string, params: unknown[] = []) =>
  as(db, who, async (tx) => (await tx.query<{ v: T }>(sql, params)).rows[0]?.v as T)

async function listing(title = 'Lamp') {
  return as(
    db,
    u.seller,
    async (tx) =>
      (
        await tx.query<{ id: string }>(
          `insert into public.listings (title, category_slug, start_price_paise, floor_price_paise) values ($1, 'other', 1000, 500) returning id`,
          [title],
        )
      ).rows[0].id,
  )
}

beforeAll(async () => {
  db = await createTestDb()
  const campus = (await admin<{ id: string }>(db, `insert into public.campuses (name) values ('Trust Campus') returning id`))[0].id
  hostel = (await admin<{ id: string }>(db, `insert into public.hostels (campus_id, name) values ($1, 'Trust Hostel') returning id`, [campus]))[0].id
  for (const k of Object.keys(u) as (keyof typeof u)[]) u[k] = await createUser(db, `${k}@trust.test`)
  await admin(db, `update public.profiles set hostel_id = $1`, [hostel])
  await admin(db, `update public.profiles set role = 'warden' where id = $1`, [u.warden])
  await admin(db, `insert into public.hostel_assignments (user_id, hostel_id) values ($1, $2)`, [u.warden, hostel])
})

describe('listing reports', () => {
  it('a member reports once; owners cannot report themselves; reporters stay anonymous to owners', async () => {
    const id = await listing()
    const reportId = await rpc<string>(u.buyer, `select public.report_listing($1, 'misleading', 'Photo is not the real item') v`, [id])
    expect(reportId).toBeTruthy()
    await rejects(rpc(u.buyer, `select public.report_listing($1, 'scam') v`, [id]), 'RIO_ALREADY_REPORTED')
    await rejects(rpc(u.seller, `select public.report_listing($1, 'scam') v`, [id]), 'RIO_OWN_LISTING')
    expect(await as(db, u.seller, async (tx) => (await tx.query('select * from public.listing_reports')).rows)).toHaveLength(0)
    expect(await as(db, u.other, async (tx) => (await tx.query('select * from public.listing_reports')).rows)).toHaveLength(0)
    expect(await as(db, u.warden, async (tx) => (await tx.query('select id from public.listing_reports')).rows)).toHaveLength(1)
    await rejects(
      as(db, u.buyer, (tx) => tx.query(`insert into public.listing_reports (listing_id, reporter_id, reason) values ($1, $2, 'scam')`, [id, u.buyer])),
      'permission denied',
    )
  })

  it('listings hidden from the reporter look the same as missing ones (no existence oracle)', async () => {
    const id = await listing('Hidden lamp')
    await admin(db, `update public.listings set status = 'WITHDRAWN' where id = $1`, [id])
    await rejects(rpc(u.other, `select public.report_listing($1, 'scam') v`, [id]), 'RIO_NOT_FOUND')
    await rejects(rpc(u.other, `select public.report_listing(gen_random_uuid(), 'scam') v`), 'RIO_NOT_FOUND')
    await rejects(rpc(u.seller, `select public.report_listing($1, 'scam') v`, [id]), 'RIO_OWN_LISTING')
  })

  it('only a scoped, uninvolved warden can act; removing withdraws the listing and closes its reports', async () => {
    const id = await listing('Fake cooler')
    const r1 = await rpc<string>(u.buyer, `select public.report_listing($1, 'scam') v`, [id])
    await rpc(u.other, `select public.report_listing($1, 'scam') v`, [id])
    await rejects(rpc(u.other, `select public.review_report($1, 'remove') v`, [r1]), 'RIO_NOT_AUTHORIZED')
    await rpc(u.warden, `select public.review_report($1, 'remove') v`, [r1])
    expect((await admin<{ status: string }>(db, 'select status from public.listings where id = $1', [id]))[0].status).toBe('WITHDRAWN')
    expect(await admin(db, `select 1 from public.listing_reports where listing_id = $1 and status = 'OPEN'`, [id])).toHaveLength(0)
    await rejects(rpc(u.warden, `select public.review_report($1, 'dismiss') v`, [r1]), 'RIO_ILLEGAL_STATE')
  })
})

describe('seller ratings', () => {
  it('only the buyer of a completed purchase can rate, once, and the summary is public', async () => {
    const id = await listing('Chair')
    const claim = await rpc<string>(u.buyer, 'select public.claim_listing($1) v', [id])
    await rejects(rpc(u.buyer, `select public.rate_transaction($1, null, 5::smallint) v`, [claim]), 'RIO_NOT_RATEABLE') // not handed over yet
    const t = await as(
      db,
      u.seller,
      async (tx) => (await tx.query<{ code: string }>(`select * from public.issue_handover_token('CLAIM', $1)`, [claim])).rows[0],
    )
    await rpc(u.buyer, `select public.consume_handover_token($1) v`, [t.code])

    await rejects(rpc(u.other, `select public.rate_transaction($1, null, 1::smallint) v`, [claim]), 'RIO_NOT_RATEABLE')
    await rejects(rpc(u.buyer, `select public.rate_transaction($1, null, 6::smallint) v`, [claim]), 'RIO_INVALID_INPUT')
    await rpc(u.buyer, `select public.rate_transaction($1, null, 4::smallint, 'Smooth handover') v`, [claim])
    await rejects(rpc(u.buyer, `select public.rate_transaction($1, null, 5::smallint) v`, [claim]), 'RIO_ALREADY_RATED')

    const summary = await as(
      db,
      null,
      async (tx) => (await tx.query<{ ratings: string; average: string }>('select * from public.seller_rating($1)', [u.seller])).rows[0],
    )
    expect([Number(summary.ratings), Number(summary.average)]).toEqual([1, 4])
    // Members see the rating but not who left it.
    await rejects(
      as(db, u.other, (tx) => tx.query('select rater_id from public.seller_ratings')),
      'permission denied',
    )
    expect(await as(db, u.other, async (tx) => (await tx.query('select stars, comment from public.seller_ratings')).rows)).toEqual([
      { stars: 4, comment: 'Smooth handover' },
    ])
    await rejects(
      as(db, u.buyer, (tx) =>
        tx.query(`insert into public.seller_ratings (seller_id, rater_id, claim_id, stars) values ($1, $2, $3, 5)`, [u.seller, u.buyer, claim]),
      ),
      'permission denied',
    )
  })
})
