-- Departure only on the Jakarta day itself, one push per customer (review of 20261008102000).
-- delivery.depart refuses any other date with INVALID_DATE, and the push is deduped per
-- customer, caterer, date and meal: a customer with two packages of one caterer is told once.
-- Same wrapper as 20261008102000_delivery_depart.sql with those two changes.
create or replace function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; dt date; m text; old v1.receipts; r record; moved int:=0;
 fingerprint text:=md5(action||payload::text); result jsonb; cname text; msg text;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action<>'delivery.depart' then
  return public.catera_v1_command_depart_base(action,payload,request_id);
 end if;
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
 -- Only the Jakarta day itself: a departure on a future day would freeze the customer's changes to it.
 if dt is distinct from (now() at time zone 'Asia/Jakarta')::date then raise exception 'INVALID_DATE';end if;
 perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
 select name into cname from v1.caterers where id=cid;
 msg:=case m when 'lunch' then 'Makan siangmu sedang diantar dari ' else 'Makan malammu sedang diantar dari ' end||coalesce(cname,'dapur');
 -- Days first, in id order, then the meals: the order delivery.confirm and the nightly job use.
 perform d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where p.caterer_id=cid and d.service_date=dt and d.status<>'cancelled'
   and exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal=m)
  order by d.id for update of d;
 for r in
  select f.day_id,s.user_id,d.status day_status from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id
   join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where p.caterer_id=cid and d.service_date=dt and d.status<>'cancelled' and f.meal=m and f.status in ('scheduled','preparing')
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

