# Architecture (as built)

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16.4 App Router, React 19.3, TypeScript (strict), `cacheComponents` + Partial Prefetching |
| Styling | Tailwind CSS 4 with a custom token system (`src/app/globals.css`). Self-hosted Bricolage Grotesque and Instrument Sans. |
| Data / auth / files | Supabase: Postgres + RLS, Auth (`@supabase/ssr` cookie sessions), Storage |
| Validation | Zod 4 on every Server Action and route handler |
| Tests | Vitest (domain + DB-in-PGlite + opt-in live integration), Playwright + axe-core |

The Streamlit prototype at the repository root is unchanged and still runs as a legacy demo.

## Request flow

```
Browser ── proxy.ts (refresh session cookie, bounce signed-out users from protected routes)
   │
   ├─ Server Components ── lib/auth/dal.ts (getClaims → profile, React cache per request)
   │        └─ lib/data/*.ts ── supabase-js as the USER (anon key + cookie) ── Postgres RLS
   │
   └─ Server Actions (Zod) ── supabase.rpc('claim_listing' | …) as the USER
                                   └─ SECURITY DEFINER function: auth.uid() → lock rows → check
                                      state & rights → write state + sandbox ledger + audit, one transaction
```

- **No service-role key at request time.** Every read and write runs as the signed-in user,
  so RLS and the RPCs' own checks always apply. There is no service-role client anywhere in
  `src/`; only the operator scripts in `scripts/` (seed, migrate, doctor) use privileged access.
- **Authorization happens three times:** an optimistic redirect in `proxy.ts`, a role check
  in the DAL/page, and the authoritative check in Postgres (RLS, column grants, and checks
  inside each RPC).

## Source layout (`web/`)

| Path | Contents |
|---|---|
| `src/domain/` | Pure, deterministic business rules in integer paise: `money`, `pricing`, `rental`, `impact`, `catalog`, `stateMachine`, `handoverCode`. Shared fixtures with SQL. |
| `src/lib/engine.ts` | Compatibility wrapper exposing the prototype's rupee/hour API on top of `src/domain` |
| `src/lib/auth/` | `dal.ts` (viewer and roles), `redirect.ts` (open-redirect guard) |
| `src/lib/data/` | Server-only query modules: marketplace, listings, activity, wallet, warden |
| `src/lib/validation/` | Zod schemas (auth, listing, photo magic-byte checks) |
| `src/lib/rpc-errors.ts` | `RIO_*` database error codes → user-facing messages |
| `src/app/(app)/` | Signed-in and browse pages with the shared header, tab bar and footer |
| `src/app/auth/` | Auth pages, `callback` (OAuth PKCE) and `confirm` (email `token_hash`/`code`) route handlers |
| `src/app/**/actions.ts` | Server Actions |
| `src/components/` | `ui/` design system, `brand/` (price tag, logo, category art), feature components |
| `supabase/migrations/` | Versioned SQL: schema, functions, RLS/grants, storage |
| `scripts/seed-demo.ts` | Guarded demo seed |
| `tests/db/` | PGlite harness + Supabase shim + policy and workflow tests |
| `tests/integration/` | Opt-in tests against a real Supabase project |
| `tests/e2e/` | Playwright specs (public + a11y; opt-in signed-in journey) |

## Rendering and performance

- Server Components by default. Client islands are limited to forms (`useActionState`), the
  nav's active state, the confirm dialog, the handover-code panel and the scanner.
- With `cacheComponents`, every session or `searchParams` read sits inside `<Suspense>`. Each
  page prerenders a static shell and streams the personalized part. Personalized data is
  never cached. `requestNow()` (`connection()` + `Date.now()`) marks time-dependent renders
  as request-time.
- The QR scanner is loaded with `next/dynamic` only after the user asks for the camera.
  `jsQR` is imported only when the browser lacks `BarcodeDetector`.
- QR codes are drawn from a module matrix computed on the server, so no QR library ships to
  the client.
- The marketplace is one paginated query against the `listing_cards` view (live price and
  cover image joined in SQL), filtered and sorted in Postgres with indexes on status, hostel,
  category, departure and full-text search. Activity pages run a fixed number of parallel
  queries, with names fetched in one batch, never per row.
- Images go through `next/image` (AVIF/WebP), restricted to the public `listing-media`
  bucket by `remotePatterns`.

No performance benchmarks were run. See KNOWN_LIMITATIONS.md.
