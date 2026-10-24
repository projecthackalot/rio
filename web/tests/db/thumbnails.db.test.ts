import { beforeAll, describe, expect, it } from 'vitest'
import { as, createTestDb, createUser, rejects, type Db } from './harness'

let db: Db
let owner = ''
let other = ''
let listing = ''

beforeAll(async () => {
  db = await createTestDb()
  owner = await createUser(db, 'thumb-owner@test.local')
  other = await createUser(db, 'thumb-other@test.local')
  listing = await as(
    db,
    owner,
    async (tx) =>
      (
        await tx.query<{ id: string }>(
          `insert into public.listings (title, category_slug, start_price_paise, floor_price_paise) values ('Lamp', 'other', 1000, 500) returning id`,
        )
      ).rows[0].id,
  )
})

describe('listing photo thumbnails', () => {
  it('the owner attaches a photo with its thumbnail, and cards expose the thumbnail', async () => {
    const full = `${owner}/${listing}/0b0c3e1a-0000-4000-8000-000000000001.webp`
    const thumb = `${owner}/${listing}/0b0c3e1a-0000-4000-8000-000000000001-thumb.webp`
    await as(db, owner, (tx) =>
      tx.query(`insert into public.listing_media (listing_id, storage_path, thumb_path, alt_text, position) values ($1, $2, $3, 'A lamp', 0)`, [
        listing,
        full,
        thumb,
      ]),
    )
    const card = await as(
      db,
      null,
      async (tx) =>
        (
          await tx.query<{ cover_path: string; cover_thumb_path: string }>('select cover_path, cover_thumb_path from public.listing_cards where id = $1', [
            listing,
          ])
        ).rows[0],
    )
    expect(card).toEqual({ cover_path: full, cover_thumb_path: thumb })
  })

  it('rejects a thumbnail outside the photo’s own folder', async () => {
    const full = `${owner}/${listing}/0b0c3e1a-0000-4000-8000-000000000002.webp`
    const elsewhere = `${other}/${listing}/0b0c3e1a-0000-4000-8000-000000000002-thumb.webp`
    await rejects(
      as(db, owner, (tx) =>
        tx.query(`insert into public.listing_media (listing_id, storage_path, thumb_path, alt_text, position) values ($1, $2, $3, 'A lamp', 1)`, [
          listing,
          full,
          elsewhere,
        ]),
      ),
      'listing_media_thumb_same_folder',
    )
  })

  it('photos without a thumbnail still work (older uploads)', async () => {
    const full = `${owner}/${listing}/0b0c3e1a-0000-4000-8000-000000000003.webp`
    await as(db, owner, (tx) =>
      tx.query(`insert into public.listing_media (listing_id, storage_path, alt_text, position) values ($1, $2, 'A lamp', 2)`, [listing, full]),
    )
  })
})
