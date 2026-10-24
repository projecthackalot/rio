# Evaluating RIO

A guide for anyone reviewing the project: what it is, how to run it, how to check it, and
what is simulated. Everything below runs from the `web/` folder unless noted.

## What RIO is

A move-out marketplace for university hostels. Students list what they can't take home, the
price falls toward their floor as departure nears, buyers claim items, and ownership changes
hands with a one-time QR code. Unsold items are routed to campus staff in the owner's final
hour. Next.js 16 + React 19 + TypeScript on Supabase (Postgres with Row Level Security, Auth,
Storage). **All payments are simulated sandbox money.**

## 1. Start it (about 3 minutes)

```bash
cd web
npm install
npm run doctor        # checks every connection; tells you exactly what to fix
npm run dev           # http://localhost:3000
```

`npm run doctor` must show no failures before the signed-in features work. Free Supabase
projects pause after about a week of inactivity; if the doctor reports **"project PAUSED"**,
open the Supabase dashboard, open the project and choose **Restore project** (takes a few
minutes), then run the doctor again.

## 2. Sign in with the demo accounts

Created by `npm run seed:demo`. The password is the value of `RIO_DEMO_PASSWORD` in
`web/.env.local` (ask the project owner; it is not committed).

| Role             | Email                                       | Try                                                                |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Student (seller) | `priya.demo@rio.test`                       | List an item, show a handover code from My activity                |
| Student (buyer)  | `rohan.demo@rio.test`                       | Save an item, claim it, scan or type the seller's code on Handover |
| Student          | `zoya.demo@rio.test`, `aarav.demo@rio.test` | Rentals; Aarav has items in their final hour                       |
| Warden           | `warden.demo@rio.test`                      | Final-hour routing, disputes, no-dues, impact                      |
| Staff            | `staff.demo@rio.test`                       | Accept custody of routed items                                     |
| Admin            | `admin.demo@rio.test`                       | Grant roles scoped to hostels                                      |

A two-browser walk-through of the core loop: sign in as Priya in one window and Rohan in a
private window; Priya lists an item → Rohan claims it → Priya opens My activity → _Show
handover code_ → Rohan opens Handover and enters the code → the sale settles, and using the
same code again is refused.

## 3. Run the checks

| Command                                                     | What it proves                                                                                                                                                                                           | Needs the database? |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `npm run lint`, `npm run typecheck`, `npm run format:check` | code quality gates                                                                                                                                                                                       | no                  |
| `npm test`                                                  | business rules, route policy, and **every migration + RLS policy executed in a real Postgres (PGlite)**                                                                                                  | no                  |
| `npm run build`                                             | production build                                                                                                                                                                                         | no                  |
| `npm run test:e2e`                                          | Playwright + axe accessibility, phone and desktop                                                                                                                                                        | no (public pages)   |
| `npm run test:selenium`                                     | **Selenium WebDriver** in Chrome: every public page, navigation, search, forms, access control, console/connection errors, phone layouts; signed-in purchase and rental journeys when the database is up | journeys only       |
| `npm run doctor`                                            | live connections: DNS, REST, Auth, database, migrations, privileges, demo sign-in                                                                                                                        | yes                 |
| `E2E_FULL=1 npm run test:e2e`                               | signed-in Playwright journey                                                                                                                                                                             | yes                 |
| `pytest tests` (repo root)                                  | legacy Streamlit prototype engine                                                                                                                                                                        | no                  |

Latest results are in [docs/level-1/TEST_PLAN.md](docs/level-1/TEST_PLAN.md).

## 4. Where to look in the code

| Topic                                  | Location                                                         |
| -------------------------------------- | ---------------------------------------------------------------- |
| Pricing, rentals, money (pure, tested) | `web/src/domain/`                                                |
| Database schema, functions, RLS        | `web/supabase/migrations/`                                       |
| Who can open which page                | `web/src/lib/auth/route-policy.ts`                               |
| Server actions (all writes)            | `web/src/app/**/actions.ts`                                      |
| Business rules in plain language       | [docs/level-1/BUSINESS_RULES.md](docs/level-1/BUSINESS_RULES.md) |
| Security model                         | [docs/level-1/SECURITY.md](docs/level-1/SECURITY.md)             |

## 5. Honest scope

- **Simulated:** all money (escrow, payouts, deposits, refunds). No payment gateway.
- **Estimates:** environmental impact uses fixed category assumptions, not measurements.
- **Needs the owner's accounts:** Google sign-in (Google Cloud + Supabase provider), Supabase
  Auth redirect URLs for email links, and Vercel hosting. Steps: [docs/level-1/DEPLOY.md](docs/level-1/DEPLOY.md).
- **Not built yet:** notifications, chat, listing reports/moderation, search suggestions.
  Full list: [docs/level-1/KNOWN_LIMITATIONS.md](docs/level-1/KNOWN_LIMITATIONS.md).
