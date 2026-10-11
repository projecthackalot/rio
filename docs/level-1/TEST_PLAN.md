# Test plan and results

Run from `web/` unless noted. Results below are from the last local run (Windows 11,
Node 25.2.1), dated 2026-10-10.

| Command | What it covers | Last result |
|---|---|---|
| `npm run format:check` | Prettier | pass |
| `npm run lint` | ESLint (Next core-web-vitals, TypeScript, React hooks purity) | pass, 0 problems |
| `npm run typecheck` | `tsc --noEmit` (strict) | pass |
| `npm test` | All Vitest suites below | **118 passed, 5 skipped** (opt-in live suite) |
| `npm run build` | Production build (28 routes, Partial Prerendering) | pass |
| `npm run test:e2e` | Playwright on Pixel 7 + desktop Chrome, with axe | **29 passed, 5 skipped** (opt-in journey; keyboard test on desktop only) |
| `pytest tests` (repo root) | Legacy Streamlit engine | **45 passed** |

## 1. Domain unit tests: `src/**/*.test.ts` (80 tests)

- Money: half-up rounding (vs banker's), basis points, INR formatting, rejection of
  non-integer paise.
- Dutch auction: 11 shared fixtures (start, midpoint, ₹5 rounding, floor exactly 2h before
  departure, after departure, clock before listing, **floor never undercut by rounding**,
  **₹2.50 tie rounds up**, keeper, empty window, short window). Monotonic and bounded over
  a sweep. Phase boundaries at the exact millisecond (final hour, departed).
- Rentals: 2/10/25% rent, 20% deposit, rounding, the duration + 24h eligibility boundary,
  clean and damaged deposit settlement (25%).
- Rent-to-own: 50% credit, floor clamp with unused credit, odd-paisa rounding.
- State machines: happy paths and 9 illegal transitions.
- Handover codes: Crockford normalization, rejection of foreign QR payloads.
- `safeNext` open-redirect cases; Zod signup ignores `role`.
- The original 19 prototype-API tests (`src/lib/engine.test.ts`) still pass through the
  compatibility layer.

## 2. Database tests: `tests/db/rio.db.test.ts` (38 tests, PGlite)

Every migration (the two originals plus five new) runs in Postgres 18 (PGlite) on top of
`tests/db/supabase-shim.sql`, which reproduces Supabase's `auth.uid()`, roles, storage
schema and permissive default grants. Queries run as `authenticated` or `anon` with
JWT claims, just as PostgREST runs them.

- **Role escalation:** signup metadata `role: warden` is ignored. Updating your own role,
  wallet or ledger, or assigning yourself a hostel, is denied. Students and wardens calling
  `admin_set_role` are refused. Admins can't change their own role. Role changes are audited.
- **Unauthorized access:** room numbers are hidden from other students and other hostels'
  wardens. Anonymous users can't read profiles. Other people's wallets and ledgers are
  hidden, even from wardens.
- **Listings:** owner, status and hostel are forced server-side. Spoofed `owner_id` and
  direct status edits are denied. Price and departure validation. Withdrawn listings are
  hidden from anonymous users.
- **Price parity:** the same 11 fixtures asserted against `rio_current_price`.
- **Claims:** live price, escrow hold, competing claim rejected, direct inserts denied, the
  partial unique index backstop, own-listing, anti-hoarding, insufficient funds, final hour,
  non-student, cancel → refund → re-claim.
- **QR tokens:** only the giver can issue; hash-only storage, and the hash column is
  unreadable. Wrong receiver, malformed, **expired** and **replaced** codes are rejected.
  Settlement happens exactly once and **reuse is rejected**. A duplicate ledger key is
  rejected (no double settlement).
- **Rentals:** rent and deposit amounts, departure buffer, conflicting rental or claim
  rejected, non-rentable rejected, pickup pays the owner, clean return refunds the deposit,
  rent-to-own floor clamp and deposit refund, no double conversion.
- **Disputes:** damage reported on return, unauthorized and out-of-scope wardens refused,
  invalid outcome refused, 25% deduction split, decided disputes can't be decided again.
  Claim dispute → refund. Evidence must be the reporter's own upload.
- **Private media:** evidence visible only to the parties and scoped wardens. Uploads are
  confined to the uploader's own folder.
- **Staff transfers:** not routable early; only scoped wardens can route; can't be routed
  twice; custody is accepted by scoped staff only and can't be accepted twice.
  Impact and no-dues reports are scoped.
- **Ledger integrity:** every wallet balance equals the sum of its ledger entries, and
  every entry is sandbox.

Limitation: PGlite uses a single connection. True parallelism is covered by the live suite.

## 3. Live integration: `tests/integration/live.test.ts` (opt-in, not run)

Against a disposable migrated and seeded Supabase project
(`RIO_TEST_SUPABASE_URL`, `RIO_TEST_SUPABASE_ANON_KEY`, `RIO_TEST_PASSWORD`): REST role and
wallet escalation, room privacy, **two simultaneous claims from separate sessions with
exactly one winner**, and private evidence listing.

## 4. End-to-end: `tests/e2e/`

- `public.spec.ts` (runs by default): landing content and axe; skip link; 404 status, page
  and axe; security headers; sign-in options and axe; **signup server-side validation with
  no role selector**, `aria-invalid`, value retention and axe; reset, magic-link,
  check-email and auth-error pages with axe; seven protected routes redirect to sign-in
  with `next`; the open-redirect guard. Screenshots are saved to `test-results/screens/`.
- `journey.spec.ts` (opt-in: `E2E_FULL=1`, seeded project): seller lists → buyer claims →
  seller shows code → buyer enters code → settled. Code reuse is rejected. The seller's
  screen confirms the scan. A warden overview check.

## How to run the opt-in suites

```bash
# after applying migrations and seeding a DISPOSABLE project (docs/level-1/SETUP.md)
RIO_TEST_SUPABASE_URL=... RIO_TEST_SUPABASE_ANON_KEY=... RIO_TEST_PASSWORD=... npm run test:integration
E2E_FULL=1 RIO_DEMO_PASSWORD=... npm run test:e2e -- journey --project=desktop
```
