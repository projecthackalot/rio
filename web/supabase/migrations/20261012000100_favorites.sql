-- RIO Level 1 — saved items ("favorites").
--
-- Private to each user: nobody else (not the seller, not wardens) can see who
-- saved what, and no counts are exposed, so there is no fabricated or leaked
-- "social proof". A user can only save a listing they are able to see.

create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites (listing_id);

alter table public.favorites enable row level security;

-- user_id is never client-supplied: only listing_id may be inserted, user_id defaults to auth.uid().
grant select, delete on public.favorites to authenticated;
grant insert (listing_id) on public.favorites to authenticated;

create policy "Users read their own saved items" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users save listings they can see" on public.favorites for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_id)
  );

create policy "Users remove their own saved items" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));
