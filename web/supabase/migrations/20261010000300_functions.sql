-- RIO Level 1 · 3/5 — business functions.
--
-- Every state-changing operation is a SECURITY DEFINER function with an empty
-- search_path that (1) authenticates via auth.uid(), (2) locks the rows it
-- reads with FOR UPDATE, (3) checks the current state and the caller's right
-- to act, and (4) writes the state change, the sandbox ledger entries and an
-- audit event in one transaction. Clients get no direct write access to
-- financial tables (see 4/5), so these functions are the only way in.
--
-- Errors are raised as `RIO_<CODE>` (SQLSTATE P0001); the app maps the codes
-- to messages in src/lib/rpc-errors.ts.
--
-- Money: integer paise. Rounding: half-up integer division
-- floor((2n + d) / (2d)) — identical to src/domain/money.ts.

-- ── Helpers: roles and scope ─────────────────────────────────────────────
create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- True when the caller is an admin, or holds one of p_roles AND is assigned to p_hostel.
create or replace function public.has_hostel_scope(
  p_hostel uuid,
  p_roles public.user_role[] default array['warden']::public.user_role[]
) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (
    p_hostel is not null and exists (
      select 1
      from public.hostel_assignments ha
      join public.profiles p on p.id = ha.user_id
      where ha.user_id = auth.uid() and ha.hostel_id = p_hostel and p.role = any (p_roles)
    )
  )
$$;

create or replace function private.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'RIO_NOT_AUTHENTICATED' using errcode = 'P0001'; end if;
  return v;
end $$;

create or replace function private.fail(p_code text, p_detail text default null) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception '%', 'RIO_' || p_code using errcode = 'P0001', detail = coalesce(p_detail, '');
end $$;

create or replace function private.audit(
  p_action text, p_entity text, p_entity_id uuid, p_hostel uuid, p_details jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_events (actor_id, action, entity, entity_id, hostel_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_hostel, coalesce(p_details, '{}'::jsonb))
$$;

-- ── Money ────────────────────────────────────────────────────────────────
create or replace function private.round_half_up_div(p_n bigint, p_d bigint) returns bigint
language sql immutable set search_path = '' as $$
  select (2 * p_n + p_d) / (2 * p_d)
$$;

-- amount × bps / 10000, rounded half-up to the nearest whole rupee (100 paise).
create or replace function private.bps_to_rupee(p_amount bigint, p_bps integer) returns bigint
language sql immutable set search_path = '' as $$
  select private.round_half_up_div(p_amount * p_bps, 1000000) * 100
$$;

-- Dutch-auction price — integer mirror of currentPricePaise() in src/domain/pricing.ts.
create or replace function public.rio_current_price(
  p_start bigint, p_floor bigint, p_listed timestamptz, p_departure timestamptz, p_at timestamptz default now()
) returns bigint
language plpgsql stable set search_path = '' as $$
declare
  l bigint; d bigint; t bigint; span bigint; elapsed bigint; rounded bigint;
begin
  if p_departure is null then return p_start; end if;
  l := floor(extract(epoch from p_listed))::bigint;
  d := floor(extract(epoch from p_departure))::bigint - 7200; -- decay ends 2h before departure
  t := floor(extract(epoch from p_at))::bigint;
  span := d - l;
  if span <= 0 then return p_floor; end if;
  elapsed := least(span, greatest(0, t - l));
  rounded := private.round_half_up_div(p_start * span - (p_start - p_floor) * elapsed, span * 500) * 500;
  return least(p_start, greatest(p_floor, rounded));
end $$;

-- Posts one sandbox ledger entry and moves the cached wallet balance with it.
create or replace function private.post_ledger(
  p_user uuid, p_type public.ledger_entry_type, p_amount bigint, p_key text,
  p_listing uuid default null, p_claim uuid default null, p_rental uuid default null,
  p_dispute uuid default null, p_note text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_balance bigint;
begin
  if p_amount = 0 then return null; end if;
  select balance_paise into v_balance from public.wallet_accounts where user_id = p_user for update;
  if not found then perform private.fail('WALLET_MISSING'); end if;
  if v_balance + p_amount < 0 then
    perform private.fail('INSUFFICIENT_FUNDS', format('needed %s paise, available %s', -p_amount, v_balance));
  end if;
  v_balance := v_balance + p_amount;
  update public.wallet_accounts set balance_paise = v_balance, updated_at = now() where user_id = p_user;
  begin
    insert into public.ledger_entries
      (user_id, type, amount_paise, balance_after_paise, listing_id, claim_id, rental_id, dispute_id, note, idempotency_key)
    values (p_user, p_type, p_amount, v_balance, p_listing, p_claim, p_rental, p_dispute, p_note, p_key);
  exception when unique_violation then
    perform private.fail('DUPLICATE_SETTLEMENT', p_key);
  end;
  return v_balance;
end $$;

-- ── Handover code generation ─────────────────────────────────────────────
create or replace function private.crockford(p_bytes bytea) returns text
language plpgsql immutable set search_path = '' as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bits bigint := 0; nbits integer := 0; result text := '';
begin
  for i in 0 .. length(p_bytes) - 1 loop
    bits := (bits << 8) | get_byte(p_bytes, i);
    nbits := nbits + 8;
    while nbits >= 5 loop
      result := result || substr(alphabet, ((bits >> (nbits - 5)) & 31)::integer + 1, 1);
      nbits := nbits - 5;
    end loop;
    bits := bits & ((1::bigint << nbits) - 1);
  end loop;
  return result;
end $$;

-- Same normalisation as normalizeHandoverCode() in src/domain/handoverCode.ts.
create or replace function private.normalize_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select case when s ~ '^[0-9A-HJKMNP-TV-Z]{16}$' then s end
  from (select translate(regexp_replace(regexp_replace(upper(trim(coalesce(p_code, ''))), '^RIO:', ''), '[[:space:]-]', '', 'g'), 'OIL', '011') as s) x
$$;

create or replace function private.hash_code(p_code text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(p_code, 'sha256')
$$;

create or replace function private.revoke_tokens(p_claim uuid, p_rental uuid, p_transfer uuid) returns void
language sql security definer set search_path = '' as $$
  update public.handover_tokens set revoked_at = now()
  where consumed_at is null and revoked_at is null
    and ((p_claim is not null and claim_id = p_claim)
      or (p_rental is not null and rental_id = p_rental)
      or (p_transfer is not null and staff_transfer_id = p_transfer))
$$;

-- ── Listing guards ───────────────────────────────────────────────────────
create or replace function private.validate_listing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Only end-user (Data API) writes are constrained. Trusted server-side
  -- seeding uses the service_role JWT; migrations/SQL editor have no JWT.
  if coalesce(auth.jwt() ->> 'role', '') not in ('authenticated', 'anon') then return new; end if;

  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.status := 'ACTIVE';
    new.listed_at := now();
    new.hostel_id := (select hostel_id from public.profiles where id = auth.uid());
  end if;

  if tg_op = 'INSERT' or new.departure_at is distinct from old.departure_at then
    if new.departure_at is not null and new.departure_at < now() + interval '3 hours' then
      perform private.fail('DEPARTURE_TOO_SOON');
    end if;
    if new.departure_at is not null and new.departure_at > now() + interval '366 days' then
      perform private.fail('DEPARTURE_TOO_FAR');
    end if;
  end if;

  -- Re-pricing restarts the auction so a seller cannot jump the decay curve.
  if tg_op = 'UPDATE' and (new.start_price_paise, new.floor_price_paise, new.departure_at)
       is distinct from (old.start_price_paise, old.floor_price_paise, old.departure_at) then
    new.listed_at := now();
  end if;
  return new;
end $$;

create trigger listings_validate before insert or update on public.listings
  for each row execute function private.validate_listing();

create or replace function private.lock_listing(p_listing uuid) returns public.listings
language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found then perform private.fail('NOT_FOUND', 'listing'); end if;
  return l;
end $$;

create or replace function private.in_trading_window(p_departure timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select p_departure is null or now() < p_departure - interval '1 hour'
$$;

-- ── Profiles: provisioning ───────────────────────────────────────────────
-- Every signup (email or OAuth) becomes a STUDENT. Metadata is used only for
-- the display name; any `role` in user metadata is ignored.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  v_name := left(nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1))), ''), 80);

  insert into public.profiles (id, full_name, role) values (new.id, coalesce(v_name, 'RIO member'), 'student')
  on conflict (id) do nothing;
  insert into public.profile_private (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.wallet_accounts (user_id) values (new.id) on conflict (user_id) do nothing;

  if not exists (select 1 from public.ledger_entries where idempotency_key = 'opening:' || new.id) then
    perform private.post_ledger(new.id, 'OPENING_CREDIT', 300000, 'opening:' || new.id,
      p_note => 'Sandbox opening credit (simulated, not real money)');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: accounts created before this trigger existed (or while it failed)
-- get the same student profile, private row, wallet and opening credit. Idempotent.
do $$
declare u record;
begin
  for u in
    select au.* from auth.users au
    where not exists (select 1 from public.profiles p where p.id = au.id)
       or not exists (select 1 from public.wallet_accounts w where w.user_id = au.id)
  loop
    insert into public.profiles (id, full_name, role)
    values (u.id, coalesce(left(nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name',
                                                      split_part(coalesce(u.email, ''), '@', 1))), ''), 80), 'RIO member'), 'student')
    on conflict (id) do nothing;
    insert into public.profile_private (user_id) values (u.id) on conflict (user_id) do nothing;
    insert into public.wallet_accounts (user_id) values (u.id) on conflict (user_id) do nothing;
    if not exists (select 1 from public.ledger_entries where idempotency_key = 'opening:' || u.id)
       and (select balance_paise from public.wallet_accounts where user_id = u.id) = 0 then
      perform private.post_ledger(u.id, 'OPENING_CREDIT', 300000, 'opening:' || u.id,
        p_note => 'Sandbox opening credit (simulated, not real money)');
    end if;
  end loop;
end $$;

-- ── Admin: roles and scope ───────────────────────────────────────────────
create or replace function public.admin_set_role(
  p_user uuid, p_role public.user_role, p_hostels uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.require_user(); v_old public.user_role;
begin
  if not public.is_admin() then perform private.fail('NOT_AUTHORIZED'); end if;
  if p_user = v_actor then perform private.fail('SELF_ROLE_CHANGE'); end if;
  select role into v_old from public.profiles where id = p_user for update;
  if not found then perform private.fail('NOT_FOUND', 'profile'); end if;

  update public.profiles set role = p_role where id = p_user;
  delete from public.hostel_assignments where user_id = p_user;
  if p_role in ('warden', 'staff') then
    insert into public.hostel_assignments (user_id, hostel_id, granted_by)
    select p_user, h, v_actor from unnest(coalesce(p_hostels, '{}')) as h
    on conflict do nothing;
  end if;
  perform private.audit('role.set', 'profile', p_user, null,
    jsonb_build_object('from', v_old, 'to', p_role, 'hostels', coalesce(p_hostels, '{}')));
end $$;

-- ── Listing availability ─────────────────────────────────────────────────
create or replace function public.set_listing_availability(p_listing uuid, p_available boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); l public.listings;
begin
  l := private.lock_listing(p_listing);
  if l.owner_id <> v_uid then perform private.fail('NOT_PARTY'); end if;
  if p_available then
    if l.status <> 'WITHDRAWN' then perform private.fail('ILLEGAL_STATE', l.status::text); end if;
    if not private.in_trading_window(l.departure_at) then perform private.fail('TRADING_CLOSED'); end if;
    update public.listings set status = 'ACTIVE' where id = l.id;
  else
    if l.status <> 'ACTIVE' then perform private.fail('ILLEGAL_STATE', l.status::text); end if;
    update public.listings set status = 'WITHDRAWN' where id = l.id;
  end if;
  perform private.audit(case when p_available then 'listing.relist' else 'listing.withdraw' end, 'listing', l.id, l.hostel_id);
end $$;

-- ── Claims ───────────────────────────────────────────────────────────────
create or replace function public.claim_listing(p_listing uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  l public.listings;
  v_price bigint;
  v_claim uuid;
begin
  if public.my_role() is distinct from 'student' then perform private.fail('STUDENTS_ONLY'); end if;
  l := private.lock_listing(p_listing); -- serialises competing claims on the same listing
  if l.owner_id = v_uid then perform private.fail('OWN_LISTING'); end if;
  if l.status <> 'ACTIVE' then perform private.fail('UNAVAILABLE', l.status::text); end if;
  if not private.in_trading_window(l.departure_at) then perform private.fail('TRADING_CLOSED'); end if;

  -- Anti-hoarding: one open or completed purchase per category per student.
  if exists (
    select 1 from public.claims c join public.listings x on x.id = c.listing_id
    where c.claimer_id = v_uid and x.category_slug = l.category_slug and x.category_slug <> 'other'
      and c.status in ('PENDING_HANDOVER', 'DISPUTED', 'COMPLETED')
  ) then
    perform private.fail('CATEGORY_LIMIT');
  end if;

  v_price := public.rio_current_price(l.start_price_paise, l.floor_price_paise, l.listed_at, l.departure_at, now());

  insert into public.claims (listing_id, claimer_id, amount_paise, status)
  values (l.id, v_uid, v_price, 'PENDING_HANDOVER') returning id into v_claim;
  update public.listings set status = 'RESERVED' where id = l.id;
  perform private.post_ledger(v_uid, 'CLAIM_HOLD', -v_price, 'claim:' || v_claim || ':hold',
    l.id, v_claim, p_note => 'Held in sandbox escrow until QR handover');
  perform private.audit('claim.create', 'claim', v_claim, l.hostel_id, jsonb_build_object('listing', l.id, 'amount_paise', v_price));
  return v_claim;
end $$;

create or replace function public.cancel_claim(p_claim uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); c public.claims; l public.listings;
begin
  select * into c from public.claims where id = p_claim for update;
  if not found then perform private.fail('NOT_FOUND', 'claim'); end if;
  l := private.lock_listing(c.listing_id);
  if v_uid not in (c.claimer_id, l.owner_id) then perform private.fail('NOT_PARTY'); end if;
  if c.status <> 'PENDING_HANDOVER' then perform private.fail('ILLEGAL_STATE', c.status::text); end if;

  update public.claims set status = 'CANCELLED', closed_at = now() where id = c.id;
  update public.listings set status = 'ACTIVE' where id = l.id;
  perform private.revoke_tokens(c.id, null, null);
  perform private.post_ledger(c.claimer_id, 'CLAIM_REFUND', c.amount_paise, 'claim:' || c.id || ':refund',
    l.id, c.id, p_note => 'Claim cancelled — sandbox escrow returned');
  perform private.audit('claim.cancel', 'claim', c.id, l.hostel_id);
end $$;

-- ── Rentals ──────────────────────────────────────────────────────────────
create or replace function public.start_rental(p_listing uuid, p_period public.rental_period) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  l public.listings;
  v_hours integer; v_bps integer; v_rent bigint; v_deposit bigint; v_rental uuid;
begin
  if public.my_role() is distinct from 'student' then perform private.fail('STUDENTS_ONLY'); end if;
  l := private.lock_listing(p_listing);
  if l.owner_id = v_uid then perform private.fail('OWN_LISTING'); end if;
  if l.status <> 'ACTIVE' then perform private.fail('UNAVAILABLE', l.status::text); end if;
  if not l.is_rentable then perform private.fail('NOT_RENTABLE'); end if;
  if not private.in_trading_window(l.departure_at) then perform private.fail('TRADING_CLOSED'); end if;

  v_hours := case p_period when 'DAY' then 24 when 'WEEK' then 168 when 'MONTH' then 720 end;
  v_bps := case p_period when 'DAY' then 200 when 'WEEK' then 1000 when 'MONTH' then 2500 end;
  -- The item must be back at least 24h before the owner departs.
  if l.departure_at is not null and l.departure_at - now() < make_interval(hours => v_hours + 24) then
    perform private.fail('RENTAL_TOO_LONG');
  end if;

  v_rent := private.bps_to_rupee(l.start_price_paise, v_bps);
  v_deposit := private.bps_to_rupee(l.start_price_paise, 2000);

  insert into public.rentals (listing_id, renter_id, period, rent_paise, deposit_paise, status)
  values (l.id, v_uid, p_period, v_rent, v_deposit, 'PENDING_PICKUP') returning id into v_rental;
  update public.listings set status = 'RENTED' where id = l.id;
  perform private.post_ledger(v_uid, 'RENT_CHARGE', -v_rent, 'rental:' || v_rental || ':rent', l.id, null, v_rental,
    p_note => 'Rent held until pickup (sandbox)');
  if v_deposit > 0 then
    perform private.post_ledger(v_uid, 'DEPOSIT_HOLD', -v_deposit, 'rental:' || v_rental || ':deposit', l.id, null, v_rental,
      p_note => 'Refundable deposit held (sandbox)');
  end if;
  perform private.audit('rental.create', 'rental', v_rental, l.hostel_id,
    jsonb_build_object('listing', l.id, 'period', p_period, 'rent_paise', v_rent, 'deposit_paise', v_deposit));
  return v_rental;
end $$;

create or replace function public.cancel_rental(p_rental uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); r public.rentals; l public.listings;
begin
  select * into r from public.rentals where id = p_rental for update;
  if not found then perform private.fail('NOT_FOUND', 'rental'); end if;
  l := private.lock_listing(r.listing_id);
  if v_uid not in (r.renter_id, l.owner_id) then perform private.fail('NOT_PARTY'); end if;
  if r.status <> 'PENDING_PICKUP' then perform private.fail('ILLEGAL_STATE', r.status::text); end if;

  update public.rentals set status = 'CANCELLED' where id = r.id;
  update public.listings set status = 'ACTIVE' where id = l.id;
  perform private.revoke_tokens(null, r.id, null);
  perform private.post_ledger(r.renter_id, 'RENT_REFUND', r.rent_paise, 'rental:' || r.id || ':rent_refund', l.id, null, r.id,
    p_note => 'Rental cancelled before pickup');
  perform private.post_ledger(r.renter_id, 'DEPOSIT_REFUND', r.deposit_paise, 'rental:' || r.id || ':deposit_refund', l.id, null, r.id,
    p_note => 'Deposit returned');
  perform private.audit('rental.cancel', 'rental', r.id, l.hostel_id);
end $$;

-- Rent-to-own: buy = max(floor, current price − 50% of rent paid); deposit refunded.
create or replace function public.convert_rental_to_purchase(p_rental uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user(); r public.rentals; l public.listings;
  v_current bigint; v_credit bigint; v_buy bigint;
begin
  select * into r from public.rentals where id = p_rental for update;
  if not found then perform private.fail('NOT_FOUND', 'rental'); end if;
  l := private.lock_listing(r.listing_id);
  if r.renter_id <> v_uid then perform private.fail('NOT_PARTY'); end if;
  if r.status <> 'ACTIVE' or l.status <> 'RENTED' then perform private.fail('ILLEGAL_STATE', r.status::text); end if;

  v_current := public.rio_current_price(l.start_price_paise, l.floor_price_paise, l.listed_at, l.departure_at, now());
  v_credit := private.round_half_up_div(r.rent_paise * 5000, 10000);
  v_buy := greatest(l.floor_price_paise, v_current - v_credit);

  -- Refund the deposit first so it can fund the purchase.
  perform private.post_ledger(r.renter_id, 'DEPOSIT_REFUND', r.deposit_paise, 'rental:' || r.id || ':deposit_refund', l.id, null, r.id,
    p_note => 'Deposit returned on rent-to-own');
  perform private.post_ledger(r.renter_id, 'RTO_CHARGE', -v_buy, 'rental:' || r.id || ':rto_charge', l.id, null, r.id,
    p_note => format('Rent-to-own: price %s − credit %s (floor %s), paise', v_current, v_credit, l.floor_price_paise));
  perform private.post_ledger(l.owner_id, 'RTO_PAYOUT', v_buy, 'rental:' || r.id || ':rto_payout', l.id, null, r.id,
    p_note => 'Rent-to-own sale (sandbox payout)');

  update public.rentals set status = 'CONVERTED', converted_price_paise = v_buy where id = r.id;
  update public.listings set status = 'SOLD' where id = l.id;
  perform private.revoke_tokens(null, r.id, null);
  perform private.audit('rental.convert', 'rental', r.id, l.hostel_id,
    jsonb_build_object('current_paise', v_current, 'credit_paise', v_credit, 'buy_paise', v_buy));
  return v_buy;
end $$;

-- ── Handover tokens ──────────────────────────────────────────────────────
-- Giver displays the code; receiver scans it. Returns the plaintext code once.
create or replace function public.issue_handover_token(p_purpose public.handover_purpose, p_subject uuid)
returns table (token_id uuid, code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_listing uuid; v_receiver uuid; v_giver uuid;
  v_claim uuid; v_rental uuid; v_transfer uuid;
  v_code text; v_id uuid; v_exp timestamptz := now() + interval '10 minutes';
  c public.claims; r public.rentals; s public.staff_transfers; l public.listings;
begin
  if p_purpose = 'CLAIM' then
    select * into c from public.claims where id = p_subject for update;
    if not found then perform private.fail('NOT_FOUND', 'claim'); end if;
    if c.status <> 'PENDING_HANDOVER' then perform private.fail('ILLEGAL_STATE', c.status::text); end if;
    select * into l from public.listings where id = c.listing_id;
    v_giver := l.owner_id; v_receiver := c.claimer_id; v_claim := c.id;
  elsif p_purpose in ('RENTAL_PICKUP', 'RENTAL_RETURN') then
    select * into r from public.rentals where id = p_subject for update;
    if not found then perform private.fail('NOT_FOUND', 'rental'); end if;
    select * into l from public.listings where id = r.listing_id;
    if p_purpose = 'RENTAL_PICKUP' then
      if r.status <> 'PENDING_PICKUP' then perform private.fail('ILLEGAL_STATE', r.status::text); end if;
      v_giver := l.owner_id; v_receiver := r.renter_id;
    else
      if r.status <> 'ACTIVE' then perform private.fail('ILLEGAL_STATE', r.status::text); end if;
      v_giver := r.renter_id; v_receiver := l.owner_id;
    end if;
    v_rental := r.id;
  else
    select * into s from public.staff_transfers where id = p_subject for update;
    if not found then perform private.fail('NOT_FOUND', 'staff transfer'); end if;
    if s.status <> 'PENDING' then perform private.fail('ILLEGAL_STATE', s.status::text); end if;
    select * into l from public.listings where id = s.listing_id;
    v_giver := s.owner_id; v_receiver := null; v_transfer := s.id;
  end if;

  if v_giver <> v_uid then perform private.fail('NOT_PARTY'); end if;
  v_listing := l.id;

  -- Only the newest code for a handover is valid.
  perform private.revoke_tokens(v_claim, v_rental, v_transfer);
  v_code := private.crockford(extensions.gen_random_bytes(10));
  insert into public.handover_tokens
    (purpose, listing_id, claim_id, rental_id, staff_transfer_id, giver_id, receiver_id, token_hash, expires_at)
  values (p_purpose, v_listing, v_claim, v_rental, v_transfer, v_giver, v_receiver, private.hash_code(v_code), v_exp)
  returning id into v_id;
  perform private.audit('handover.issue', 'handover_token', v_id, l.hostel_id, jsonb_build_object('purpose', p_purpose));
  return query select v_id, v_code, v_exp;
end $$;

-- Receiver consumes a code. Atomic and single-use: the UPDATE … WHERE
-- consumed_at IS NULL guarantees at most one successful consumer.
create or replace function public.consume_handover_token(
  p_code text, p_report_damage boolean default false, p_damage_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_code text := private.normalize_code(p_code);
  v_hash bytea;
  t public.handover_tokens; c public.claims; r public.rentals; l public.listings; s public.staff_transfers;
  v_dispute uuid;
begin
  if v_code is null then perform private.fail('INVALID_CODE'); end if;
  v_hash := private.hash_code(v_code);

  update public.handover_tokens ht
     set consumed_at = now(), consumed_by = v_uid
   where ht.token_hash = v_hash
     and ht.consumed_at is null and ht.revoked_at is null and ht.expires_at > now()
     and (ht.receiver_id = v_uid
          or (ht.receiver_id is null and ht.purpose = 'STAFF_CUSTODY'
              and ht.giver_id <> v_uid
              and public.has_hostel_scope((select x.hostel_id from public.listings x where x.id = ht.listing_id),
                                          array['warden', 'staff']::public.user_role[])))
  returning * into t;

  if not found then
    select * into t from public.handover_tokens where token_hash = v_hash;
    if not found then perform private.fail('INVALID_CODE');
    elsif t.consumed_at is not null then perform private.fail('CODE_USED');
    elsif t.revoked_at is not null then perform private.fail('CODE_REPLACED');
    elsif t.expires_at <= now() then perform private.fail('CODE_EXPIRED');
    else perform private.fail('NOT_RECEIVER');
    end if;
  end if;

  l := private.lock_listing(t.listing_id);

  if t.purpose = 'CLAIM' then
    select * into c from public.claims where id = t.claim_id for update;
    if c.status <> 'PENDING_HANDOVER' then perform private.fail('ILLEGAL_STATE', c.status::text); end if;
    update public.claims set status = 'COMPLETED', completed_at = now(), closed_at = now() where id = c.id;
    update public.listings set status = 'SOLD' where id = l.id;
    perform private.post_ledger(l.owner_id, 'SALE_PAYOUT', c.amount_paise, 'claim:' || c.id || ':payout', l.id, c.id,
      p_note => 'Sale settled on QR handover (sandbox payout)');

  elsif t.purpose = 'RENTAL_PICKUP' then
    select * into r from public.rentals where id = t.rental_id for update;
    if r.status <> 'PENDING_PICKUP' then perform private.fail('ILLEGAL_STATE', r.status::text); end if;
    update public.rentals set status = 'ACTIVE', picked_up_at = now(),
      due_at = now() + case r.period when 'DAY' then interval '24 hours' when 'WEEK' then interval '168 hours' else interval '720 hours' end
    where id = r.id;
    perform private.post_ledger(l.owner_id, 'RENT_PAYOUT', r.rent_paise, 'rental:' || r.id || ':rent_payout', l.id, null, r.id,
      p_note => 'Rent released on pickup (sandbox payout)');

  elsif t.purpose = 'RENTAL_RETURN' then
    select * into r from public.rentals where id = t.rental_id for update;
    if r.status <> 'ACTIVE' then perform private.fail('ILLEGAL_STATE', r.status::text); end if;
    if p_report_damage then
      if char_length(coalesce(trim(p_damage_note), '')) < 10 then perform private.fail('REASON_REQUIRED'); end if;
      update public.rentals set status = 'DISPUTED', returned_at = now() where id = r.id;
      update public.listings set status = 'DISPUTED' where id = l.id;
      insert into public.disputes (listing_id, rental_id, reporter_id, reason, prev_subject_status, item_returned)
      values (l.id, r.id, v_uid, trim(p_damage_note), 'ACTIVE', true) returning id into v_dispute;
      perform private.audit('dispute.open', 'dispute', v_dispute, l.hostel_id, jsonb_build_object('rental', r.id, 'damage_on_return', true));
    else
      update public.rentals set status = 'RETURNED', returned_at = now() where id = r.id;
      update public.listings set status = 'ACTIVE' where id = l.id;
      perform private.post_ledger(r.renter_id, 'DEPOSIT_REFUND', r.deposit_paise, 'rental:' || r.id || ':deposit_refund', l.id, null, r.id,
        p_note => 'Deposit refunded on return (sandbox)');
    end if;

  else -- STAFF_CUSTODY
    select * into s from public.staff_transfers where id = t.staff_transfer_id for update;
    if s.status <> 'PENDING' or l.status <> 'STAFF_PENDING' then perform private.fail('ILLEGAL_STATE', s.status::text); end if;
    update public.staff_transfers set status = 'ACCEPTED', accepted_by = v_uid, accepted_at = now() where id = s.id;
    update public.listings set status = 'STAFF_CUSTODY' where id = l.id;
  end if;

  perform private.audit('handover.consume', 'handover_token', t.id, l.hostel_id,
    jsonb_build_object('purpose', t.purpose, 'damage_reported', coalesce(p_report_damage, false)));
  return jsonb_build_object('purpose', t.purpose, 'listing_id', l.id, 'claim_id', t.claim_id,
    'rental_id', t.rental_id, 'staff_transfer_id', t.staff_transfer_id, 'dispute_id', v_dispute);
end $$;

-- ── Disputes ─────────────────────────────────────────────────────────────
create or replace function public.open_dispute(
  p_claim uuid, p_rental uuid, p_reason text, p_evidence_path text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user(); c public.claims; r public.rentals; l public.listings;
  v_id uuid; v_reason text := trim(coalesce(p_reason, ''));
begin
  if num_nonnulls(p_claim, p_rental) <> 1 then perform private.fail('INVALID_INPUT', 'exactly one subject'); end if;
  if char_length(v_reason) not between 10 and 1000 then perform private.fail('REASON_REQUIRED'); end if;
  if p_evidence_path is not null and p_evidence_path not like v_uid::text || '/%' then
    perform private.fail('INVALID_EVIDENCE');
  end if;

  if p_claim is not null then
    select * into c from public.claims where id = p_claim for update;
    if not found then perform private.fail('NOT_FOUND', 'claim'); end if;
    l := private.lock_listing(c.listing_id);
    if v_uid not in (c.claimer_id, l.owner_id) then perform private.fail('NOT_PARTY'); end if;
    if c.status <> 'PENDING_HANDOVER' then perform private.fail('ILLEGAL_STATE', c.status::text); end if;
    update public.claims set status = 'DISPUTED' where id = c.id;
    perform private.revoke_tokens(c.id, null, null);
    insert into public.disputes (listing_id, claim_id, reporter_id, reason, evidence_path, prev_subject_status)
    values (l.id, c.id, v_uid, v_reason, p_evidence_path, 'PENDING_HANDOVER') returning id into v_id;
  else
    select * into r from public.rentals where id = p_rental for update;
    if not found then perform private.fail('NOT_FOUND', 'rental'); end if;
    l := private.lock_listing(r.listing_id);
    if v_uid not in (r.renter_id, l.owner_id) then perform private.fail('NOT_PARTY'); end if;
    if r.status not in ('PENDING_PICKUP', 'ACTIVE') then perform private.fail('ILLEGAL_STATE', r.status::text); end if;
    update public.rentals set status = 'DISPUTED' where id = r.id;
    perform private.revoke_tokens(null, r.id, null);
    insert into public.disputes (listing_id, rental_id, reporter_id, reason, evidence_path, prev_subject_status)
    values (l.id, r.id, v_uid, v_reason, p_evidence_path, r.status::text) returning id into v_id;
  end if;

  update public.listings set status = 'DISPUTED' where id = l.id;
  perform private.audit('dispute.open', 'dispute', v_id, l.hostel_id);
  return v_id;
end $$;

create or replace function public.resolve_dispute(p_dispute uuid, p_outcome public.dispute_state, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user(); d public.disputes; c public.claims; r public.rentals; l public.listings;
  v_deduction bigint := 0; v_note text := trim(coalesce(p_note, ''));
begin
  select * into d from public.disputes where id = p_dispute for update;
  if not found then perform private.fail('NOT_FOUND', 'dispute'); end if;
  if d.status <> 'OPEN' then perform private.fail('DISPUTE_CLOSED'); end if;
  if p_outcome = 'OPEN' then perform private.fail('INVALID_OUTCOME'); end if;
  if char_length(v_note) not between 5 and 1000 then perform private.fail('REASON_REQUIRED'); end if;
  l := private.lock_listing(d.listing_id);
  if not public.has_hostel_scope(l.hostel_id, array['warden']::public.user_role[]) then perform private.fail('NOT_AUTHORIZED'); end if;

  if d.claim_id is not null then
    select * into c from public.claims where id = d.claim_id for update;
    if v_uid in (c.claimer_id, l.owner_id) then perform private.fail('CONFLICT_OF_INTEREST'); end if;
    if p_outcome = 'RESOLVED_REFUND' then
      update public.claims set status = 'REFUNDED', closed_at = now() where id = c.id;
      update public.listings set status = 'ACTIVE' where id = l.id;
      perform private.post_ledger(c.claimer_id, 'CLAIM_REFUND', c.amount_paise, 'claim:' || c.id || ':refund', l.id, c.id, null, d.id,
        'Refunded by warden decision (sandbox)');
    elsif p_outcome = 'RESOLVED_RELEASE' then
      update public.claims set status = 'COMPLETED', completed_at = now(), closed_at = now() where id = c.id;
      update public.listings set status = 'SOLD' where id = l.id;
      perform private.post_ledger(l.owner_id, 'SALE_PAYOUT', c.amount_paise, 'claim:' || c.id || ':payout', l.id, c.id, null, d.id,
        'Released to seller by warden decision (sandbox)');
    else
      perform private.fail('INVALID_OUTCOME', 'damage deductions apply to rentals only');
    end if;
  else
    select * into r from public.rentals where id = d.rental_id for update;
    if v_uid in (r.renter_id, l.owner_id) then perform private.fail('CONFLICT_OF_INTEREST'); end if;

    if d.prev_subject_status = 'PENDING_PICKUP' then
      if p_outcome = 'RESOLVED_REFUND' then
        update public.rentals set status = 'CANCELLED' where id = r.id;
        update public.listings set status = 'ACTIVE' where id = l.id;
        perform private.post_ledger(r.renter_id, 'RENT_REFUND', r.rent_paise, 'rental:' || r.id || ':rent_refund', l.id, null, r.id, d.id,
          'Rent refunded by warden decision (sandbox)');
        perform private.post_ledger(r.renter_id, 'DEPOSIT_REFUND', r.deposit_paise, 'rental:' || r.id || ':deposit_refund', l.id, null, r.id, d.id,
          'Deposit refunded by warden decision (sandbox)');
      elsif p_outcome = 'RESOLVED_RELEASE' then
        update public.rentals set status = 'PENDING_PICKUP' where id = r.id;
        update public.listings set status = 'RENTED' where id = l.id;
      else
        perform private.fail('INVALID_OUTCOME', 'item was never picked up');
      end if;
    else -- item was picked up (prev ACTIVE), possibly already returned
      if p_outcome = 'RESOLVED_RELEASE' then
        if d.item_returned then perform private.fail('INVALID_OUTCOME', 'item already returned'); end if;
        update public.rentals set status = 'ACTIVE' where id = r.id;
        update public.listings set status = 'RENTED' where id = l.id;
      else
        if p_outcome = 'RESOLVED_DAMAGE' then
          v_deduction := least(r.deposit_paise, private.bps_to_rupee(r.deposit_paise, 2500));
        end if;
        update public.rentals set status = 'RETURNED', returned_at = coalesce(returned_at, now()),
          damage_deduction_paise = v_deduction where id = r.id;
        update public.listings set status = 'ACTIVE' where id = l.id;
        if r.deposit_paise - v_deduction > 0 then
          perform private.post_ledger(r.renter_id, 'DEPOSIT_REFUND', r.deposit_paise - v_deduction,
            'rental:' || r.id || ':deposit_refund', l.id, null, r.id, d.id, 'Deposit refunded after warden decision (sandbox)');
        end if;
        if v_deduction > 0 then
          perform private.post_ledger(l.owner_id, 'DAMAGE_PAYOUT', v_deduction, 'rental:' || r.id || ':damage', l.id, null, r.id, d.id,
            'Damage deduction (25% of deposit) awarded by warden (sandbox)');
        end if;
      end if;
    end if;
  end if;

  update public.disputes set status = p_outcome, resolution_note = v_note, resolved_at = now(),
    decided_by = v_uid, deduction_paise = v_deduction where id = d.id;
  perform private.audit('dispute.resolve', 'dispute', d.id, l.hostel_id,
    jsonb_build_object('outcome', p_outcome, 'deduction_paise', v_deduction));
end $$;

-- ── Staff routing (final hour) ───────────────────────────────────────────
create or replace function public.route_to_staff(p_listing uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); l public.listings; v_id uuid;
begin
  l := private.lock_listing(p_listing);
  if not public.has_hostel_scope(l.hostel_id, array['warden']::public.user_role[]) then perform private.fail('NOT_AUTHORIZED'); end if;
  if exists (select 1 from public.staff_transfers where listing_id = l.id) then perform private.fail('ALREADY_ROUTED'); end if;
  if l.status not in ('ACTIVE', 'WITHDRAWN') then perform private.fail('ILLEGAL_STATE', l.status::text); end if;
  if l.departure_at is null or now() < l.departure_at - interval '1 hour' then perform private.fail('NOT_ROUTABLE'); end if;

  insert into public.staff_transfers (listing_id, owner_id, hostel_id, routed_by)
  values (l.id, l.owner_id, l.hostel_id, v_uid) returning id into v_id;
  update public.listings set status = 'STAFF_PENDING' where id = l.id;
  perform private.audit('staff_transfer.route', 'staff_transfer', v_id, l.hostel_id, jsonb_build_object('listing', l.id));
  return v_id;
end $$;

-- ── Read models ──────────────────────────────────────────────────────────
-- Marketplace cards: one row per listing with the live price and cover image.
-- security_invoker: the caller's RLS on listings still applies.
create or replace view public.listing_cards with (security_invoker = true) as
select
  l.id, l.title, l.description, l.status, l.condition, l.is_rentable,
  l.category_slug, c.name as category_name,
  l.start_price_paise, l.floor_price_paise,
  public.rio_current_price(l.start_price_paise, l.floor_price_paise, l.listed_at, l.departure_at, now()) as current_price_paise,
  l.listed_at, l.departure_at, l.created_at, l.owner_id,
  l.hostel_id, h.name as hostel_name,
  m.storage_path as cover_path, m.alt_text as cover_alt,
  l.search
from public.listings l
join public.categories c on c.slug = l.category_slug
left join public.hostels h on h.id = l.hostel_id
left join lateral (
  select storage_path, alt_text from public.listing_media
  where listing_id = l.id order by position limit 1
) m on true;

-- Estimated impact (coefficients are estimates, not measurements).
create or replace function public.impact_summary(p_hostel uuid default null)
returns table (
  items_diverted bigint, rentals_completed bigint,
  co2e_avoided_kg numeric, waste_diverted_kg numeric, volume_diverted_m3 numeric
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_hostel is null then
    if not public.is_admin() then perform private.fail('NOT_AUTHORIZED'); end if;
  elsif not public.has_hostel_scope(p_hostel, array['warden', 'staff']::public.user_role[]) then
    perform private.fail('NOT_AUTHORIZED');
  end if;
  return query
  with transfers as (
    select c.* from public.listings l join public.categories c on c.slug = l.category_slug
    where l.status in ('SOLD', 'STAFF_CUSTODY') and (p_hostel is null or l.hostel_id = p_hostel)
  ), rentals as (
    select c.* from public.rentals r
    join public.listings l on l.id = r.listing_id
    join public.categories c on c.slug = l.category_slug
    where r.status = 'RETURNED' and (p_hostel is null or l.hostel_id = p_hostel)
  )
  select
    (select count(*) from transfers),
    (select count(*) from rentals),
    coalesce((select sum(embodied_co2e_kg + 2.2) from transfers where embodied_co2e_kg > 0), 0)
      + coalesce((select sum(embodied_co2e_kg * 0.5) from rentals), 0),
    coalesce((select sum(tare_kg) from transfers), 0),
    coalesce((select sum(volume_m3) from transfers), 0);
end $$;

-- No-dues: residents of a hostel with anything still unresolved.
create or replace function public.no_dues_report(p_hostel uuid)
returns table (
  user_id uuid, full_name text, departure_at timestamptz,
  open_listings bigint, open_rentals bigint, open_disputes bigint, cleared boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_hostel_scope(p_hostel, array['warden']::public.user_role[]) then perform private.fail('NOT_AUTHORIZED'); end if;
  return query
  select p.id, p.full_name, pp.departure_at,
    ol.n, orr.n, od.n,
    (ol.n + orr.n + od.n) = 0
  from public.profiles p
  left join public.profile_private pp on pp.user_id = p.id
  cross join lateral (
    select count(*) as n from public.listings l
    where l.owner_id = p.id and l.departure_at is not null
      and l.status in ('ACTIVE', 'RESERVED', 'RENTED', 'STAFF_PENDING', 'DISPUTED')
  ) ol
  cross join lateral (
    select count(*) as n from public.rentals r
    where r.renter_id = p.id and r.status in ('PENDING_PICKUP', 'ACTIVE', 'DISPUTED')
  ) orr
  cross join lateral (
    select count(*) as n from public.disputes d
    left join public.claims c on c.id = d.claim_id
    left join public.rentals r on r.id = d.rental_id
    join public.listings l on l.id = d.listing_id
    where d.status = 'OPEN' and p.id in (d.reporter_id, l.owner_id, c.claimer_id, r.renter_id)
  ) od
  where p.hostel_id = p_hostel and p.role = 'student'
  order by (ol.n + orr.n + od.n) desc, pp.departure_at nulls last, p.full_name;
end $$;
