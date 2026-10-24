import { beforeAll, describe, expect, it } from 'vitest'
import { admin, as, createTestDb, createUser, rejects, type Db } from './harness'

let db: Db
let alice = ''
let bob = ''
let carol = ''
let active = ''
let hidden = ''

beforeAll(async () => {
  db = await createTestDb()
  alice = await createUser(db, 'fav-alice@test.local')
  bob = await createUser(db, 'fav-bob@test.local')
  carol = await createUser(db, 'fav-carol@test.local')
  const insert = (title: string) =>
    as(
      db,
      alice,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            `insert into public.listings (title, category_slug, start_price_paise, floor_price_paise) values ($1, 'other', 1000, 500) returning id`,
            [title],
          )
        ).rows[0].id,
    )
  active = await insert('Visible lamp')
  hidden = await insert('Withdrawn lamp')
  await as(db, alice, (tx) => tx.query('select public.set_listing_availability($1, false)', [hidden]))
})

describe('saved items', () => {
  it('are saved per user, idempotently, and only the owner of the save can see or remove them', async () => {
    await as(db, bob, (tx) => tx.query('insert into public.favorites (listing_id) values ($1)', [active]))
    await rejects(
      as(db, bob, (tx) => tx.query('insert into public.favorites (listing_id) values ($1)', [active])),
      'favorites_pkey',
    )

    const mine = await as(db, bob, async (tx) => (await tx.query('select listing_id from public.favorites')).rows)
    expect(mine).toEqual([{ listing_id: active }])
    // Not visible to another student, nor to the seller.
    expect(await as(db, carol, async (tx) => (await tx.query('select * from public.favorites')).rows)).toHaveLength(0)
    expect(await as(db, alice, async (tx) => (await tx.query('select * from public.favorites')).rows)).toHaveLength(0)

    const removedByOther = await as(db, carol, async (tx) => (await tx.query('delete from public.favorites where listing_id = $1', [active])).affectedRows)
    expect(removedByOther).toBe(0)
    const removed = await as(db, bob, async (tx) => (await tx.query('delete from public.favorites where listing_id = $1', [active])).affectedRows)
    expect(removed).toBe(1)
  })

  it('cannot be created for someone else, for a listing the user cannot see, or anonymously', async () => {
    await rejects(
      as(db, bob, (tx) => tx.query('insert into public.favorites (user_id, listing_id) values ($1, $2)', [carol, active])),
      'permission denied',
    )
    await rejects(
      as(db, bob, (tx) => tx.query('insert into public.favorites (listing_id) values ($1)', [hidden])),
      'row-level security',
    )
    await rejects(
      as(db, null, (tx) => tx.query('insert into public.favorites (listing_id) values ($1)', [active])),
      'permission denied',
    )
    await rejects(
      as(db, null, (tx) => tx.query('select * from public.favorites')),
      'permission denied',
    )
    expect(await admin(db, 'select 1 from public.favorites')).toHaveLength(0)
  })
})
