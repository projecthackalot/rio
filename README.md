# RIO: Circular Asset Handover

**Hyperlocal circular-economy platform for hostels & PGs.**  
Nothing moves. Nothing gets dumped.

> **Level 1.** A working, database-backed web app with real authentication. **All payments are simulated sandbox money.** Impact figures are estimates.

---

**Reviewing this project? Start with [EVALUATION.md](EVALUATION.md).**

## Web application (primary): `web/`

Next.js 16 + React 19 + TypeScript + Supabase (Postgres with Row Level Security, Auth, Storage).

```bash
cd web
npm install
cp .env.example .env.local      # Supabase URL + anon key (never commit .env.local)
# apply web/supabase/migrations to your Supabase project (docs/level-1/SETUP.md §3)
npm run dev                     # http://localhost:3000
```

| | Status |
|---|---|
| Email/password, magic link, password reset, logout | implemented (needs Supabase Auth URL config) |
| Google OAuth | implemented; **needs your Google Cloud client + Supabase provider settings** |
| Marketplace, listings with photos, Dutch auction, claims, QR handovers, rentals, rent-to-own, disputes, warden and staff dashboards, admin roles | implemented |
| Database schema, RLS, storage policies | 6 forward migrations; **you apply them** (`npm run db:migrate`) (not yet applied to the project in `.env.local`) |
| Payments | **simulated only** (Level 2: real gateway) |

Verification (last run, 2026-10-24, Next.js 16.4.2): lint, typecheck and format pass; **165 Vitest tests**
(including 53 database-policy tests), **59 Playwright + axe checks** and **41 Selenium WebDriver tests** pass, the
Selenium signed-in journeys running against the live Supabase project (purchase + rating, rental, photo upload, report
moderation, warden); production build passes; 45 legacy pytest tests pass. See
[docs/level-1/TEST_PLAN.md](docs/level-1/TEST_PLAN.md).

Documentation: [Setup](docs/level-1/SETUP.md) · [Architecture](docs/level-1/ARCHITECTURE.md) ·
[Data model](docs/level-1/DATA_MODEL.md) · [Business rules](docs/level-1/BUSINESS_RULES.md) ·
[Security](docs/level-1/SECURITY.md) · [Accessibility](docs/level-1/ACCESSIBILITY.md) ·
[Known limitations](docs/level-1/KNOWN_LIMITATIONS.md) · [Roadmap](docs/level-1/LEVELS_ROADMAP.md)

---

## Quick Start (Streamlit Prototype) - Legacy

If you wish to run the original Streamlit prototype (which operates with in-memory simulated data):


```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the app
streamlit run app.py

# 3. Run tests
pytest tests/ -v
```

The app opens at `http://localhost:8501` with layout=wide.

---

## 2-Minute Demo Script (legacy Streamlit prototype)

1. **Marketplace at t=0** — Show the item grid with full prices. Note the urgency badges (FRESH), watchers, and CO₂ impact on each card.

2. **Slide the time slider** — Drag from 0 → 84h (mid-auction). Watch prices drop in real time. Point out the price-decay progress bars.

3. **Claim an item** — As "Priya", claim an Air Cooler. Verify wallet deducts, item shows in My Activity with a QR code. Try claiming a second Air Cooler to trigger the anti-hoarding block.

4. **Rent an item** — Switch to "Rohan". Go to the Rent tab, rent a Study Table for a Day. Return it — verify deposit refunded.

5. **Rent-to-own** — Rent an item, then click "Convert to buy". Show the credit math: `Price - 50% rent credit = final price (≥ floor)`.

6. **Staff welfare pool** — Slide to 167h (final hour before Aarav's departure). Items vanish from Marketplace and appear in the Warden's staff queue. Confirm custody transfer.

7. **Warden Dashboard** — Switch to Warden. Show metrics (CO₂ avoided, waste diverted), charts, no-dues panel. Toggle no-dues for a settled student.

8. **List a new item** — Switch to any student, go to My Activity, fill the "List a new item" form. Verify it appears in Marketplace immediately.

---

## Legacy prototype architecture

| File | Purpose |
|---|---|
| `app.py` | Entry point: page config, sidebar, tabs |
| `rio/engine.py` | Pure logic (no Streamlit imports): pricing, status, impact, rules |
| `rio/data.py` | Seed data: users, items, pre-seeded history |
| `rio/ui.py` | CSS, card renderers, badges, charts, fmt_inr() |
| `tests/test_engine.py` | pytest suite |

### Key Design Decisions

- **All state in `st.session_state`** — guarded by `if 'initialized' not in st.session_state`. Button clicks and slider changes never reset state.
- **Simulated clock** — `sim_hour` drives all pricing and status. No real `datetime` used.
- **Engine is pure Python** — no Streamlit imports, fully unit-testable.
- **Deterministic seed** — app always loads identically after Reset.

---

## Legacy prototype limitations

These apply to the Streamlit demo only; the web app addresses them (see docs/level-1/KNOWN_LIMITATIONS.md for its own limits).


1. **No persistence** — all data lives in memory. Refreshing the browser tab resets state (but slider/button interactions within a session are stable).
2. **No real payments** — wallet balances are mock.
3. **No authentication** — "Viewing as" is a simple selectbox.
4. **QR codes** are decorative — they encode item metadata but there's no scanner integration.
5. **Impact estimates** use approximate embodied-carbon coefficients, not measured values.
6. **No image upload** — proof video uploader accepts files but only displays a SHA-256 hash.
7. **Single browser tab** — concurrent multi-user sessions are not supported.
# rio
