-- seller-calendar counts a day for a meal only while that meal is still served: its fulfilment is not cancelled
-- and the delivery day itself is not cancelled (the kitchen's servesMeal rule, packages/domain/src/kitchen.ts).
-- A meal in 'issue' (Gagal diantar) still counts, because Dapur's failed-meal card and the web day list both show
-- it on that day. The live seller-calendar branch is the seller_operations read, renamed to
-- catera_v1_read_lifecycle_base by 20260911163608_package_lifecycle.sql; every later wrapper delegates other
-- resources down to it. Only that branch's filter changes: the response shape, the staff authorization and every
-- other resource stay as they were. The rule applies to the default active view; the cancelled and all views keep
-- listing cancelled production as before.
create or replace function public.catera_v1_read_lifecycle_base(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; dt date; first_day date; last_day date; today date; result jsonb; meal_filter text:=coalesce(params->>'meal','all'); status_filter text:=coalesce(params->>'status','active');
begin
 -- seller-calendar served meals (20261030100000)
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
   bool_or(exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal='lunch' and (status_filter<>'active' or f.status<>'cancelled') and (meal_filter in('all','lunch')))) lunch,
   bool_or(exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal='dinner' and (status_filter<>'active' or f.status<>'cancelled') and (meal_filter in('all','dinner')))) dinner
  from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where p.caterer_id=cid and d.service_date between first_day and last_day
   and (nullif(params->>'packageId','') is null or p.id=(params->>'packageId')::uuid)
   and (status_filter='all' or (status_filter='active' and d.status<>'cancelled') or (status_filter='cancelled' and d.status='cancelled'))
   and exists(select 1 from v1.fulfillments f where f.day_id=d.id and (meal_filter='all' or f.meal=meal_filter)
    and (status_filter<>'active' or f.status<>'cancelled'))
  group by d.service_date
 )x),'[]'::jsonb));
end $$;
