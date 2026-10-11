-- RIO Level 1 · 4/5 — privileges and Row Level Security.
--
-- Supabase grants ALL on public tables and EXECUTE on public functions to
-- `anon` and `authenticated` by default. We revoke everything and grant back
-- only what each role needs — down to individual columns — so that, e.g., a
-- student can never UPDATE profiles.role or a listing's status, and nobody can
-- INSERT into the ledger except through the audited functions in 3/5.

-- ── 1. Start from zero ───────────────────────────────────────────────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ── 2. Function access ───────────────────────────────────────────────────
-- Used inside RLS policies / views, so the invoking roles need EXECUTE.
grant execute on function public.my_role(), public.is_admin(),
  public.has_hostel_scope(uuid, public.user_role[]),
  public.rio_current_price(bigint, bigint, timestamptz, timestamptz, timestamptz)
  to anon, authenticated;

-- Business RPCs: signed-in users only (each re-checks authorization itself).
grant execute on function
  public.claim_listing(uuid),
  public.cancel_claim(uuid),
  public.start_rental(uuid, public.rental_period),
  public.cancel_rental(uuid),
  public.convert_rental_to_purchase(uuid),
  public.issue_handover_token(public.handover_purpose, uuid),
  public.consume_handover_token(text, boolean, text),
  public.open_dispute(uuid, uuid, text, text),
  public.resolve_dispute(uuid, public.dispute_state, text),
  public.route_to_staff(uuid),
  public.set_listing_availability(uuid, boolean),
  public.admin_set_role(uuid, public.user_role, uuid[]),
  public.impact_summary(uuid),
  public.no_dues_report(uuid)
  to authenticated;

-- ── 2b. Policy predicates ────────────────────────────────────────────────
-- listings ↔ claims/rentals reference each other; evaluating one table's
-- policy through the other's would recurse. These SECURITY DEFINER predicates
-- answer the narrow question without re-entering RLS.
create or replace function public.is_listing_counterparty(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.claims c where c.listing_id = p_listing and c.claimer_id = auth.uid())
      or exists (select 1 from public.rentals r where r.listing_id = p_listing and r.renter_id = auth.uid())
$$;

create or replace function public.is_listing_owner_or_scoped(
  p_listing uuid, p_roles public.user_role[] default array['warden']::public.user_role[]
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing and (l.owner_id = auth.uid() or public.has_hostel_scope(l.hostel_id, p_roles))
  )
$$;

revoke all on function public.is_listing_counterparty(uuid), public.is_listing_owner_or_scoped(uuid, public.user_role[]) from public;
grant execute on function public.is_listing_counterparty(uuid), public.is_listing_owner_or_scoped(uuid, public.user_role[])
  to anon, authenticated;

-- ── 3. Reference data (public read) ──────────────────────────────────────
alter table public.campuses enable row level security;
alter table public.hostels enable row level security;
alter table public.categories enable row level security;
grant select on public.campuses, public.hostels, public.categories to anon, authenticated;
create policy "Reference data is readable" on public.campuses for select to anon, authenticated using (true);
create policy "Reference data is readable" on public.hostels for select to anon, authenticated using (true);
create policy "Reference data is readable" on public.categories for select to anon, authenticated using (true);

-- ── 4. Profiles (non-sensitive) ──────────────────────────────────────────
-- Holds only id, name, avatar, role and hostel. Room/phone/departure live in
-- profile_private. Signed-in users may see names (needed for handovers);
-- anonymous visitors see none.
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, hostel_id) on public.profiles to authenticated;
create policy "Members can read profiles" on public.profiles for select to authenticated using (true);
create policy "Users update their own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── 5. Private profile data ──────────────────────────────────────────────
alter table public.profile_private enable row level security;
grant select on public.profile_private to authenticated;
grant update (block, room, phone, departure_at) on public.profile_private to authenticated;
create policy "Owner reads own private profile" on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Scoped wardens read residents' private profile" on public.profile_private for select to authenticated
  using (public.has_hostel_scope((select p.hostel_id from public.profiles p where p.id = user_id)));
create policy "Owner updates own private profile" on public.profile_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── 6. Listings ──────────────────────────────────────────────────────────
grant select on public.listings to anon, authenticated;
grant insert (title, description, category_slug, condition, start_price_paise, floor_price_paise, departure_at, is_rentable)
  on public.listings to authenticated;
grant update (title, description, category_slug, condition, start_price_paise, floor_price_paise, departure_at, is_rentable)
  on public.listings to authenticated;
grant select on public.listing_cards to anon, authenticated;

create policy "Active listings are public" on public.listings for select to anon, authenticated
  using (status = 'ACTIVE');
create policy "Owners see their listings" on public.listings for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Counterparties see listings they transact on" on public.listings for select to authenticated
  using (public.is_listing_counterparty(id));
create policy "Scoped wardens and staff see hostel listings" on public.listings for select to authenticated
  using (public.has_hostel_scope(hostel_id, array['warden', 'staff']::public.user_role[]));
create policy "Students create their own listings" on public.listings for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'ACTIVE');
create policy "Owners edit listings that are not in a transaction" on public.listings for update to authenticated
  using (owner_id = (select auth.uid()) and status in ('ACTIVE', 'WITHDRAWN'))
  with check (owner_id = (select auth.uid()) and status in ('ACTIVE', 'WITHDRAWN'));

alter table public.listing_media enable row level security;
grant select on public.listing_media to anon, authenticated;
grant insert (listing_id, storage_path, alt_text, position) on public.listing_media to authenticated;
grant update (alt_text, position) on public.listing_media to authenticated;
grant delete on public.listing_media to authenticated;
create policy "Media follows listing visibility" on public.listing_media for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "Owners add media in their own folder" on public.listing_media for insert to authenticated
  with check (
    storage_path like (select auth.uid())::text || '/' || listing_id::text || '/%'
    and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())
                and l.status in ('ACTIVE', 'WITHDRAWN'))
  );
create policy "Owners update their media" on public.listing_media for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())));
create policy "Owners delete their media" on public.listing_media for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())
                 and l.status in ('ACTIVE', 'WITHDRAWN')));

-- ── 7. Transactions: read-only to parties; writes only via functions ─────
grant select on public.claims, public.rentals, public.disputes, public.staff_transfers to authenticated;

create policy "Parties and scoped wardens read claims" on public.claims for select to authenticated
  using (
    claimer_id = (select auth.uid()) or public.is_listing_owner_or_scoped(listing_id)
  );

create policy "Parties and scoped wardens read rentals" on public.rentals for select to authenticated
  using (
    renter_id = (select auth.uid()) or public.is_listing_owner_or_scoped(listing_id)
  );

create policy "Parties and scoped wardens read disputes" on public.disputes for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or exists (select 1 from public.claims c where c.id = claim_id and c.claimer_id = (select auth.uid()))
    or exists (select 1 from public.rentals r where r.id = rental_id and r.renter_id = (select auth.uid()))
    or public.is_listing_owner_or_scoped(listing_id)
  );

alter table public.staff_transfers enable row level security;
create policy "Owner and scoped staff read transfers" on public.staff_transfers for select to authenticated
  using (owner_id = (select auth.uid()) or public.has_hostel_scope(hostel_id, array['warden', 'staff']::public.user_role[]));

-- Token hashes are never readable by clients (column-level grant excludes token_hash).
alter table public.handover_tokens enable row level security;
grant select (id, purpose, listing_id, claim_id, rental_id, staff_transfer_id, giver_id, receiver_id,
              expires_at, consumed_at, revoked_at, created_at)
  on public.handover_tokens to authenticated;
create policy "Giver and receiver read their tokens" on public.handover_tokens for select to authenticated
  using (giver_id = (select auth.uid()) or receiver_id = (select auth.uid()));

-- ── 8. Wallet and ledger: owner read-only ────────────────────────────────
alter table public.wallet_accounts enable row level security;
alter table public.ledger_entries enable row level security;
grant select on public.wallet_accounts, public.ledger_entries to authenticated;
create policy "Owner reads own wallet" on public.wallet_accounts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Owner reads own ledger" on public.ledger_entries for select to authenticated
  using (user_id = (select auth.uid()));

-- ── 9. Scopes and audit ──────────────────────────────────────────────────
alter table public.hostel_assignments enable row level security;
alter table public.audit_events enable row level security;
grant select on public.hostel_assignments, public.audit_events to authenticated;
create policy "Users read own assignments; admins read all" on public.hostel_assignments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "Admins and scoped wardens read audit events" on public.audit_events for select to authenticated
  using (public.is_admin() or (hostel_id is not null and public.has_hostel_scope(hostel_id)));

-- ── 10. Legacy prototype ledger: no client access ────────────────────────
alter table public.legacy_ledger enable row level security;
