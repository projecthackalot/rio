-- Photo thumbnails. The browser now uploads two compressed versions of every
-- listing photo: a full image (~1600 px) for the item page and a thumbnail
-- (~480 px) for marketplace cards, so grids download a fraction of the bytes.

alter table public.listing_media
  add column if not exists thumb_path text
    check (thumb_path is null or thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$');

-- The thumbnail must live in the same <owner>/<listing>/ folder as its photo,
-- so the existing "own folder" insert policy on storage_path covers it too.
alter table public.listing_media
  add constraint listing_media_thumb_same_folder check (
    thumb_path is null
    or (split_part(thumb_path, '/', 1) = split_part(storage_path, '/', 1)
        and split_part(thumb_path, '/', 2) = split_part(storage_path, '/', 2))
  );

grant insert (thumb_path) on public.listing_media to authenticated;

-- New column appended at the end so CREATE OR REPLACE keeps the view's grants.
create or replace view public.listing_cards with (security_invoker = true) as
select
  l.id, l.title, l.description, l.status, l.condition, l.is_rentable,
  l.category_slug, c.name as category_name,
  l.start_price_paise, l.floor_price_paise,
  public.rio_current_price(l.start_price_paise, l.floor_price_paise, l.listed_at, l.departure_at, now()) as current_price_paise,
  l.listed_at, l.departure_at, l.created_at, l.owner_id,
  l.hostel_id, h.name as hostel_name,
  m.storage_path as cover_path, m.alt_text as cover_alt,
  l.search,
  m.thumb_path as cover_thumb_path
from public.listings l
join public.categories c on c.slug = l.category_slug
left join public.hostels h on h.id = l.hostel_id
left join lateral (
  select storage_path, alt_text, thumb_path from public.listing_media
  where listing_id = l.id order by position limit 1
) m on true;
