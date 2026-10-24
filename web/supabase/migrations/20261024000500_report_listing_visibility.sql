-- report_listing runs as definer, so it saw listings that RLS hides from the caller and its
-- different errors revealed whether a hidden listing existed. It now applies the same
-- visibility as the listings select policies (active, own, or a party to the transaction)
-- and answers NOT_FOUND for anything the caller cannot see.
create or replace function public.report_listing(p_listing uuid, p_reason public.report_reason, p_details text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); l public.listings; v_id uuid;
begin
  select * into l from public.listings where id = p_listing;
  if not found
     or l.status not in ('ACTIVE', 'WITHDRAWN', 'RESERVED', 'RENTED')
     or not (l.status = 'ACTIVE' or l.owner_id = v_uid or public.is_listing_counterparty(l.id)) then
    perform private.fail('NOT_FOUND', 'listing');
  end if;
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
