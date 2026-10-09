-- The kitchen marks a session as cooking (Phase C, native daily loop).
-- delivery.cook moves one caterer's scheduled meals of the Jakarta day itself to 'preparing' and
-- stamps cooking_started_at. It sends no push (Ruling C2): customers see "Dimasak" on their next
-- read, and the realtime event row tells an open app to read again.
-- It follows the delivery.depart wrapper of 20261008102500_depart_today_one_push.sql: same input
-- check, staff check, receipt replay, Jakarta-day check and lock order, so cook and depart
-- serialise on the caterer lock and on the day and fulfilment rows.
-- The delivery read also exposes cooking_started_at and confirmed_by per meal, and neither counts
-- as a production change.

alter table v1.fulfillments add column if not exists cooking_started_at timestamptz;

-- The current command body names its own receipt lookup with the function name
-- (catera_v1_command.request_id), so the base is re-created under its new name, as
-- 20261008111000_push_report_renewal_dedupe.sql does.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_cook_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_cook_base('),
   'catera_v1_command.request_id','catera_v1_command_cook_base.request_id');
end $$;
revoke all on function public.catera_v1_command_cook_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; dt date; m text; old v1.receipts; r record; moved int:=0; uids uuid[]:='{}';
 fingerprint text:=md5(action||payload::text); result jsonb;
begin
 if action<>'delivery.cook' then
  return public.catera_v1_command_cook_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object'
  or not(payload ?& array['catererId','date','meal']) or (payload - array['catererId','date','meal'])<>'{}'::jsonb
  or jsonb_typeof(payload->'catererId') is distinct from 'string' or jsonb_typeof(payload->'date') is distinct from 'string'
  or jsonb_typeof(payload->'meal') is distinct from 'string' or payload->>'meal' not in ('lunch','dinner')
  or payload->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_INPUT';end if;
 begin cid:=(payload->>'catererId')::uuid;dt:=(payload->>'date')::date;exception when others then raise exception 'INVALID_INPUT';end;
 m:=payload->>'meal';
 if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 -- Only the Jakarta day itself, as for departure.
 if dt is distinct from (now() at time zone 'Asia/Jakarta')::date then raise exception 'INVALID_DATE';end if;
 perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
 -- Days first, in id order, then the meals: the order delivery.depart, delivery.confirm and the nightly job use.
 perform d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where p.caterer_id=cid and d.service_date=dt and d.status<>'cancelled'
   and exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal=m)
  order by d.id for update of d;
 for r in
  select f.day_id,s.user_id,d.status day_status from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id
   join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where p.caterer_id=cid and d.service_date=dt and d.status<>'cancelled' and f.meal=m and f.status='scheduled'
  order by f.day_id for update of f
 loop
  update v1.fulfillments set status='preparing',cooking_started_at=now() where day_id=r.day_id and meal=m;
  moved:=moved+1;
  if r.day_status='scheduled' then
   update v1.delivery_days set status='preparing',version=version+1 where id=r.day_id;
  end if;
  if r.user_id is not null then uids:=uids||r.user_id;end if;
 end loop;
 -- One realtime event per customer, however many of their packages moved.
 insert into public.catera_v1_events(id,user_id,topic) select gen_random_uuid(),x,'delivery.changed' from (select distinct unnest(uids) x) w;
 result:=jsonb_build_object('moved',moved);
 insert into v1.audit(actor_id,action,details) values(u,action,payload||jsonb_build_object('moved',moved,'requestId',request_id));
 insert into v1.receipts(actor_id,request_id,hash,result) values(u,request_id,fingerprint,result);
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

-- Same definition as 20261008113000_caterer_whatsapp.sql plus cooking_started_at and confirmed_by per meal.
create or replace function v1.delivery(d v1.delivery_days) returns jsonb language sql stable set search_path='' as $$
 select v1.delivery_pilot_base(d)||jsonb_build_object('meals',(select jsonb_agg(jsonb_build_object(
 'meal',f.meal,'status',f.status,'departed_at',f.departed_at,'confirmed_at',f.confirmed_at,
 'cooking_started_at',f.cooking_started_at,'confirmed_by',f.confirmed_by,
 'reaction',(select r.reaction from v1.delivery_reactions r where r.day_id=f.day_id and r.meal=f.meal),
 'issue',(select jsonb_build_object('id',i.id,'status',i.status) from v1.delivery_issues i
  where i.day_id=f.day_id and i.meal=f.meal and i.status in ('open','responded','escalated')
  order by i.created_at desc, i.id desc limit 1)
 ) order by f.meal desc) from v1.fulfillments f where f.day_id=d.id))
 ||jsonb_build_object('catererPhone',case when auth.uid() is not null and s.user_id=auth.uid()
  then v1.caterer_whatsapp((s.snapshot->'offer'->>'catererId')::uuid) end)
 ||case when v1.is_staff(auth.uid(),(s.snapshot->'offer'->>'catererId')::uuid) then jsonb_build_object('customer',jsonb_build_object(
 'id',coalesce(s.user_id,s.customer_record_id),'name',coalesce(cr.name,p.name)), 'customerRecordId',s.customer_record_id) else '{}'::jsonb end
 from v1.subscriptions s left join v1.customer_records cr on cr.id=s.customer_record_id left join v1.profiles p on p.id=s.user_id where s.id=d.subscription_id
$$;

-- Cooking and who confirmed arrival are not what the kitchen produces: neither may count as a
-- production change. Frozen snapshots made before these keys existed lack them, so strip both sides.
-- Cooking also moves the day and the meal to 'preparing' and bumps the day's version, as the
-- departure moves them to 'out_for_delivery': progress through the day is not a change either, so
-- both statuses read as 'scheduled' and the version is dropped. Every real change (address, date,
-- portions, menu) still differs in a field that stays in the signature.
create or replace function v1.beta_production_signature(entries jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(
  case when jsonb_typeof(y->'meals')='array' then jsonb_set(y,'{meals}',
   coalesce((select jsonb_agg(case when s.m->>'status' in ('preparing','out_for_delivery') then jsonb_set(s.m,'{status}','"scheduled"') else s.m end order by s.o)
    from (select m-'departed_at'-'confirmed_at'-'reaction'-'issue'-'cooking_started_at'-'confirmed_by' m,o
     from jsonb_array_elements(y->'meals') with ordinality t(m,o)) s),'[]'))
  else y end
  order by y->>'id'),'[]')
 from jsonb_array_elements(entries)x
 cross join lateral (select (case when x->>'status' in ('preparing','out_for_delivery') then jsonb_set(x,'{status}','"scheduled"') else x end)-'canChange'-'catererPhone'-'version' y) z
$$;
revoke all on all functions in schema v1 from public,anon,authenticated;
