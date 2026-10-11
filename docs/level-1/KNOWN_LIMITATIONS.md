# Known limitations and deferred work

## Requires external configuration (not done in this repository)

- **Migrations aren't applied** to the Supabase project in `web/.env.local`. A read-only check
  of `/marketplace` returned `PGRST205` (relation not found) there. Apply them with
  SETUP.md §3.
- **Google OAuth** needs a Google Cloud OAuth client and the Supabase provider settings (SETUP.md §6).
- **Email links** need the Supabase redirect allow-list and, ideally, the `token_hash`
  templates (SETUP.md §5). Production email needs custom SMTP.
- **First admin and hostels** have to be created in the SQL editor (SETUP.md §4).

## Not verified here

- The signed-in journey E2E (`tests/e2e/journey.spec.ts`) and the live integration tests
  (`tests/integration/live.test.ts`, including truly concurrent claims) haven't been run.
  They need a migrated, seeded, disposable project. They're opt-in and skipped by default.
- The database tests run in **PGlite** (Postgres 18 in WASM) on top of a shim of Supabase's
  `auth` and `storage` schemas and default grants (`tests/db/supabase-shim.sql`). That's real
  Postgres executing the real migrations, but not Supabase itself, and it uses a single
  connection, so concurrency is tested by the row-lock + unique-index design and the live suite.
- No manual screen-reader audit, and no Lighthouse or performance benchmarks.
- Camera scanning uses `BarcodeDetector` or `jsQR`. It hasn't been tried on physical devices.

## Product limits in Level 1

- **Payments are simulated.** No gateway, no real payouts or refunds.
- Prices are recalculated on each request, not pushed live; pages show "price as of HH:MM".
  Moving a listing into staff custody needs a warden action. There's no scheduled job.
- Rentals have no overdue penalties or automatic reminders; `due_at` is informational.
- No notifications (email, SMS or push), and no in-app chat. Parties arrange meetings themselves.
- The no-dues check is informational and isn't connected to university systems.
- Wardens can't edit hostels in the UI. Hostels are added by SQL.
- Listings from students who haven't set a hostel have no scoped warden, so only an admin can route them to staff or decide their disputes. The dashboard prompts students to set a hostel.
- Hostel choice is self-declared by the student. Verification is deferred to Level 2 (campus SSO).
- No Content-Security-Policy header yet. Next.js inline scripts need a nonce-based CSP, deferred.
- A listing's photo descriptions share one alt text, numbered per photo.

## Deferred to Level 2 and 3

See LEVELS_ROADMAP.md: real payments (Razorpay or Stripe) with webhooks, notifications,
university identity verification, real no-dues integration, multi-campus tenancy,
moderation, and measured (rather than estimated) environmental impact.
