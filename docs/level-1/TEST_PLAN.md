# Test plan and results

Run from `web/` unless noted. Results below are from the last local run (Windows 11,
Node 25.2.1, Chrome via Selenium Manager), dated 2026-10-23, on **Next.js 16.4.2**.

| Command | What it covers | Last result |
|---|---|---|
| `npm run format:check` | Prettier | pass |
| `npm run lint` | ESLint (Next core-web-vitals, TypeScript, React hooks purity) | pass, 0 problems |
| `npm run typecheck` | `tsc --noEmit` (strict) | pass |
| `npm test` | Domain, route policy, database (PGlite) suites | **165 passed, 5 skipped** (the live suite skips unless `RIO_LIVE_TESTS` is set) |
| `npm run build` | Production build (41 routes, Partial Prerendering) | pass |
| `npm run test:e2e` | Playwright on Pixel 7 + desktop Chrome, with axe | **59 passed, 7 skipped** |
| `npm run test:selenium` | Selenium WebDriver (headless Chrome) | **41 passed, 1 skipped** against the live project (signed-in journeys skip without `RIO_DEMO_PASSWORD`) |
| `npm run doctor` | Live connection check | **fails: Supabase project paused** (DNS for the project no longer resolves) |
| `pytest tests` (repo root) | Legacy Streamlit engine | **45 passed** |

## 1. Domain unit tests: `src/**/*.test.ts` (112 tests)

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
- **Route policy matrix** (`src/lib/auth/route-policy.test.ts`): every public page, item pages and auth
  routes are open to anonymous visitors; each protected prefix maps to the access it needs; look-alike
  paths aren't matched by accident.
- Marketplace filters: invalid values are dropped; a reversed price range is swapped and flagged.
- The original 19 prototype-API tests (`src/lib/engine.test.ts`) still pass through the
  compatibility layer.

## 2. Database tests: `tests/db/*.db.test.ts` (53 tests, PGlite)

Includes `thumbnails.db.test.ts` (thumbnail path rules) and `trust.db.test.ts` (reports, ratings, warden scope).

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
- **Saved items** (`favorites.db.test.ts`): private per user (hidden from other students and the seller),
  can't be created for someone else, for a listing the user can't see, or anonymously.
- **Backfill** (`backfill.db.test.ts`): an account that pre-dates the new schema gets a student profile,
  wallet and opening credit, ignoring any role in its metadata.
- **Ledger integrity:** every wallet balance equals the sum of its ledger entries, and
  every entry is sandbox.

Limitation: PGlite uses a single connection. True parallelism is covered by the live suite.

## 2b. Selenium WebDriver: `tests/selenium/` (`npm run test:selenium`)

Runs real headless Chrome through WebDriver against the production build (started
automatically on port 3400). Every page load also fails the test on **browser console errors or
failed network requests**, so broken connections can't pass silently.

- `public.test.ts` (35 tests, always run): all 15 public and auth pages render their heading with
  no console/connection errors; every footer link opens a real page; 404 page; skip link moves
  focus; home search lands on the marketplace with the query; the marketplace shows listings
  when the database is up and an honest inline error (never a crash page) when it is down;
  reversed price range is corrected; category chips filter; sign-up validates on the server and
  has no role selector; wrong credentials give a generic message even with the backend down;
  eight protected routes redirect to sign-in with `next`; open redirects refused; no sideways
  scrolling at 320 and 360 px and the phone navigation bar is present.
- `journey.test.ts` (5 tests, need the live backend + `RIO_DEMO_PASSWORD`): two browser
  sessions act as seller and buyer. Purchase: list → save (persists to Saved page) → claim →
  seller reveals code → buyer enters it → settles once → reuse rejected → seller sees
  Completed. Rental: book → pickup by code → return by code → deposit refunded. Warden overview
  loads with no console errors. A student is refused warden and admin screens.

## 3. Live integration: `tests/integration/live.test.ts` (opt-in, not run)

Against a disposable migrated and seeded Supabase project
(`RIO_TEST_SUPABASE_URL`, `RIO_TEST_SUPABASE_ANON_KEY`, `RIO_TEST_PASSWORD`): REST role and
wallet escalation, room privacy, **two simultaneous claims from separate sessions with
exactly one winner**, and private evidence listing.

## 4. End-to-end: `tests/e2e/`

- `public.spec.ts` (runs by default): **anonymous marketplace access (no redirect)**; home search →
  marketplace URL; nine public content pages render with axe; every footer link resolves; sitemap and
  robots; **no sideways scrolling at 320 and 360 px** on eight pages. Also: landing content and axe; skip link; 404 status, page
  and axe; security headers; sign-in options and axe; **signup server-side validation with
  no role selector**, `aria-invalid`, value retention and axe; reset, magic-link,
  check-email and auth-error pages with axe; eight protected routes redirect to sign-in
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
