# Deploying RIO for free (Vercel Hobby + Supabase Free)

The app is set up to stay inside both free tiers. This page lists what is already
configured in the repository, what you do once in each dashboard, and the limits to watch.

## Already configured in the repository

| What | Where | Why |
|---|---|---|
| Function region `syd1` | `web/vercel.json` | The Supabase project is in Sydney (`ap-southeast-2`). Server rendering makes several database calls per page, so the server should sit next to the database. |
| Daily keep-alive cron | `web/vercel.json` → `/api/keepalive` | Supabase pauses free projects after about a week without activity. One small public read a day keeps it awake. Vercel Hobby allows daily crons. |
| Image budget | `web/next.config.ts` | WebP only, four widths, 31-day cache. Each (image × width × format) counts against Vercel's free image-transformation allowance. |
| 4 MB upload cap per save | `web/src/lib/validation/listing.ts` | Vercel rejects request bodies above about 4.5 MB. |
| Self-hosted fonts | `web/src/app/fonts` | No build-time network calls. |
| Static shells | Partial Prerendering | Public pages are served from the CDN; only the personalized part runs a function. |

## One-time steps (need your accounts)

### 1. Vercel

1. Push the repository to GitHub.
2. On [vercel.com](https://vercel.com) choose **Add New → Project**, import `projecthackalot/rio`.
3. Set **Root Directory** to `web`. Framework is detected as Next.js.
4. Add environment variables (Production and Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | same as `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as `.env.local` |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` (**required**: auth emails and Google sign-in use it) |
   | `CRON_SECRET` | any long random string (protects the keep-alive endpoint) |

   Do **not** add `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` or `RIO_DEMO_*`. The running app doesn't use them.
5. Deploy. After the first deploy, copy the final URL into `NEXT_PUBLIC_SITE_URL` if it differs, and redeploy.

### 2. Supabase Auth URLs

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://<your-project>.vercel.app`
- **Redirect URLs** (add all four):
  - `https://<your-project>.vercel.app/auth/callback`
  - `https://<your-project>.vercel.app/auth/confirm`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`

Without these, confirmation, magic-link and reset emails point at the wrong site.

### 3. Email templates (recommended)

Supabase → **Authentication → Email Templates**. Replace the link in each template so links
work on any device (see SETUP.md §5 for the exact values).

Supabase's built-in email sender is limited to a few emails per hour, which is enough for a
demo but not for a real pilot. For real use, add a free SMTP provider under
**Authentication → SMTP Settings**.

### 4. Google sign-in

1. [Google Cloud Console](https://console.cloud.google.com) → create a project → **APIs & Services → OAuth consent screen** → External → fill in app name and your email → publish.
2. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://<your-project>.vercel.app` and `http://localhost:3000`
   - Authorized redirect URI: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
3. Supabase → **Authentication → Providers → Google** → enable, paste the Client ID and Client secret, save.

The app's Google button already works once this is saved. New Google users become students.

### 5. First administrator and hostels

See SETUP.md §4. The demo seed already created a demo campus, two hostels and demo accounts.

## Free-tier limits to keep in mind

| Limit | Effect on RIO |
|---|---|
| Vercel Hobby is for personal, non-commercial use | Fine for a student pilot. A paid campus rollout needs a paid plan. |
| Vercel request body ~4.5 MB | Photo uploads are capped at 4 MB per save. |
| Vercel image transformations (monthly allowance) | Tuned down; listings without photos use built-in drawings that cost nothing. |
| Supabase Free: 500 MB database, 1 GB file storage | Roughly a few thousand listing photos at phone-camera sizes. |
| Supabase Free pauses after ~7 idle days | Handled by the daily keep-alive, once deployed with the cron. |
| Supabase built-in email: a few per hour | Add SMTP before inviting many users. |
| Database region is Sydney | Pages feel slower from India than a Mumbai project would. A free project can't be moved; a new Mumbai project plus `npm run db:migrate` is the fix if this matters. |

Limits change; check the providers' pricing pages before relying on a number.
