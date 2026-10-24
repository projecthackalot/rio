-- Raters are hidden from everyone (seller_ratings.rater_id is not client-readable),
-- so the activity page asks this function which of the caller's OWN
-- transactions they have already rated, to show "Rate seller" only once.
create or replace function public.my_rated_transactions() returns table (claim_id uuid, rental_id uuid)
language sql stable security definer set search_path = '' as $$
  select claim_id, rental_id from public.seller_ratings where rater_id = auth.uid()
$$;
revoke all on function public.my_rated_transactions() from public;
grant execute on function public.my_rated_transactions() to authenticated;
