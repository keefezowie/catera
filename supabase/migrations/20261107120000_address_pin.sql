-- A saved address can carry the customer's pin (2026-11-07).
--   lat and lng are optional: older and imported addresses keep only their written lines, and older app builds keep
--   saving without them. A later save with no pin leaves the stored pin as it is.
--   Delivery days and customer records copy the whole address row, so a pin reaches the kitchen through the deliveries
--   the customer ordered from it. The importer's choice list is the one read that shows a kitchen a customer's whole
--   address book, so it answers without the pins.

alter table v1.addresses
 add column lat numeric(9,6),
 add column lng numeric(9,6),
 add constraint addresses_pin_check check (
  (lat is null)=(lng is null)
  and (lat is null or (lat between -11.5 and 6.5 and lng between 94.5 and 141.5))
 );

alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_pin_base;
revoke all on function public.catera_v1_command_pin_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb; replay boolean; pin_lat numeric; pin_lng numeric;
begin
 if action is distinct from 'address.save' or u is null or jsonb_typeof(payload) is distinct from 'object'
   or not (payload ? 'lat' or payload ? 'lng') then
  return public.catera_v1_command_pin_base(action,payload,request_id);
 end if;
 if jsonb_typeof(payload->'lat') is distinct from 'number' or jsonb_typeof(payload->'lng') is distinct from 'number' then
  raise exception 'INVALID_INPUT';
 end if;
 pin_lat:=(payload->>'lat')::numeric;
 pin_lng:=(payload->>'lng')::numeric;
 if pin_lat not between -11.5 and 6.5 or pin_lng not between 94.5 and 141.5 then raise exception 'INVALID_INPUT';end if;
 -- The same lock the base takes, so a retry and a newer save never interleave.
 perform pg_advisory_xact_lock(hashtext(u::text));
 -- A retry answers its stored receipt and must not put an older pin back over a newer save.
 replay:=exists(select 1 from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id);
 result:=public.catera_v1_command_pin_base(action,payload,request_id);
 if not replay then
  update v1.addresses set lat=pin_lat,lng=pin_lng where id=(result->>'id')::uuid and user_id=u;
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_pin_base;
revoke all on function public.catera_v1_read_pin_base(text,jsonb) from public,anon,authenticated;

create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.catera_v1_read_pin_base(resource,params);
 if resource='seller-import-options' and jsonb_typeof(result->'customers')='array' then
  result:=jsonb_set(result,'{customers}',coalesce((select jsonb_agg(
    case when jsonb_typeof(cu->'addresses')='array' then jsonb_set(cu,'{addresses}',coalesce(
      (select jsonb_agg(ad-'lat'-'lng' order by m) from jsonb_array_elements(cu->'addresses') with ordinality s(ad,m)),'[]'::jsonb))
     else cu end order by n)
   from jsonb_array_elements(result->'customers') with ordinality t(cu,n)),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
