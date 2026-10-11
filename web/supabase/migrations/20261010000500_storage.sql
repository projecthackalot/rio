-- RIO Level 1 · 5/5 — Storage buckets and policies.
--
--  listing-media     public read (product photos are meant to be seen),
--                    writes only into the uploader's own <uid>/ folder,
--                    images only, 5 MB max.
--  dispute-evidence  PRIVATE. Uploader writes into <uid>/; read access only
--                    for the uploader, the other party of the disputed
--                    transaction and wardens scoped to the listing's hostel.
--                    Served to the app via short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-media', 'listing-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('dispute-evidence', 'dispute-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_evidence(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.disputes d
    join public.listings l on l.id = d.listing_id
    left join public.claims c on c.id = d.claim_id
    left join public.rentals r on r.id = d.rental_id
    where d.evidence_path = p_path
      and (auth.uid() in (d.reporter_id, l.owner_id, c.claimer_id, r.renter_id)
           or public.has_hostel_scope(l.hostel_id))
  )
$$;
revoke all on function public.can_read_evidence(text) from public;
grant execute on function public.can_read_evidence(text) to authenticated;

drop policy if exists "rio: listing media is publicly readable" on storage.objects;
drop policy if exists "rio: upload listing media to own folder" on storage.objects;
drop policy if exists "rio: delete own listing media" on storage.objects;
drop policy if exists "rio: upload evidence to own folder" on storage.objects;
drop policy if exists "rio: read permitted evidence" on storage.objects;

create policy "rio: listing media is publicly readable" on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-media');

create policy "rio: upload listing media to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "rio: delete own listing media" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "rio: upload evidence to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "rio: read permitted evidence" on storage.objects for select to authenticated
  using (
    bucket_id = 'dispute-evidence'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.can_read_evidence(name))
  );
