-- Fix: public.rio_current_price() is called by ordinary roles (through the
-- listing_cards view) and runs with the caller's privileges. It called
-- private.round_half_up_div(), but anon/authenticated have no USAGE on the
-- `private` schema, so every query selecting current_price_paise failed with
-- "permission denied for schema private".
--
-- The half-up rounding is now inlined; the algorithm is unchanged
-- (floor((2n + d) / (2d)), identical to src/domain/pricing.ts).

create or replace function public.rio_current_price(
  p_start bigint, p_floor bigint, p_listed timestamptz, p_departure timestamptz, p_at timestamptz default now()
) returns bigint
language plpgsql stable set search_path = '' as $$
declare
  l bigint; d bigint; t bigint; span bigint; elapsed bigint; n bigint; step bigint; rounded bigint;
begin
  if p_departure is null then return p_start; end if;
  l := floor(extract(epoch from p_listed))::bigint;
  d := floor(extract(epoch from p_departure))::bigint - 7200; -- decay ends 2h before departure
  t := floor(extract(epoch from p_at))::bigint;
  span := d - l;
  if span <= 0 then return p_floor; end if;
  elapsed := least(span, greatest(0, t - l));
  n := p_start * span - (p_start - p_floor) * elapsed; -- raw price × span
  step := span * 500;                                  -- ₹5 in paise, same scale
  rounded := ((2 * n + step) / (2 * step)) * 500;      -- half-up to the nearest ₹5
  return least(p_start, greatest(p_floor, rounded));
end $$;

grant execute on function public.rio_current_price(bigint, bigint, timestamptz, timestamptz, timestamptz) to anon, authenticated;
