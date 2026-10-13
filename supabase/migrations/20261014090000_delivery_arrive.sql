-- The kitchen marks stops Sampai with a proof photo, and the customer confirms (Phase G, FB3).
--   delivery.arrive {catererId, date, meal, fulfillmentIds, photos} -> {arrived, arrivedAt}
--   delivery.autoConfirm (system) {now?}                             -> confirmed count
--   read 'delivery-proof' {deliveryId, meal}                         -> {path}
--   read 'delivery-proof-slot' {deliveryId, meal}                    -> {catererId} (staff only)
-- A fulfilment is one meal of one delivery day, so with the meal in the payload a fulfilment id is
-- the delivery day id. No new status: an arrived meal stays out_for_delivery until the customer's
-- delivery.confirm, v1.auto_confirm_arrived two hours later, or the next-morning v1.auto_deliver.

alter table v1.fulfillments
 add column arrived_at timestamptz,
 add column arrived_by uuid references v1.profiles,
 add column arrived_photo text;

-- An arrival belongs to one trip. A meal that fails (issue) or sets out again loses its mark and
-- photo, whichever command moves it, so a re-sent meal is not read as Sampai or auto-confirmed.
create function v1.fulfillment_clear_arrival() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status in ('issue','out_for_delivery') and new.status is distinct from old.status then
  new.arrived_at:=null;new.arrived_by:=null;new.arrived_photo:=null;
 end if;
 return new;
end $$;
create trigger fulfillments_clear_arrival before update of status on v1.fulfillments
 for each row execute function v1.fulfillment_clear_arrival();

-- Proof photos live in a private bucket at {catererId}/{dayId}/{meal}/{uuid}.{ext}. The API server
-- writes them with the service key; clients only ever read through a signed URL or this policy.
do $$ begin if to_regclass('storage.buckets') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('catera-v1-proof','catera-v1-proof',false,8388608,array['image/png','image/jpeg','image/webp'])
  on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
end if;end $$;

-- Only the stop's customer and that caterer's staff read a photo, and only once a meal points at it.
create function v1.can_read_proof(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id
   join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where f.arrived_photo=object_name
   and (s.user_id=(select auth.uid()) or v1.is_staff((select auth.uid()),p.caterer_id)))
$$;
revoke all on function v1.can_read_proof(text) from public, anon;
grant usage on schema v1 to authenticated;
grant execute on function v1.can_read_proof(text) to authenticated;

do $$ begin if to_regclass('storage.objects') is not null then
 execute 'drop policy if exists "Catera proof photos are read by their customer and caterer" on storage.objects';
 execute $policy$
  create policy "Catera proof photos are read by their customer and caterer"
  on storage.objects for select to authenticated
  using (bucket_id = 'catera-v1-proof' and v1.can_read_proof(name))
 $policy$;
end if;end $$;

-- Same definition as 20261009090000_kitchen_cooking.sql plus arrived_at and arrived_photo per meal.
create or replace function v1.delivery(d v1.delivery_days) returns jsonb language sql stable set search_path='' as $$
 select v1.delivery_pilot_base(d)||jsonb_build_object('meals',(select jsonb_agg(jsonb_build_object(
 'meal',f.meal,'status',f.status,'departed_at',f.departed_at,'confirmed_at',f.confirmed_at,
 'cooking_started_at',f.cooking_started_at,'confirmed_by',f.confirmed_by,
 'arrived_at',f.arrived_at,'arrived_photo',f.arrived_photo,
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

-- An arrival is not a production change either: strip both keys, as 20261009090000 does for cooking.
create or replace function v1.beta_production_signature(entries jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(
  case when jsonb_typeof(y->'meals')='array' then jsonb_set(y,'{meals}',
   coalesce((select jsonb_agg(case when s.m->>'status'='preparing' then jsonb_set(s.m,'{status}','"scheduled"') else s.m end order by s.o)
    from (select m-'departed_at'-'confirmed_at'-'reaction'-'issue'-'cooking_started_at'-'confirmed_by'-'arrived_at'-'arrived_photo' m,o
     from jsonb_array_elements(y->'meals') with ordinality t(m,o)) s),'[]'))
  else y end
  order by y->>'id'),'[]')
 from jsonb_array_elements(entries)x
 cross join lateral (select (case when x->>'status'='preparing' then jsonb_set(x,'{status}','"scheduled"') else x end)-'canChange'-'catererPhone'-'version' y) z
$$;

-- Closes arrived meals nobody answered: two hours after arrived_at (inclusive), with no open report
-- and no "Belum" (a report filed on the meal at or after its arrival, whatever its status now).
-- Locks the caterer's pilot lock, then the day, then the meal, as arrive and depart do. A report
-- takes that pilot lock first, so one in flight holds the job until it commits and is then seen.
-- A row locked by a customer's confirmation is skipped until the next run.
create function v1.auto_confirm_arrived(p_now timestamptz default now()) returns integer
language plpgsql set search_path='' as $$
declare r record; confirmed integer:=0; nextstatus text; meals text[];
begin
 for r in
  select d.id, d.subscription_id, (s.snapshot->'offer'->>'catererId')::uuid cid from v1.delivery_days d
   join v1.subscriptions s on s.id=d.subscription_id
  where d.status<>'cancelled'
   and exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.status='out_for_delivery' and f.arrived_at<=p_now-interval '2 hours')
  order by 3, d.id
 loop
  begin
   perform pg_advisory_xact_lock(hashtext('pilot:'||r.cid::text));
   perform 1 from v1.delivery_days d where d.id=r.id and d.status<>'cancelled' for update skip locked;
   if not found then continue;end if;
   select coalesce(array_agg(x.meal),'{}') into meals from (
    select f.meal from v1.fulfillments f
    where f.day_id=r.id and f.status='out_for_delivery' and f.arrived_at<=p_now-interval '2 hours'
    order by f.meal for update skip locked) x;
   -- Checked under the pilot lock: any report filed before it was taken is committed and seen here.
   with closed as (
    update v1.fulfillments f set status='delivered', confirmed_at=p_now, confirmed_by='auto'
    where f.day_id=r.id and f.meal=any(meals)
     and not exists(select 1 from v1.delivery_issues i where i.day_id=f.day_id and i.meal=f.meal
      and (i.status in ('open','responded','escalated') or i.created_at>=f.arrived_at))
    returning f.meal)
   select coalesce(array_agg(meal),'{}') into meals from closed;
   if cardinality(meals)=0 then continue;end if;
   confirmed:=confirmed+cardinality(meals);
   delete from v1.outbox o where o.processed_at is null and o.dedupe in (select 'arrive:'||r.id||':'||x from unnest(meals) x);
   -- Same derivation as delivery.confirm.
   if not exists(select 1 from v1.fulfillments where day_id=r.id and status not in ('delivered','cancelled')) then nextstatus:='delivered';
   elsif exists(select 1 from v1.fulfillments where day_id=r.id and status='issue') then nextstatus:='issue';
   elsif exists(select 1 from v1.fulfillments where day_id=r.id and status='out_for_delivery') then nextstatus:='out_for_delivery';
   elsif exists(select 1 from v1.fulfillments where day_id=r.id and status='preparing') then nextstatus:='preparing';
   else nextstatus:='scheduled';end if;
   update v1.delivery_days set status=nextstatus,version=version+1 where id=r.id and status is distinct from nextstatus;
   if nextstatus='delivered' then perform v1.complete_subscription_if_done(r.subscription_id);end if;
   insert into public.catera_v1_events(id,user_id,topic)
    select gen_random_uuid(),s.user_id,'delivery.changed' from v1.subscriptions s where s.id=r.subscription_id and s.user_id is not null;
  exception when others then
   raise warning 'AUTO_CONFIRM_SKIPPED day=% sqlstate=%', r.id, sqlstate;
  end;
 end loop;
 return confirmed;
end $$;
revoke all on function v1.auto_confirm_arrived(timestamptz) from public, anon, authenticated;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_autoconfirm_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare at timestamptz;
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='delivery.autoConfirm' then
  begin at:=coalesce((payload->>'now')::timestamptz,now());exception when others then raise exception 'INVALID_INPUT';end;
  return to_jsonb(v1.auto_confirm_arrived(at));
 end if;
 return public.catera_v1_system_autoconfirm_base(action,payload);
end $$;
revoke all on function public.catera_v1_system_autoconfirm_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;

-- The proof read: the storage path of one meal's photo, for that customer or that caterer's staff.
-- The API signs the path with the service key; the path alone opens nothing.
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_proof_base;
revoke all on function public.catera_v1_read_proof_base(text,jsonb) from public,anon,authenticated;

create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); did uuid; photo text; owner uuid; cid uuid;
begin
 if resource is distinct from 'delivery-proof' and resource is distinct from 'delivery-proof-slot' then
  return public.catera_v1_read_proof_base(resource,params);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if jsonb_typeof(params) is distinct from 'object' or jsonb_typeof(params->'deliveryId') is distinct from 'string'
  or params->>'meal' is null or params->>'meal' not in ('lunch','dinner') then raise exception 'INVALID_INPUT';end if;
 begin did:=(params->>'deliveryId')::uuid;exception when others then raise exception 'INVALID_INPUT';end;
 select s.user_id,p.caterer_id into owner,cid from v1.delivery_days d
  join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where d.id=did;
 -- 'delivery-proof-slot' {deliveryId, meal}: whether the caller's kitchen may upload a photo for
 -- that stop, asked by the upload route before it stores anything. Answers {catererId}.
 if resource='delivery-proof-slot' then
  if not found or not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
  return jsonb_build_object('catererId',cid);
 end if;
 -- A stop that does not exist answers like one that is not the caller's, so ids reveal nothing.
 if not found or (owner is distinct from u and not v1.is_staff(u,cid)) then raise exception 'FORBIDDEN';end if;
 select f.arrived_photo into photo from v1.fulfillments f where f.day_id=did and f.meal=params->>'meal';
 if photo is null then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('path',photo);
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

-- delivery.arrive. The current command body names its own receipt lookup with the function name,
-- so the base is re-created under its new name, as 20261011090000_device_unregister.sql does.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_arrive_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_arrive_base('),
   'catera_v1_command.request_id','catera_v1_command_arrive_base.request_id');
end $$;
revoke all on function public.catera_v1_command_arrive_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; dt date; m text; old v1.receipts; r record; ids uuid[]; n int; arrived int:=0;
 fingerprint text:=md5(action||payload::text); result jsonb; stamps jsonb:='{}'; uids uuid[]:='{}'; photo text; k text;
begin
 if action<>'delivery.arrive' then
  -- The workspace marks Sampai through delivery.arrive; only the customer or the system closes a meal.
  if action in ('delivery.statusBatch','delivery.status') and payload->>'status'='delivered' then raise exception 'NOT_ALLOWED';end if;
  return public.catera_v1_command_arrive_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object'
  or not(payload ?& array['catererId','date','meal','fulfillmentIds','photos'])
  or (payload - array['catererId','date','meal','fulfillmentIds','photos'])<>'{}'::jsonb
  or jsonb_typeof(payload->'catererId') is distinct from 'string' or jsonb_typeof(payload->'date') is distinct from 'string'
  or jsonb_typeof(payload->'meal') is distinct from 'string' or payload->>'meal' not in ('lunch','dinner')
  or payload->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
  or jsonb_typeof(payload->'fulfillmentIds') is distinct from 'array' or jsonb_typeof(payload->'photos') is distinct from 'object'
  or jsonb_array_length(payload->'fulfillmentIds') not between 1 and 500
  or exists(select 1 from jsonb_array_elements(payload->'fulfillmentIds') x where jsonb_typeof(x) is distinct from 'string')
  then raise exception 'INVALID_INPUT';end if;
 begin
  cid:=(payload->>'catererId')::uuid;dt:=(payload->>'date')::date;
  select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(payload->'fulfillmentIds') x;
 exception when others then raise exception 'INVALID_INPUT';end;
 m:=payload->>'meal';
 if (select count(distinct x) from unnest(ids) x)<>cardinality(ids) then raise exception 'INVALID_INPUT';end if;
 -- One photo per stop, no others, each in this caterer's folder for that stop and meal.
 if (select count(*) from jsonb_object_keys(payload->'photos'))<>cardinality(ids) then raise exception 'INVALID_INPUT';end if;
 for k in select jsonb_object_keys(payload->'photos') loop
  begin if k is distinct from k::uuid::text or not (k::uuid = any(ids)) then raise exception 'INVALID_INPUT';end if;
  exception when invalid_text_representation then raise exception 'INVALID_INPUT';end;
  if jsonb_typeof(payload->'photos'->k) is distinct from 'string'
   or payload->'photos'->>k !~ ('^'||cid||'/'||k::uuid||'/'||m||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$')
   then raise exception 'INVALID_INPUT';end if;
 end loop;
 if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 if dt is distinct from (now() at time zone 'Asia/Jakarta')::date then raise exception 'INVALID_DATE';end if;
 perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
 -- Days first, in id order, then the meals: the order delivery.confirm, depart and the jobs use.
 -- Only this caterer's days of that date are locked; an id outside them is never touched.
 perform d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where d.id=any(ids) and p.caterer_id=cid and d.service_date=dt and d.status<>'cancelled'
  order by d.id for update of d;
 get diagnostics n=row_count;
 if n<>cardinality(ids) then raise exception 'NOT_FOUND';end if;
 for r in
  select f.day_id,f.status,f.arrived_at,s.user_id from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id
   join v1.subscriptions s on s.id=d.subscription_id
  where f.day_id=any(ids) and f.meal=m
  order by f.day_id for update of f
 loop
  n:=n-1;
  if r.arrived_at is not null then
   -- Already marked: the stored time stands and nothing is written.
   stamps:=stamps||jsonb_build_object(r.day_id::text,r.arrived_at);
  elsif r.status='delivered' then
   -- The customer confirmed before the kitchen tapped Sampai: nothing to mark.
   stamps:=stamps||jsonb_build_object(r.day_id::text,null);
  elsif r.status<>'out_for_delivery' then
   raise exception 'INVALID_STATE';
  else
   photo:=payload->'photos'->>r.day_id::text;
   update v1.fulfillments set arrived_at=now(),arrived_by=u,arrived_photo=photo where day_id=r.day_id and meal=m;
   stamps:=stamps||jsonb_build_object(r.day_id::text,now());
   arrived:=arrived+1;
   if r.user_id is not null then
    perform v1.notify(r.user_id,'delivery','Pesananmu sudah diantar. Sudah diterima?','/today',
     'arrived:'||r.user_id||':'||cid||':'||dt||':'||m);
    uids:=uids||r.user_id;
   end if;
  end if;
 end loop;
 -- A day of that caterer and date without this meal.
 if n<>0 then raise exception 'NOT_FOUND';end if;
 insert into public.catera_v1_events(id,user_id,topic) select gen_random_uuid(),x,'delivery.changed' from (select distinct unnest(uids) x) w;
 result:=jsonb_build_object('arrived',arrived,'arrivedAt',stamps);
 if arrived>0 then
  insert into v1.audit(actor_id,action,details) values(u,action,payload||jsonb_build_object('arrived',arrived,'requestId',request_id));
 end if;
 insert into v1.receipts(actor_id,request_id,hash,result) values(u,request_id,fingerprint,result);
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;
grant execute on function v1.can_read_proof(text) to authenticated;
