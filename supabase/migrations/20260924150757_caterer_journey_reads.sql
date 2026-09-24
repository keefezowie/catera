-- Presentation reads only. Existing commands, reservations and authorization
-- remain in the previous RPC chain. No new business data is stored here.
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_journeys_base;
revoke all on function public.catera_v1_read_journeys_base(text,jsonb) from public,anon,authenticated;

create function public.catera_v1_read(resource text,params jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 result jsonb; cid uuid; record_id uuid; term text;
 day date; saved v1.production; current_entries jsonb;
begin
 -- Always enter the existing authorized read first, including for direct IDs.
 result := public.catera_v1_read_journeys_base(resource,params);
 if resource='seller-customers' then
  cid := (params->>'id')::uuid;
  if not(v1.is_staff(auth.uid(),cid) or v1.is_admin(auth.uid())) then raise exception 'FORBIDDEN'; end if;
  record_id := nullif(params->>'customerRecordId','')::uuid;
  if params ? 'customerId' then record_id := (result->'customers'->0->>'id')::uuid; end if;
  term := lower(left(trim(coalesce(params->>'search','')),100));
  with matching as materialized (
   select cr.* from v1.customer_records cr
   where cr.caterer_id=cid
    and (not(params ? 'customerId') or record_id is not null)
    and (record_id is null or cr.id=record_id)
    and (params->>'followup' is distinct from 'true' or v1.pilot_followup_due(cr.id))
    and (record_id is not null or term='' or strpos(lower(cr.name),term)>0 or strpos(coalesce(cr.phone,''),term)>0)
  ), page as (
   select * from matching order by name,id limit 100 offset greatest(coalesce((params->>'offset')::int,0),0)
  )
  select result || jsonb_build_object(
   'customers',coalesce((select jsonb_agg(v1.pilot_customer(p,record_id is not null) order by p.name,p.id) from page p),'[]'),
   'total',(select count(*) from matching)
  ) into result;
 elsif resource='seller' then
  cid := (params->>'id')::uuid;
  if not(v1.is_staff(auth.uid(),cid) or v1.is_admin(auth.uid())) then raise exception 'FORBIDDEN'; end if;
  day := (result->>'operationalDate')::date;
  select * into saved from v1.production where caterer_id=cid and service_date=day order by revision desc limit 1;
  if found then
   select coalesce(jsonb_agg(v1.delivery(d)),'[]') into current_entries
   from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
   where p.caterer_id=cid and d.service_date=day and d.status<>'cancelled';
   result := result || jsonb_build_object('latestProduction',jsonb_build_object(
    'id',saved.id,'revision',saved.revision,'createdAt',saved.created_at,
    'changed',v1.beta_production_signature(saved.entries) is distinct from v1.beta_production_signature(current_entries)));
  else result := result || jsonb_build_object('latestProduction',null); end if;
 elsif resource='seller-attention' then
  result := jsonb_set(result,'{items}',coalesce((select jsonb_agg(
   case when item->>'kind' in('choice_deadline','choice_fallback','delivery') then
    item || jsonb_build_object('href',item->>'href'||'&delivery='||substring(item->>'id' from case when item->>'kind'='delivery' then 10 else 8 end for 36)||'&meal='||regexp_replace(item->>'id','^.*-',''))
   else item end order by ord)
   from jsonb_array_elements(result->'items') with ordinality a(item,ord)),'[]'));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
