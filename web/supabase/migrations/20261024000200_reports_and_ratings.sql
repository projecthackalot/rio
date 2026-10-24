-- Trust features from the competitor review: reporting listings (with warden
-- moderation) and seller ratings tied to real, completed transactions.

-- ── Listing reports ─────────────────────────────────────────────────────
create type public.report_reason as enum ('prohibited', 'misleading', 'scam', 'duplicate', 'offensive', 'other');
create type public.report_state as enum ('OPEN', 'DISMISSED', 'ACTIONED');

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason public.report_reason not null,
  details text check (details is null or char_length(details) <= 500),
  status public.report_state not null default 'OPEN',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- One open report per person per listing (no report-spamming).
create unique index listing_reports_one_open on public.listing_reports (listing_id, reporter_id) where status = 'OPEN';
create index listing_reports_open_idx on public.listing_reports (status, created_at desc);

alter table public.listing_reports enable row level security;
grant select on public.listing_reports to authenticated;
-- Listing owners deliberately have no branch here: they never learn who reported them.
create policy "Reporters see their reports; scoped wardens see hostel reports" on public.listing_reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or exists (select 1 from public.listings l where l.id = listing_id and public.has_hostel_scope(l.hostel_id))
  );

create or replace function public.report_listing(p_listing uuid, p_reason public.report_reason, p_details text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); l public.listings; v_id uuid;
begin
  select * into l from public.listings where id = p_listing;
  if not found or l.status not in ('ACTIVE', 'WITHDRAWN', 'RESERVED', 'RENTED') then perform private.fail('NOT_FOUND', 'listing'); end if;
  if l.owner_id = v_uid then perform private.fail('OWN_LISTING'); end if;
  begin
    insert into public.listing_reports (listing_id, reporter_id, reason, details)
    values (l.id, v_uid, p_reason, nullif(left(trim(coalesce(p_details, '')), 500), '')) returning id into v_id;
  exception when unique_violation then
    perform private.fail('ALREADY_REPORTED');
  end;
  perform private.audit('report.create', 'listing_report', v_id, l.hostel_id, jsonb_build_object('listing', l.id, 'reason', p_reason));
  return v_id;
end $$;

-- Scoped warden/admin decision. 'remove' withdraws the listing (if it is not in a transaction)
-- and closes every open report on it; 'dismiss' closes just this report.
create or replace function public.review_report(p_report uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); r public.listing_reports; l public.listings;
begin
  if p_action not in ('dismiss', 'remove') then perform private.fail('INVALID_INPUT', 'action'); end if;
  select * into r from public.listing_reports where id = p_report for update;
  if not found then perform private.fail('NOT_FOUND', 'report'); end if;
  if r.status <> 'OPEN' then perform private.fail('ILLEGAL_STATE', r.status::text); end if;
  l := private.lock_listing(r.listing_id);
  if not public.has_hostel_scope(l.hostel_id, array['warden']::public.user_role[]) then perform private.fail('NOT_AUTHORIZED'); end if;
  if v_uid in (l.owner_id, r.reporter_id) then perform private.fail('CONFLICT_OF_INTEREST'); end if;

  if p_action = 'remove' then
    if l.status = 'ACTIVE' then update public.listings set status = 'WITHDRAWN' where id = l.id; end if;
    update public.listing_reports set status = 'ACTIONED', reviewed_by = v_uid, reviewed_at = now()
      where listing_id = l.id and status = 'OPEN';
  else
    update public.listing_reports set status = 'DISMISSED', reviewed_by = v_uid, reviewed_at = now() where id = r.id;
  end if;
  perform private.audit('report.review', 'listing_report', r.id, l.hostel_id, jsonb_build_object('action', p_action, 'listing', l.id));
end $$;

-- ── Seller ratings ──────────────────────────────────────────────────────
create table public.seller_ratings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  claim_id uuid unique references public.claims(id) on delete cascade,
  rental_id uuid unique references public.rentals(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  constraint seller_ratings_one_subject check (num_nonnulls(claim_id, rental_id) = 1),
  constraint seller_ratings_not_self check (seller_id <> rater_id)
);
create index seller_ratings_seller_idx on public.seller_ratings (seller_id, created_at desc);

alter table public.seller_ratings enable row level security;
-- Members can read ratings (stars, comment, date) but not who left them.
grant select (id, seller_id, stars, comment, created_at) on public.seller_ratings to authenticated;
create policy "Members read ratings" on public.seller_ratings for select to authenticated using (true);

create or replace function public.rate_transaction(p_claim uuid, p_rental uuid, p_stars smallint, p_comment text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_seller uuid; v_id uuid;
begin
  if num_nonnulls(p_claim, p_rental) <> 1 then perform private.fail('INVALID_INPUT', 'exactly one subject'); end if;
  if p_stars is null or p_stars not between 1 and 5 then perform private.fail('INVALID_INPUT', 'stars'); end if;
  if p_claim is not null then
    select l.owner_id into v_seller from public.claims c join public.listings l on l.id = c.listing_id
      where c.id = p_claim and c.claimer_id = v_uid and c.status = 'COMPLETED';
  else
    select l.owner_id into v_seller from public.rentals r join public.listings l on l.id = r.listing_id
      where r.id = p_rental and r.renter_id = v_uid and r.status in ('RETURNED', 'CONVERTED');
  end if;
  if v_seller is null then perform private.fail('NOT_RATEABLE'); end if;
  begin
    insert into public.seller_ratings (seller_id, rater_id, claim_id, rental_id, stars, comment)
    values (v_seller, v_uid, p_claim, p_rental, p_stars, nullif(left(trim(coalesce(p_comment, '')), 300), '')) returning id into v_id;
  exception when unique_violation then
    perform private.fail('ALREADY_RATED');
  end;
  return v_id;
end $$;

-- Public summary (also for signed-out visitors): count and average only.
create or replace function public.seller_rating(p_seller uuid) returns table (ratings bigint, average numeric)
language sql stable security definer set search_path = '' as $$
  select count(*), round(avg(stars)::numeric, 1) from public.seller_ratings where seller_id = p_seller
$$;

revoke all on function public.report_listing(uuid, public.report_reason, text), public.review_report(uuid, text),
  public.rate_transaction(uuid, uuid, smallint, text), public.seller_rating(uuid) from public;
grant execute on function public.report_listing(uuid, public.report_reason, text), public.review_report(uuid, text),
  public.rate_transaction(uuid, uuid, smallint, text) to authenticated;
grant execute on function public.seller_rating(uuid) to anon, authenticated;
