# Known limitations and deferred work

## Requires external configuration (not done in this repository)

- **Done on 2026-10-12:** all migrations are applied and recorded on the Supabase project in `web/.env.local`, and demo data is seeded.
- **As of 2026-10-23 the Supabase project is paused** (free projects pause after ~7 idle days; the project hostname no longer resolves). Restore it in the Supabase dashboard; `npm run doctor` confirms when it is back. Once deployed on Vercel, the daily keep-alive cron prevents this.
- **Google OAuth** needs a Google Cloud OAuth client and the Supabase provider settings (SETUP.md §6).
- **Email links** need the Supabase redirect allow-list and, ideally, the `token_hash`
  templates (SETUP.md §5). Production email needs custom SMTP.
- **First admin and hostels** have to be created in the SQL editor (SETUP.md §4).

## Not verified here

- **Run on 2026-10-12 against the live project and passing:** the signed-in journey E2E (list → claim → code handover → settlement, reuse rejected, warden view) on desktop Chrome, and the live integration tests (REST role/wallet escalation refused, room privacy, two simultaneous claims with exactly one winner, private evidence). Not yet exercised live: rentals, rent-to-own, disputes, staff custody and photo upload through the UI (covered by the PGlite database tests only), and the mobile project for the journey.
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
- Privacy, Terms and Contact pages are plain-language pilot notices, not legally reviewed documents. There is no support email or desk yet; Contact points to in-app disputes and the public issue tracker.
- Mobile filters use a collapsible panel plus category chips, not a bottom sheet. Item pages have no sticky mobile action bar.
- Not built: search suggestions, recently viewed, price-history charts, notifications, chat and offers (see COMPETITORS.md for priorities). Listing reports, seller ratings and sharing were added on 2026-10-24.
- Demo listing photos are freely licensed Wikimedia Commons images of each category (credited on the listing and in `web/scripts/demo-photos/CREDITS.md`), not photos of real items.
- HEIC photos (iPhone default) are converted only in browsers that can decode HEIC (Safari); in Chrome on Windows the uploader asks for a JPEG/PNG instead.
- The sitemap lists static public pages only, not individual listings (they expire at departure).

## Deferred to Level 2 and 3

See LEVELS_ROADMAP.md: real payments (Razorpay or Stripe) with webhooks, notifications,
university identity verification, real no-dues integration, multi-campus tenancy,
moderation, and measured (rather than estimated) environmental impact.
