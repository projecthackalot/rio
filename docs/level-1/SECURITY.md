# Security and authorization (as built)

## Fixed in Level 1

| Issue in the prototype schema / app | Fix |
|---|---|
| Signup accepted a user-chosen `role` and created the profile with the service-role key (removed in the working tree before this work; the trigger hardcoded `student`) | No role field anywhere in signup. `handle_new_user` always creates `student` for email and OAuth signups and ignores metadata. Zod drops unknown fields. Tested. |
| `profiles` UPDATE policy let users set their own `role` and `wallet_balance` | Column grants: users may update only `full_name`, `avatar_url`, `hostel_id`. The wallet moved to `wallet_accounts` + `ledger_entries`, which clients can't write. Tested. |
| `profiles` SELECT `using (true)` exposed room numbers to everyone, including anonymous users | Room, block, phone and departure moved to `profile_private` (owner + scoped wardens). Profiles readable by signed-in users only. Tested. |
| Claims insert policy was self-referential, and `UNIQUE(item_id)` blocked re-claiming | Claims are written only by `claim_listing` (row lock + partial unique index). Tested. |
| No storage policies | Per-bucket policies, owner-folder writes, private evidence. Tested. |
| Signup redirected to `/dashboard` with no session | Sends users to "Check your email" when confirmation is required |
| Raw auth errors were put in the URL | Generic messages, no account enumeration, no secrets logged |

## Authentication

- Supabase Auth with SSR cookies (`@supabase/ssr`). JWTs are verified with `getClaims()` in
  the proxy and the DAL.
- Email/password (confirmation on), magic link (existing accounts only), password reset,
  Google OAuth (PKCE callback at `/auth/callback`), and email links at `/auth/confirm`.
- Auth email links and OAuth callbacks use `NEXT_PUBLIC_SITE_URL`, not the request's Host headers, so a forged header can't poison reset links. In production the app fails closed if it isn't set.
- Post-login redirects go through `safeNext()`: same-origin paths only, never `/auth/*`.
  Tested against `//evil`, `/\evil`, `https://…` and `javascript:`.
- Passwords: 8–72 characters with a letter and a number (Supabase may enforce stricter rules).

## Authorization model

| Role | Can |
|---|---|
| student | list, edit and withdraw own listings; claim, rent, return, convert; open disputes on own transactions |
| warden | everything in assigned hostels: see listings, claims, rentals and disputes, route final-hour items to staff, resolve disputes (not their own), accept custody, see no-dues and impact |
| staff | see and accept custody of items routed to staff in assigned hostels |
| admin | all hostels; grant and revoke roles (never their own), with audit |

Elevated roles can only be granted by `admin_set_role`, which re-checks that the caller is
an admin. The first admin is bootstrapped once from the SQL editor (SETUP.md §4).

**Defense in depth:** Supabase's default `ALL` grants to `anon`/`authenticated` are revoked.
Each table gets back only the privileges it needs (often column by column). Every
financial or state change goes through a `SECURITY DEFINER` RPC with `search_path = ''`.
Each RPC authenticates, locks rows, checks state and checks the caller's relationship to
the record.

## Payments

All payments are **simulated**. No payment provider is integrated, no card data is
collected, and every balance and amount is labelled as sandbox money. The ledger's
`is_sandbox` column can't be false. Every settlement step has a unique idempotency key,
so it can't be applied twice.

## Handover tokens

80-bit random codes, generated in Postgres with `gen_random_bytes`. Only the SHA-256 hash
is stored, and clients can't select the hash column. They expire after 10 minutes, are
consumed atomically, are replaced when re-issued, and are bound to the expected receiver.
The QR payload holds only `RIO:<code>`, no personal data.

## Uploads

Photos are checked in the Server Action (declared type, ≤ 4 MB per save, **magic bytes**) and again
by the bucket's MIME and size limits. Object paths are server-generated UUIDs inside the
uploader's folder.

## Secrets

- `.env.local` and all `.env.*` files are git-ignored. Only `.env.example` is committed.
- Only the Supabase URL and anon key are `NEXT_PUBLIC_*`. The service-role key is used only
  by the opt-in seed script and must not be set in production.

## Headers

`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self)`, no `X-Powered-By`.
A Content-Security-Policy is not configured yet (KNOWN_LIMITATIONS.md).
