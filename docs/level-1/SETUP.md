# Setup: local development, Supabase, Google OAuth, deployment

Everything in this guide is configured **outside the code**. The repository
contains no credentials, and the app never falls back to mock authentication.
If Supabase isn't configured, pages that need data show an error.

## 1. Prerequisites

- Node.js 20 or newer (verified with Node 25.2 and npm 11.7)
- A Supabase project. Pick the **Mumbai (ap-south-1)** region for Indian campuses and
  deploy the app close to it (Vercel `bom1`).
- Optional: Docker plus the Supabase CLI (`npx supabase`) for a fully local stack.
  Not needed for the database test suite, which runs Postgres in-process (PGlite).

## 2. Install and configure

```bash
cd web
npm install
cp .env.example .env.local   # .env.local is git-ignored
```

Fill in `.env.local`:

| Variable | Where it comes from | Exposed to the browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | yes (public by design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, `anon` key | yes (public by design; RLS enforces access) |
| `NEXT_PUBLIC_SITE_URL` | e.g. `http://localhost:3000`. **Required in production.** Auth email links and the OAuth callback are built from it, never from request headers (prevents reset-link poisoning). | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, `service_role` key. **Only for the demo seed script.** Leave empty in production. | **never** |
| `RIO_DEMO_SEED`, `RIO_DEMO_PASSWORD` | your choice. Seed guard and demo account password. | never |

Never put the service-role key in a `NEXT_PUBLIC_*` variable. The running app doesn't use it.

## 3. Apply the database migrations

Migrations live in `web/supabase/migrations/` and must be applied in filename order:

| File | Purpose |
|---|---|
| `20231009000000_initial_schema.sql` | original prototype schema (unchanged) |
| `20231010000000_auth_trigger.sql` | original signup trigger (unchanged) |
| `20261010000100_admin_role.sql` | adds the `admin` role |
| `20261010000200_core_schema.sql` | campuses/hostels, paise money, private profile data, ledger, tokens, disputes, transfers, audit |
| `20261010000300_functions.sql` | business RPCs, signup provisioning, read models |
| `20261010000400_rls_and_grants.sql` | revokes Supabase's default grants; RLS and column-level grants |
| `20261010000500_storage.sql` | `listing-media` (public) and `dispute-evidence` (private) buckets and policies |
| `20261012000100_favorites.sql` | saved items, private per user |
| `20261012000200_price_function_no_private_call.sql` | fix: live price readable by ordinary roles |

**With the bundled script (no CLI or Docker needed):** add `SUPABASE_DB_URL` (Supabase → Connect →
Session pooler URI) to `.env.local`, then:

```bash
npm run db:migrate -- --dry-run
npm run db:migrate -- --mark-applied=20231009000000,20231010000000   # only if those two were run by hand
npm run db:migrate
```

It applies pending files in order, one transaction each, records them in Supabase's migration
history, and always verifies TLS (set `SUPABASE_DB_CA_CERT` to Supabase's CA file if needed).

**With the Supabase CLI:**

```bash
cd web
npx supabase init            # only if web/supabase/config.toml doesn't exist yet; keep existing migrations
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

If the two 2023 migrations were already run by hand in the SQL editor (so the CLI doesn't
know about them), mark them as applied first:
`npx supabase migration repair --status applied 20231009000000 20231010000000`.

**Without the CLI:** paste each file into Supabase → SQL Editor and run them one at a time,
in order. `20261010000100` must run (and commit) before the rest.

> The forward migrations convert existing data: numeric prices become paise, `items` is renamed
> to `listings`, room numbers move to `profile_private`, wallet balances become a ledger, and the
> prototype `ledger` is kept as `legacy_ledger`. Back up any real data first.

## 4. Campus data and the first administrator

Hostels are reference data. Add yours in the SQL editor:

```sql
insert into public.campuses (name, city) values ('Sharda University', 'Greater Noida');
insert into public.hostels (campus_id, name)
select id, h from public.campuses, unnest(array['Boys Hostel A', 'Girls Hostel B']) as h
where name = 'Sharda University';
```

Everyone who signs up becomes a **student**. Bootstrap one administrator from the SQL editor
(it runs as the database owner, so this is the only path that doesn't require an existing admin):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@your-campus.edu');
```

From then on, the admin grants warden or staff roles, scoped to hostels, in the app at **/admin/roles**.

## 5. Supabase Auth configuration

**Authentication → URL Configuration**

- Site URL: `http://localhost:3000` for development, or your production origin.
- Redirect URLs (allow-list). Add each origin you use:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`
  - `https://<your-domain>/auth/callback`
  - `https://<your-domain>/auth/confirm`

**Authentication → Providers → Email:** keep **Confirm email** on (recommended). The app
handles the no-session case by sending users to "Check your email".

**Authentication → Email Templates (recommended).** Use `token_hash` links so a link opened on
a different device or browser still works. The app's `emailRedirectTo` already contains
`/auth/confirm?next=…`, so each template appends to it:

| Template | Link `href` |
|---|---|
| Confirm signup | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup` |
| Magic link | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink` |
| Reset password | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery` |
| Change email | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change` |

The default templates (`{{ .ConfirmationURL }}`) also work: `/auth/confirm` accepts the PKCE
`code` parameter too. But PKCE links only work in the browser that requested them.

For production, set up custom SMTP (Authentication → SMTP). Supabase's built-in mailer is
heavily rate-limited.

## 6. Google OAuth (not configured in this repository)

1. In **Google Cloud Console → APIs & Services → OAuth consent screen**, choose External.
   Add the app name, a support email, and authorized domains (your app's domain).
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins: `http://localhost:3000`, `https://<your-domain>`
   - Authorized redirect URI: **`https://<your-project-ref>.supabase.co/auth/v1/callback`**
     (Supabase's callback, not the app's)
3. In **Supabase → Authentication → Providers → Google**, enable it and paste the client ID
   and client secret.
4. The app sends users to Google with `redirectTo = <site>/auth/callback?next=…`. That URL
   must be on the Supabase redirect allow-list (step 5).

New Google users are provisioned as **students** by the same database trigger. Any role in the
OAuth metadata is ignored.

## 7. Demo data (development and demo projects only)

```bash
cd web
RIO_DEMO_SEED=true RIO_DEMO_PASSWORD='choose-a-long-password' npm run seed:demo
```

This creates a demo campus and two hostels, plus these accounts, all sharing your chosen password:
`priya.demo@rio.test`, `rohan.demo@rio.test`, `aarav.demo@rio.test`, `zoya.demo@rio.test`
(students), `warden.demo@rio.test` (warden, Hostel A), `staff.demo@rio.test` (staff, Hostel A),
and `admin.demo@rio.test`. Listings are created at different auction stages, relative to now,
including one already in its final hour. The script refuses to run without `RIO_DEMO_SEED=true`,
in production, or without a password.

Seeded listings have no photos (cards show category illustrations). Upload real photos through
the app.

## 8. Run

```bash
npm run dev        # http://localhost:3000
npm run build && npm start
```

## 9. Deploy (Vercel)

Full free-tier guide: [DEPLOY.md](DEPLOY.md). Summary:

1. Import the repository and set **Root Directory** to `web`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL`
   (your production origin). **Don't** set `SUPABASE_SERVICE_ROLE_KEY`.
3. Set the function region close to the database (Project → Settings → Functions → `bom1` for
   a Mumbai Supabase project).
4. Add the production `/auth/callback` and `/auth/confirm` URLs to Supabase (step 5) and the
   production origin to the Google client (step 6).
