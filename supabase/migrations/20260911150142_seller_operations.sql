-- Preserve existing readers (including purchased menus and calendar metadata).
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_operations_base;
revoke all on function public.catera_v1_read_operations_base(text,jsonb) from public,anon,authenticated;

create or replace function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; dt date; first_day date; last_day date; today date; result jsonb; meal_filter text:=coalesce(params->>'meal','all'); status_filter text:=coalesce(params->>'status','active');
begin
 if resource not in ('seller','seller-calendar') then return public.catera_v1_read_operations_base(resource,params);end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 cid:=(params->>'id')::uuid;
 if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
 select (clock_timestamp() at time zone timezone)::date into today from v1.caterers where id=cid;
 if resource='seller' then
  dt:=coalesce((params->>'date')::date,today);
  result:=public.catera_v1_read_operations_base(resource,params||jsonb_build_object('date',dt));
  return result||jsonb_build_object('operationalDate',dt,'today',today,'deliveries',coalesce((
   select jsonb_agg(v1.delivery(d)||jsonb_build_object('customer',jsonb_build_object('id',s.user_id,'name',c.name)) order by c.name,d.id)
   from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id join v1.profiles c on c.id=s.user_id
   where p.caterer_id=cid and d.service_date=dt
  ),'[]'::jsonb));
 end if;
 first_day:=(params->>'from')::date;last_day:=(params->>'to')::date;
 if first_day is null or last_day is null or last_day<first_day or last_day-first_day>62 or meal_filter not in('all','lunch','dinner') or status_filter not in('active','all','cancelled') then raise exception 'INVALID_INPUT';end if;
 return jsonb_build_object('days',coalesce((select jsonb_agg(to_jsonb(x) order by x.date) from (
  select d.service_date as date,count(*)::int orders,
   bool_or(exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal='lunch' and (meal_filter in('all','lunch')))) lunch,
   bool_or(exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal='dinner' and (meal_filter in('all','dinner')))) dinner
  from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where p.caterer_id=cid and d.service_date between first_day and last_day
   and (nullif(params->>'packageId','') is null or p.id=(params->>'packageId')::uuid)
   and (status_filter='all' or (status_filter='active' and d.status<>'cancelled') or (status_filter='cancelled' and d.status='cancelled'))
   and exists(select 1 from v1.fulfillments f where f.day_id=d.id and (meal_filter='all' or f.meal=meal_filter))
  group by d.service_date
 )x),'[]'::jsonb));
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

-- The existing single-item command owns transitions, notifications and audits.
-- A batch calls it within one transaction, after locking packages then days in
-- deterministic order, matching the single-item command's package-first order.
create or replace function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; dt date; item jsonb; old v1.receipts; result jsonb; fingerprint text:=md5(action||payload::text); n int;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action='capacity.save' then raise exception 'INVALID_ACTION';end if;
 if action<>'delivery.statusBatch' then return public.catera_v1_command_legacy(action,payload,request_id);end if;
 cid:=(payload->>'catererId')::uuid;dt:=(payload->>'date')::date;
 if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
 if request_id is null or dt is null or coalesce(payload->>'meal','') not in('lunch','dinner') or coalesce(payload->>'status','') not in('preparing','out_for_delivery','delivered','issue') or jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'INVALID_INPUT';end if;
 n:=jsonb_array_length(payload->'items');
 if n not between 1 and 500 or (select count(distinct value->>'id') from jsonb_array_elements(payload->'items'))<>n then raise exception 'INVALID_INPUT';end if;
 for item in select value from jsonb_array_elements(payload->'items') loop
  if item->>'id' is null or jsonb_typeof(item->'version') is distinct from 'number' or (item->>'version')::numeric<>trunc((item->>'version')::numeric) or (item->>'version')::numeric<1 then raise exception 'INVALID_INPUT';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts r where r.actor_id=u and r.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 if (select count(*) from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=cid and d.service_date=dt and d.id in(select (value->>'id')::uuid from jsonb_array_elements(payload->'items')))<>n then raise exception 'FORBIDDEN';end if;
 perform p.id from v1.packages p where p.id in(select s.package_id from v1.subscriptions s join v1.delivery_days d on d.subscription_id=s.id where d.id in(select (value->>'id')::uuid from jsonb_array_elements(payload->'items'))) order by p.id for update;
 perform d.id from v1.delivery_days d where d.id in(select (value->>'id')::uuid from jsonb_array_elements(payload->'items')) order by d.id for update;
 for item in select value from jsonb_array_elements(payload->'items') order by value->>'id' loop
  if not exists(select 1 from v1.delivery_days d where d.id=(item->>'id')::uuid and d.service_date=dt and d.status<>'cancelled') then raise exception 'CONFLICT';end if;
  perform public.catera_v1_command_legacy('delivery.status',item||jsonb_build_object('meal',payload->>'meal','status',payload->>'status'),gen_random_uuid());
 end loop;
 result:=jsonb_build_object('updated',n);
 insert into v1.audit(actor_id,action,details) values(u,action,payload||jsonb_build_object('requestId',request_id));
 insert into v1.receipts values(u,request_id,fingerprint,result);
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
