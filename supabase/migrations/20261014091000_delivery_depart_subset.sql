-- delivery.depart takes an optional subset of stops (Phase G, FB11).
--   delivery.depart {catererId, date, meal, fulfillmentIds?} -> {moved}
-- Without fulfillmentIds the command is the one of 20261008102500_depart_today_one_push.sql,
-- unchanged. With them, only those stops leave: every id must be a day of that caterer and date,
-- not cancelled, that serves the meal, else NOT_FOUND and nothing moves. Stops already on their way
-- are left as they are. The push keeps its dedupe per customer, caterer, date and meal, so a later
-- subset of the same customer's other package tells them nothing new.
-- The current command body names its own receipt lookup with the function name, so the base is
-- re-created under its new name, as 20261014090000_delivery_arrive.sql does.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_subset_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_subset_base('),
   'catera_v1_command.request_id','catera_v1_command_subset_base.request_id');
end $$;
revoke all on function public.catera_v1_command_subset_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; dt date; m text; old v1.receipts; r record; moved int:=0; ids uuid[]; n int;
 fingerprint text:=md5(action||payload::text); result jsonb; cname text; msg text;
begin
 if action<>'delivery.depart' or jsonb_typeof(payload) is distinct from 'object' or not payload ? 'fulfillmentIds' then
  return public.catera_v1_command_subset_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if request_id is null
  or not(payload ?& array['catererId','date','meal']) or (payload - array['catererId','date','meal','fulfillmentIds'])<>'{}'::jsonb
  or jsonb_typeof(payload->'catererId') is distinct from 'string' or jsonb_typeof(payload->'date') is distinct from 'string'
  or jsonb_typeof(payload->'meal') is distinct from 'string' or payload->>'meal' not in ('lunch','dinner')
  or payload->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
  or jsonb_typeof(payload->'fulfillmentIds') is distinct from 'array'
  or jsonb_array_length(payload->'fulfillmentIds') not between 1 and 500
  or exists(select 1 from jsonb_array_elements(payload->'fulfillmentIds') x where jsonb_typeof(x) is distinct from 'string')
  then raise exception 'INVALID_INPUT';end if;
 begin
  cid:=(payload->>'catererId')::uuid;dt:=(payload->>'date')::date;
  select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(payload->'fulfillmentIds') x;
 exception when others then raise exception 'INVALID_INPUT';end;
 if (select count(distinct x) from unnest(ids) x)<>cardinality(ids) then raise exception 'INVALID_INPUT';end if;
 m:=payload->>'meal';
 if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 if dt is distinct from (now() at time zone 'Asia/Jakarta')::date then raise exception 'INVALID_DATE';end if;
 perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
 select name into cname from v1.caterers where id=cid;
 msg:=case m when 'lunch' then 'Makan siangmu sedang diantar dari ' else 'Makan malammu sedang diantar dari ' end||coalesce(cname,'dapur');
 -- Days first, in id order, then the meals. Only the listed days of this caterer and date are locked.
 perform d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where d.id=any(ids) and p.caterer_id=cid and d.service_date=dt and d.status<>'cancelled'
   and exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal=m and f.status<>'cancelled')
  order by d.id for update of d;
 get diagnostics n=row_count;
 if n<>cardinality(ids) then raise exception 'NOT_FOUND';end if;
 for r in
  select f.day_id,s.user_id,d.status day_status from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id
   join v1.subscriptions s on s.id=d.subscription_id
  where f.day_id=any(ids) and f.meal=m and f.status in ('scheduled','preparing')
  order by f.day_id for update of f
 loop
  update v1.fulfillments set status='out_for_delivery',departed_at=now() where day_id=r.day_id and meal=m;
  moved:=moved+1;
  if r.day_status in ('scheduled','preparing') then
   update v1.delivery_days set status='out_for_delivery',version=version+1 where id=r.day_id;
  end if;
  if r.user_id is not null then
   perform v1.notify(r.user_id,'delivery',msg,'/today','depart:'||r.user_id||':'||cid||':'||dt||':'||m);
   insert into public.catera_v1_events(id,user_id,topic) values(gen_random_uuid(),r.user_id,'delivery.changed');
  end if;
 end loop;
 result:=jsonb_build_object('moved',moved);
 insert into v1.audit(actor_id,action,details) values(u,action,payload||jsonb_build_object('moved',moved,'requestId',request_id));
 insert into v1.receipts(actor_id,request_id,hash,result) values(u,request_id,fingerprint,result);
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;
grant execute on function v1.can_read_proof(text) to authenticated;
