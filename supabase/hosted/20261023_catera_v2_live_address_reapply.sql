-- Hosted-only (Catera V2, kdfddipnkcviberrldpk). Not a repo migration: the demo DB applies
-- 20260924150757_caterer_journey_reads long before 20261020100000_customer_live_address, so its order
-- is already right. On hosted, caterer_journey_reads is applied after customer_live_address, so its
-- 'seller-customers' branch rebuilds the customer list from v1.customer_records on top of the read
-- chain and would put archived addresses back. This file puts the customer_live_address behaviour
-- (GC-F7) back on top of the chain, with the body of 20261020100000_customer_live_address.sql unchanged
-- apart from the base it calls.
--
-- New base name: public.catera_v1_read_live_address_reapply_base(text,jsonb). It is the
-- caterer_journey_reads wrapper, renamed. public.catera_v1_read_live_address_base stays where it is
-- (under catera_v1_read_journeys_base) and is not touched.
--
-- Idempotent: the rename and the re-create run only while the reapply base does not exist and the
-- current top of the chain is the caterer_journey_reads wrapper. Run again, it changes nothing when
-- the top is already this wrapper, and it stops with LIVE_ADDRESS_REAPPLY_CHAIN when the chain is in
-- any other shape, rather than overwrite a later layer.

do $outer$
declare top text;
begin
 if to_regprocedure('public.catera_v1_read_live_address_reapply_base(text,jsonb)') is not null then
  select prosrc into top from pg_proc where oid='public.catera_v1_read(text,jsonb)'::regprocedure;
  if position('public.catera_v1_read_live_address_reapply_base(' in top)=0 then raise exception 'LIVE_ADDRESS_REAPPLY_CHAIN';end if;
  return;
 end if;
 if to_regprocedure('public.catera_v1_read_journeys_base(text,jsonb)') is null then raise exception 'LIVE_ADDRESS_REAPPLY_CHAIN';end if;
 select prosrc into top from pg_proc where oid='public.catera_v1_read(text,jsonb)'::regprocedure;
 if position('public.catera_v1_read_journeys_base(' in top)=0 then raise exception 'LIVE_ADDRESS_REAPPLY_CHAIN';end if;

 alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_live_address_reapply_base;

 execute $fn$
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; uuid_re constant text:='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
 result:=public.catera_v1_read_live_address_reapply_base(resource,params);
 if resource='seller-customers' and jsonb_typeof(result->'customers')='array' then
  result:=jsonb_set(result,'{customers}',coalesce((select jsonb_agg(
   case when cu->>'user_id' ~ uuid_re and cu->>'id' ~ uuid_re and cu->'address'->>'id' ~ uuid_re
     and exists(select 1 from v1.addresses a
      where a.id=(cu->'address'->>'id')::uuid and a.user_id=(cu->>'user_id')::uuid and a.archived_at is not null)
    then jsonb_set(cu,'{address}',coalesce(
     (select d.address from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id
       where s.customer_record_id=(cu->>'id')::uuid and d.status not in('delivered','cancelled')
        and d.service_date>=(now() at time zone 'Asia/Jakarta')::date
        and not (coalesce(d.address->>'id','') ~ uuid_re and exists(select 1 from v1.addresses a
          where a.id=(d.address->>'id')::uuid and a.archived_at is not null))
       order by d.service_date,d.id limit 1),
     '{}'::jsonb))
    else cu end order by n)
   from jsonb_array_elements(result->'customers') with ordinality t(cu,n)),'[]'::jsonb));
 end if;
 return result;
end $$
$fn$;
end $outer$;

revoke all on function public.catera_v1_read_live_address_reapply_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
