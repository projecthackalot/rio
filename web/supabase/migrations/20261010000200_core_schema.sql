-- RIO Level 1 · 2/5 — core schema.
--
-- Forward migration from the prototype schema (20231009/20231010). It:
--   * moves all money to integer paise (bigint) — no numeric/float money,
--   * moves private room/contact data out of the world-readable profiles table,
--   * replaces the self-editable wallet_balance with a sandbox ledger,
--   * fixes claims.item_id UNIQUE (which blocked re-claiming after a cancel)
--     with a partial unique index on *open* claims,
--   * adds campuses/hostels, categories, listing media, handover tokens,
--     staff transfers, scoped warden/staff assignments and audit events.
-- Legacy rows are migrated, not discarded. RLS/grants live in 4/5.

create extension if not exists pgcrypto with schema extensions;

-- ── 0. Drop the prototype policies (they reference columns we change) ────
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "Active items are public." on public.items;
drop policy if exists "Users can insert their own items." on public.items;
drop policy if exists "Users can update their own items." on public.items;
drop policy if exists "Wardens can update any item." on public.items;
drop policy if exists "Involved parties can view claims." on public.claims;
drop policy if exists "Users can claim items." on public.claims;
drop policy if exists "Involved parties can view rentals." on public.rentals;
drop policy if exists "Users can insert rentals." on public.rentals;
drop policy if exists "Users can view their own ledger." on public.ledger;

-- Private helper schema: never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── 1. Campuses, hostels, categories ─────────────────────────────────────
create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 120),
  city text check (char_length(city) <= 80),
  created_at timestamptz not null default now()
);

create table public.hostels (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  unique (campus_id, name)
);
create index hostels_campus_idx on public.hostels (campus_id);

-- Coefficients are ESTIMATES carried over from the prototype (rio/engine.py).
create table public.categories (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null unique,
  tare_kg numeric(6, 2) not null check (tare_kg >= 0),
  volume_m3 numeric(6, 3) not null check (volume_m3 >= 0),
  embodied_co2e_kg numeric(7, 2) not null check (embodied_co2e_kg >= 0),
  default_start_paise bigint not null check (default_start_paise > 0),
  default_floor_paise bigint not null check (default_floor_paise > 0 and default_floor_paise < default_start_paise),
  sort_order smallint not null default 0
);

insert into public.categories (slug, name, tare_kg, volume_m3, embodied_co2e_kg, default_start_paise, default_floor_paise, sort_order) values
  ('air-cooler',        'Air cooler',             14.5, 0.28, 62.0, 180000, 50000, 1),
  ('foam-mattress',     'Foam mattress',          11.2, 0.35, 44.0, 120000, 30000, 2),
  ('kettle-immersion',  'Kettle / immersion rod',  1.2, 0.01, 15.5,  50000, 15000, 3),
  ('drafter-board',     'Drafter + board',         1.8, 0.04,  8.2,  45000, 15000, 4),
  ('study-table-chair', 'Study table + chair',    18.0, 0.42, 52.0, 150000, 40000, 5),
  ('other',             'Other hostel essentials', 0,    0,     0,    50000, 10000, 99)
on conflict (slug) do nothing;

-- ── 2. Profiles: public part + private part ──────────────────────────────
alter table public.profiles
  add column if not exists hostel_id uuid references public.hostels(id) on delete set null,
  add column if not exists avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500);

alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column updated_at set not null;
alter table public.profiles add constraint profiles_full_name_len check (char_length(full_name) between 1 and 80) not valid;
create index if not exists profiles_hostel_idx on public.profiles (hostel_id);

create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  block text check (char_length(block) <= 40),
  room text check (char_length(room) <= 20),
  phone text check (phone ~ '^[0-9+() -]{7,20}$'),
  departure_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.profile_private (user_id, block, room, departure_at)
select id, block, room, departure_time from public.profiles
on conflict (user_id) do nothing;

-- ── 3. Wallet + sandbox ledger (replaces profiles.wallet_balance) ────────
create table public.wallet_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance_paise bigint not null default 0 check (balance_paise >= 0),
  updated_at timestamptz not null default now()
);

insert into public.wallet_accounts (user_id, balance_paise)
select id, greatest(0, round(coalesce(wallet_balance, 0) * 100))::bigint from public.profiles
on conflict (user_id) do nothing;

alter table public.profiles drop column block, drop column room, drop column campus_id, drop column departure_time, drop column wallet_balance;

-- ── 4. Listings (forward from items) ─────────────────────────────────────
create type public.listing_status as enum
  ('ACTIVE', 'RESERVED', 'RENTED', 'SOLD', 'STAFF_PENDING', 'STAFF_CUSTODY', 'WITHDRAWN', 'DISPUTED');
create type public.item_condition as enum ('like_new', 'good', 'fair', 'worn');

alter table public.items rename to listings;
alter table public.listings rename column departure_time to departure_at;
alter table public.listings rename column image_url to legacy_image_url;

alter table public.listings
  add column category_slug text references public.categories(slug) on update cascade,
  add column condition public.item_condition not null default 'good',
  add column hostel_id uuid references public.hostels(id) on delete set null,
  add column start_price_paise bigint,
  add column floor_price_paise bigint;

update public.listings set
  start_price_paise = round(start_price * 100)::bigint,
  floor_price_paise = round(floor_price * 100)::bigint,
  category_slug = coalesce(
    (select c.slug from public.categories c
      where lower(regexp_replace(c.name, '[^a-zA-Z]', '', 'g')) = lower(regexp_replace(listings.category, '[^a-zA-Z]', '', 'g'))
         or lower(regexp_replace(c.slug, '[^a-zA-Z]', '', 'g')) = lower(regexp_replace(listings.category, '[^a-zA-Z]', '', 'g'))
      limit 1),
    'other');

alter table public.listings
  drop column start_price,
  drop column floor_price,
  drop column category,
  alter column start_price_paise set not null,
  alter column floor_price_paise set not null,
  alter column category_slug set not null,
  alter column created_at set not null,
  alter column updated_at set not null,
  add constraint listings_price_bounds check (start_price_paise between 100 and 10000000),
  add constraint listings_floor_below_start check (floor_price_paise > 0 and floor_price_paise < start_price_paise),
  add constraint listings_title_len check (char_length(title) between 3 and 80) not valid,
  add constraint listings_description_len check (description is null or char_length(description) <= 2000),
  add constraint listings_departure_after_listing check (departure_at is null or departure_at > listed_at) not valid;

alter table public.listings alter column status drop default;
alter table public.listings alter column status type public.listing_status using (
  case status::text
    when 'CLAIMED_ESCROW' then 'RESERVED'
    when 'SETTLED' then 'SOLD'
    when 'STAFF_ROUTED' then 'STAFF_CUSTODY'
    else status::text
  end)::public.listing_status;
alter table public.listings alter column status set default 'ACTIVE';
alter table public.listings alter column owner_id set default auth.uid();
drop type public.item_status;

alter table public.listings add column search tsvector
  generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))) stored;

create index listings_search_idx on public.listings using gin (search);
create index listings_market_idx on public.listings (status, hostel_id, category_slug, listed_at desc);
create index listings_departure_idx on public.listings (status, departure_at) where departure_at is not null;
create index listings_owner_idx on public.listings (owner_id, created_at desc);

create trigger listings_touch before update on public.listings
  for each row execute function private.touch_updated_at();

create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  -- Object path inside the `listing-media` bucket: <owner uid>/<listing id>/<file>
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'),
  alt_text text not null check (char_length(alt_text) between 3 and 200),
  position smallint not null default 0 check (position between 0 and 5),
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);

-- ── 5. Claims (purchase reservations held in sandbox escrow) ─────────────
create type public.claim_state as enum ('PENDING_HANDOVER', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'REFUNDED');

alter table public.claims drop constraint if exists claims_item_id_key;
alter table public.claims rename column item_id to listing_id;
alter table public.claims drop column qr_token_hash, drop column qr_expires_at;
alter table public.claims add column amount_paise bigint;
update public.claims set amount_paise = round(agreed_price * 100)::bigint;
alter table public.claims
  drop column agreed_price,
  alter column amount_paise set not null,
  add constraint claims_amount_positive check (amount_paise > 0),
  add column completed_at timestamptz,
  add column closed_at timestamptz,
  add column updated_at timestamptz not null default now();

alter table public.claims alter column status drop default;
alter table public.claims alter column status type public.claim_state using status::text::public.claim_state;
alter table public.claims alter column status set default 'PENDING_HANDOVER';
drop type public.claim_status;

-- At most one open claim per listing — the race-proof backstop to the row lock in claim_listing().
create unique index claims_one_open_per_listing on public.claims (listing_id)
  where status in ('PENDING_HANDOVER', 'DISPUTED');
create index claims_claimer_idx on public.claims (claimer_id, claimed_at desc);
create index claims_listing_idx on public.claims (listing_id);
create trigger claims_touch before update on public.claims for each row execute function private.touch_updated_at();

-- ── 6. Rentals ───────────────────────────────────────────────────────────
create type public.rental_state as enum ('PENDING_PICKUP', 'ACTIVE', 'RETURNED', 'CANCELLED', 'CONVERTED', 'DISPUTED');

alter table public.rentals rename column item_id to listing_id;
alter table public.rentals rename column start_time to booked_at;
alter table public.rentals rename column end_time to due_at;
alter table public.rentals alter column due_at drop not null;
alter table public.rentals add column rent_paise bigint, add column deposit_paise bigint;
update public.rentals set rent_paise = round(rent_paid * 100)::bigint, deposit_paise = round(deposit * 100)::bigint;
alter table public.rentals
  drop column rent_paid,
  drop column deposit,
  alter column rent_paise set not null,
  alter column deposit_paise set not null,
  add constraint rentals_amounts check (rent_paise > 0 and deposit_paise >= 0),
  add column picked_up_at timestamptz,
  add column returned_at timestamptz,
  add column damage_deduction_paise bigint not null default 0 check (damage_deduction_paise >= 0),
  add column converted_price_paise bigint check (converted_price_paise is null or converted_price_paise > 0),
  add column updated_at timestamptz not null default now();

alter table public.rentals alter column status drop default;
alter table public.rentals alter column status type public.rental_state using (
  case status::text when 'CONVERTED_TO_BUY' then 'CONVERTED' else status::text end)::public.rental_state;
alter table public.rentals alter column status set default 'PENDING_PICKUP';
drop type public.rental_status;

create unique index rentals_one_open_per_listing on public.rentals (listing_id)
  where status in ('PENDING_PICKUP', 'ACTIVE', 'DISPUTED');
create index rentals_renter_idx on public.rentals (renter_id, booked_at desc);
create index rentals_listing_idx on public.rentals (listing_id);
create trigger rentals_touch before update on public.rentals for each row execute function private.touch_updated_at();

-- ── 7. Ledger entries (simulated, sandbox only) ──────────────────────────
create type public.ledger_entry_type as enum (
  'OPENING_CREDIT', 'MIGRATED_BALANCE',
  'CLAIM_HOLD', 'CLAIM_REFUND', 'SALE_PAYOUT',
  'RENT_CHARGE', 'RENT_REFUND', 'RENT_PAYOUT',
  'DEPOSIT_HOLD', 'DEPOSIT_REFUND', 'DAMAGE_PAYOUT',
  'RTO_CHARGE', 'RTO_PAYOUT');

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.ledger_entry_type not null,
  amount_paise bigint not null check (amount_paise <> 0),
  balance_after_paise bigint not null check (balance_after_paise >= 0),
  listing_id uuid references public.listings(id) on delete set null,
  claim_id uuid references public.claims(id) on delete set null,
  rental_id uuid references public.rentals(id) on delete set null,
  dispute_id uuid,
  note text check (char_length(note) <= 300),
  -- Every settlement step has a deterministic key, so it can never be applied twice.
  idempotency_key text not null unique,
  -- Level 1 never moves real money. This column cannot be false.
  is_sandbox boolean not null default true check (is_sandbox),
  created_at timestamptz not null default now()
);
create index ledger_entries_user_idx on public.ledger_entries (user_id, created_at desc);

insert into public.ledger_entries (user_id, type, amount_paise, balance_after_paise, note, idempotency_key)
select user_id, 'MIGRATED_BALANCE', balance_paise, balance_paise,
       'Sandbox balance carried over from the prototype schema', 'migrated:' || user_id
from public.wallet_accounts where balance_paise > 0;

-- The prototype ledger is kept read-only for reference.
alter table public.ledger rename to legacy_ledger;

-- ── 8. Disputes ──────────────────────────────────────────────────────────
create type public.dispute_state as enum ('OPEN', 'RESOLVED_REFUND', 'RESOLVED_RELEASE', 'RESOLVED_DAMAGE');

alter table public.disputes rename column item_id to listing_id;
alter table public.disputes rename column evidence_url to evidence_path;
alter table public.disputes
  add column claim_id uuid references public.claims(id) on delete cascade,
  add column rental_id uuid references public.rentals(id) on delete cascade,
  add column prev_subject_status text,
  add column item_returned boolean not null default false,
  add column decided_by uuid references public.profiles(id) on delete set null,
  add column deduction_paise bigint not null default 0 check (deduction_paise >= 0),
  add column updated_at timestamptz not null default now(),
  add constraint disputes_one_subject check (num_nonnulls(claim_id, rental_id) = 1) not valid,
  add constraint disputes_reason_len check (char_length(reason) between 10 and 1000) not valid;

alter table public.disputes alter column status drop default;
alter table public.disputes alter column status type public.dispute_state using (
  case status::text when 'RESOLVED' then 'RESOLVED_RELEASE' else status::text end)::public.dispute_state;
alter table public.disputes alter column status set default 'OPEN';
drop type public.dispute_status;
alter table public.disputes alter column created_at set default now();

create unique index disputes_one_open_per_claim on public.disputes (claim_id) where status = 'OPEN' and claim_id is not null;
create unique index disputes_one_open_per_rental on public.disputes (rental_id) where status = 'OPEN' and rental_id is not null;
create index disputes_listing_idx on public.disputes (listing_id);
create index disputes_open_idx on public.disputes (status, created_at desc);
create trigger disputes_touch before update on public.disputes for each row execute function private.touch_updated_at();

alter table public.ledger_entries add constraint ledger_entries_dispute_fk
  foreign key (dispute_id) references public.disputes(id) on delete set null;

-- ── 9. Staff transfers ───────────────────────────────────────────────────
create type public.staff_transfer_state as enum ('PENDING', 'ACCEPTED');

create table public.staff_transfers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  status public.staff_transfer_state not null default 'PENDING',
  routed_by uuid not null references public.profiles(id),
  routed_at timestamptz not null default now(),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  constraint staff_transfers_acceptance check ((status = 'ACCEPTED') = (accepted_at is not null and accepted_by is not null))
);
create index staff_transfers_hostel_idx on public.staff_transfers (hostel_id, status);

-- ── 10. Handover tokens ──────────────────────────────────────────────────
create type public.handover_purpose as enum ('CLAIM', 'RENTAL_PICKUP', 'RENTAL_RETURN', 'STAFF_CUSTODY');

create table public.handover_tokens (
  id uuid primary key default gen_random_uuid(),
  purpose public.handover_purpose not null,
  listing_id uuid not null references public.listings(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete cascade,
  rental_id uuid references public.rentals(id) on delete cascade,
  staff_transfer_id uuid references public.staff_transfers(id) on delete cascade,
  giver_id uuid not null references public.profiles(id) on delete cascade,
  -- NULL only for STAFF_CUSTODY: any staff/warden scoped to the listing's hostel may receive.
  receiver_id uuid references public.profiles(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint handover_tokens_subject check (num_nonnulls(claim_id, rental_id, staff_transfer_id) = 1),
  constraint handover_tokens_receiver check (receiver_id is not null or purpose = 'STAFF_CUSTODY')
);
create index handover_tokens_giver_idx on public.handover_tokens (giver_id, created_at desc);
create index handover_tokens_receiver_idx on public.handover_tokens (receiver_id, created_at desc);

-- ── 11. Role scopes and audit ────────────────────────────────────────────
create table public.hostel_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, hostel_id)
);
create index hostel_assignments_hostel_idx on public.hostel_assignments (hostel_id);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  hostel_id uuid references public.hostels(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events (entity, entity_id);
create index audit_events_hostel_idx on public.audit_events (hostel_id, created_at desc);

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger profile_private_touch before update on public.profile_private for each row execute function private.touch_updated_at();
