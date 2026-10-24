# RIO web app (Level 1)

The Next.js 16 + Supabase application for RIO, a move-out marketplace for hostels.
Students list what they can't take home. The price falls towards their floor as departure
nears, items change hands with a single-use QR code, and anything unsold is routed to campus
staff in the final hour. **All payments are simulated sandbox money.**

## Quick start

```bash
npm install
cp .env.example .env.local     # add your Supabase URL + anon key
# apply supabase/migrations to your project: see ../docs/level-1/SETUP.md §3
npm run dev                    # http://localhost:3000
```

Optional demo data for a development project:
`RIO_DEMO_SEED=true RIO_DEMO_PASSWORD='…' npm run seed:demo` (SETUP.md §7).

## Scripts

| Script                                        | Purpose                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `dev` / `build` / `start`                     | Next.js                                                                                              |
| `lint`, `typecheck`, `format`, `format:check` | ESLint, `tsc`, Prettier                                                                              |
| `test`                                        | Vitest: domain, database (PGlite) and opt-in live suites                                             |
| `test:unit`, `test:db`, `test:integration`    | individual suites                                                                                    |
| `test:e2e`                                    | Playwright + axe (run `build` first; it starts `next start` on port 3100)                            |
| `db:migrate`                                  | apply pending migrations using `SUPABASE_DB_URL` (TLS verified)                                      |
| `doctor`                                      | read-only check of every connection (env, DNS, REST, Auth, DB, migrations, privileges, demo sign-in) |
| `test:selenium`                               | Selenium WebDriver suite in headless Chrome (run `build` first)                                      |
| `seed:photos` | adds freely licensed demo photos (Wikimedia Commons) to demo listings |
| `seed:demo`                                   | guarded demo seed (never in production)                                                              |
| `verify`                                      | format check, lint, typecheck, tests and build                                                       |

## Features

- **Auth:** email/password with confirmation, magic link, password reset, Google OAuth,
  logout. Every signup is a student; elevated roles are granted only by an admin.
- **Marketplace:** server-side search, category, condition, price range, rentable filter,
  sorting and pagination. The live Dutch-auction price is shown with the floor, deadline and
  decay progress.
- **Listings:** create and edit with photos (validated by magic bytes, stored in your own
  storage folder), withdraw and relist. Re-pricing restarts the auction.
- **Claims:** atomic, one open claim per listing, anti-hoarding, sandbox escrow, cancel before handover.
- **QR handovers:** expiring, single-use, hashed, receiver-bound codes. Camera scanning
  (`BarcodeDetector` or a lazily loaded `jsQR`) with manual entry always available.
- **Rentals:** day, week or month; deposit; pickup and return by QR; a rent-to-own
  breakdown and conversion.
- **Disputes:** private evidence; decisions by a scoped, uninvolved warden; 25% damage deduction on deposits.
- **Warden dashboard:** final-hour queue and routing to staff, open disputes, staff
  transfers, no-dues check, estimated impact.
- **Staff custody:** queue plus QR acceptance. **Admin:** scoped role management with an audit trail.
- **Photos:** compressed in the browser (≈200 KB full image + ≈20 KB preview), served straight from Supabase Storage.
- **Trust:** seller ratings after completed transactions, report-a-listing with warden moderation, share button.
- **Saved items:** a heart on every listing, private to you, with a Saved page.
- **Public pages:** How it works, About, Campus impact, Trust and safety, Help, Contact, Privacy, Terms, Accessibility; sitemap and robots.
- **My Activity:** buying, selling, rentals, staff handoffs, listings, and the full sandbox ledger.

## Documentation

`../docs/level-1/`: [SETUP](../docs/level-1/SETUP.md),
[ARCHITECTURE](../docs/level-1/ARCHITECTURE.md),
[DATA_MODEL](../docs/level-1/DATA_MODEL.md),
[BUSINESS_RULES](../docs/level-1/BUSINESS_RULES.md),
[SECURITY](../docs/level-1/SECURITY.md),
[ACCESSIBILITY](../docs/level-1/ACCESSIBILITY.md),
[TEST_PLAN](../docs/level-1/TEST_PLAN.md),
[KNOWN_LIMITATIONS](../docs/level-1/KNOWN_LIMITATIONS.md),
[LEVELS_ROADMAP](../docs/level-1/LEVELS_ROADMAP.md).
