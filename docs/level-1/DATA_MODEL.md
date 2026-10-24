# Data model (as built)

Source of truth: `web/supabase/migrations/`. All money columns are `bigint` paise.

## Tables

| Table | Purpose | Key constraints |
|---|---|---|
| `campuses`, `hostels` | Reference data | unique (campus, name) |
| `categories` | Category coefficients (estimates) and default prices | slug PK |
| `profiles` | Public part of a user: name, avatar, `role` (`student`/`warden`/`staff`/`admin`), hostel | 1:1 with `auth.users`. Users may update only `full_name`, `avatar_url`, `hostel_id` (column grants). |
| `profile_private` | Block, room, phone, planned departure | Readable by the owner and wardens of the owner's hostel only |
| `hostel_assignments` | Which hostels a warden or staff member may act on | PK (user, hostel). Written only by `admin_set_role`. |
| `listings` | Marketplace items (forward-migrated from `items`) | `0 < floor < start ≤ ₹1,00,000`, `listing_status` enum, generated `tsvector`, indexes for market, departure and owner queries |
| `listing_media` | Photos in the `listing-media` bucket | path must be `<owner uid>/<listing id>/<file>`, ≤ 6 per listing |
| `claims` | Purchases held in sandbox escrow | partial unique index: one open claim per listing |
| `rentals` | Rentals (`DAY`/`WEEK`/`MONTH`) | partial unique index: one open rental per listing |
| `wallet_accounts` | Cached sandbox balance | `balance_paise ≥ 0` |
| `ledger_entries` | Every simulated money movement | `idempotency_key UNIQUE` (no double settlement), `is_sandbox CHECK (true)`, `balance_after_paise ≥ 0` |
| `handover_tokens` | Single-use QR codes | `token_hash` (SHA-256) unique, `expires_at`, `consumed_at`, `revoked_at`. Clients can't read the hash. |
| `disputes` | Problems with a claim or rental | exactly one subject. One open dispute per claim or rental. |
| `staff_transfers` | Final-hour routing to staff | `UNIQUE(listing_id)`. Acceptance fields must match the status. |
| `listing_reports` | Reports on listings | one open report per person per listing; visible to the reporter and scoped wardens, never to the seller |
| `seller_ratings` | 1–5 stars after a completed purchase or returned rental | unique per transaction; rater hidden from everyone |
| `favorites` | Saved items | PK (user, listing). Readable and removable only by the saver; no counts exposed. |
| `audit_events` | Role changes and every state-changing RPC | readable by admins and scoped wardens |
| `legacy_ledger` | The prototype's ledger, kept read-only | no client access |

## State machines

Defined in `src/domain/stateMachine.ts` and enforced by the RPCs (each locks the row and
checks the current state).

- **Listing:** `ACTIVE → RESERVED | RENTED | WITHDRAWN | STAFF_PENDING`; `RESERVED → ACTIVE | SOLD | DISPUTED`;
  `RENTED → ACTIVE | SOLD | DISPUTED`; `WITHDRAWN → ACTIVE`; `STAFF_PENDING → STAFF_CUSTODY`; `SOLD` and `STAFF_CUSTODY` are terminal.
- **Claim:** `PENDING_HANDOVER → COMPLETED | CANCELLED | DISPUTED`; `DISPUTED → COMPLETED | REFUNDED`.
- **Rental:** `PENDING_PICKUP → ACTIVE | CANCELLED | DISPUTED`; `ACTIVE → RETURNED | CONVERTED | DISPUTED`;
  `DISPUTED → RETURNED | CANCELLED | ACTIVE | PENDING_PICKUP`.
- **Dispute:** `OPEN → RESOLVED_REFUND | RESOLVED_RELEASE | RESOLVED_DAMAGE`.
- **Staff transfer:** `PENDING → ACCEPTED`.

## Functions (RPCs)

All are `SECURITY DEFINER`, `search_path = ''`, executable by `authenticated` only:

`claim_listing`, `cancel_claim`, `start_rental`, `cancel_rental`, `convert_rental_to_purchase`,
`issue_handover_token`, `consume_handover_token`, `open_dispute`, `resolve_dispute`,
`route_to_staff`, `set_listing_availability`, `admin_set_role`, `impact_summary`, `no_dues_report`.

Policy helpers: `my_role`, `is_admin`, `has_hostel_scope`, `is_listing_counterparty`,
`is_listing_owner_or_scoped`, `can_read_evidence`. Internal helpers live in the non-exposed
`private` schema (`post_ledger`, `audit`, `crockford`, `normalize_code`, …).

`listing_cards` is a `security_invoker` view, so the caller's RLS applies.

## Storage

| Bucket | Visibility | Write | Read |
|---|---|---|---|
| `listing-media` | public | own `<uid>/` folder, JPEG/PNG/WebP/AVIF, bucket cap 5 MB (app allows 4 MB per save) | anyone |
| `dispute-evidence` | private | own `<uid>/` folder, images or PDF, bucket cap 5 MB (app allows 4 MB) | uploader, the other party, scoped wardens (5-minute signed URLs) |
