import { expect, it } from 'vitest'
import { admin, createTestDb } from './harness'

it('gives accounts that pre-date the new schema a student profile, wallet and opening credit', async () => {
  let legacyId = ''
  const db = await createTestDb({
    beforeMigration: {
      // Simulates the hosted project: a user created under the old schema whose profile was never written.
      '20261010000300': async (d) => {
        await d.exec('alter table auth.users disable trigger on_auth_user_created')
        legacyId = (
          await d.query<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ('old@test.local', '{"role":"admin"}') returning id`)
        ).rows[0].id
        await d.exec('alter table auth.users enable trigger on_auth_user_created')
      },
    },
  })
  const [p] = await admin<{ role: string; full_name: string }>(db, 'select role, full_name from public.profiles where id = $1', [legacyId])
  expect(p).toEqual({ role: 'student', full_name: 'old' })
  const [w] = await admin<{ b: string }>(db, 'select balance_paise::text b from public.wallet_accounts where user_id = $1', [legacyId])
  expect(Number(w.b)).toBe(300_000)
  expect(await admin(db, 'select 1 from public.profile_private where user_id = $1', [legacyId])).toHaveLength(1)
})
