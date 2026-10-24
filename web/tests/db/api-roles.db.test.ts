/**
 * Regression tests for failures that only appeared against the live API:
 * everything the app SELECTs as an ordinary role must be executable by that
 * role, including functions reached through views.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { as, createTestDb, createUser, type Db } from './harness'

let db: Db
let owner = ''
let other = ''
let listing = ''

const CARD_COLUMNS =
  'id, title, status, condition, is_rentable, category_slug, category_name, start_price_paise, floor_price_paise, current_price_paise, listed_at, departure_at, hostel_name, cover_path, cover_alt'

beforeAll(async () => {
  db = await createTestDb()
  owner = await createUser(db, 'api-owner@test.local')
  other = await createUser(db, 'api-other@test.local')
  listing = await as(
    db,
    owner,
    async (tx) =>
      (
        await tx.query<{ id: string }>(
          `insert into public.listings (title, category_slug, start_price_paise, floor_price_paise, departure_at)
         values ('Priced lamp', 'other', 100000, 50000, now() + interval '10 days') returning id`,
        )
      ).rows[0].id,
  )
})

describe('queries the app runs as ordinary roles', () => {
  it.each([
    ['anonymous visitor', () => null],
    ['another student', () => other],
    ['the owner', () => owner],
  ])('the live price on listing_cards is readable by %s', async (_label, who) => {
    const rows = await as(
      db,
      who(),
      async (tx) => (await tx.query<{ current_price_paise: string }>(`select ${CARD_COLUMNS} from public.listing_cards where id = $1`, [listing])).rows,
    )
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].current_price_paise)).toBe(100_000)
  })

  it('the owner can still read the live price once the listing is reserved', async () => {
    await as(db, other, (tx) => tx.query('select public.claim_listing($1)', [listing]))
    const mine = await as(
      db,
      owner,
      async (tx) => (await tx.query(`select ${CARD_COLUMNS} from public.listing_cards where owner_id = $1 order by created_at desc`, [owner])).rows,
    )
    expect(mine).toHaveLength(1)
    // The buyer sees it too (counterparty), anonymous visitors no longer do.
    expect(
      await as(db, other, async (tx) => (await tx.query(`select current_price_paise from public.listing_cards where id = $1`, [listing])).rows),
    ).toHaveLength(1)
    expect(
      await as(db, null, async (tx) => (await tx.query(`select current_price_paise from public.listing_cards where id = $1`, [listing])).rows),
    ).toHaveLength(0)
  })

  it('ordinary roles cannot reach the private schema directly', async () => {
    await expect(as(db, other, (tx) => tx.query(`select private.post_ledger($1, 'OPENING_CREDIT', 100000, 'x')`, [other]))).rejects.toThrow(/permission denied/)
  })
})
