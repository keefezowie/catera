-- The kitchen sets off, and reported meals are held back from auto-delivery
-- (Plan 3a, customer app rebuild).
--   delivery.depart {catererId, date, meal} -> {moved}
-- Moves the caterer's scheduled or preparing meals of a service date to
-- out_for_delivery, stamps departed_at and tells each customer once. Lock order
-- matches delivery.confirm: user, pilot, delivery_days (by id), then fulfillments.

-- A notification that must be sent once: the dedupe key belongs to the outbox row,
-- and when it already exists neither the notification nor the push is written.
create function v1.notify(u uuid,k text,b text,h text,p_dedupe text) returns void
language plpgsql set search_path='' as $$
declare fresh uuid;
begin
 insert into v1.outbox(kind,payload,dedupe) values('push',jsonb_build_object('userId',u,'body',b,'href',h),p_dedupe)
  on conflict(dedupe) do nothing returning id into fresh;
 if fresh is null then return;end if;
 insert into v1.notifications(user_id,kind,body,href) values(u,k,b,h);
end $$;

-- Completes a subscription when none of its days remain open. The subscription row
-- lock serialises every closer: a confirmation and the nightly job each finishing
-- one of the last two days cannot both conclude that the other day is still open,
-- because the later one reads the earlier one's committed day after the lock.
create function v1.complete_subscription_if_done(p_subscription uuid) returns void
language plpgsql set search_path='' as $$
begin
 perform 1 from v1.subscriptions where id=p_subscription for update;
 update v1.subscriptions set status='completed'
  where id=p_subscription and status<>'completed'
   and not exists(select 1 from v1.delivery_days d where d.subscription_id=p_subscription and d.status not in ('delivered','cancelled'));
end $$;
revoke all on function v1.complete_subscription_if_done(uuid) from public, anon, authenticated;

-- Nightly rule from 20261008090000_auto_deliver_guards.sql, now per meal: a meal with an
-- open, responded or escalated report is held (the day keeps its status and earns
-- nothing yet) while the day's other meals are delivered. Auto-delivered meals say so.
-- A day with a meal locked by an in-flight command is left for the next run, like a day
-- locked by a caterer update. A report being filed locks its meal through the foreign key
-- on delivery_issues, so the job either sees the committed report or finds the day locked.
create or replace function v1.auto_deliver(p_today date) returns integer
language plpgsql security definer set search_path='' as $$
declare r record; marked integer := 0; total integer; got integer;
begin
 for r in
  select d.id, d.subscription_id from v1.delivery_days d
  where d.service_date < p_today
   and d.service_date >= (select since from v1.auto_deliver_policy)
   and d.status in ('scheduled','preparing','out_for_delivery')
  order by d.id
  for update skip locked
 loop
  -- Each day is its own subtransaction: one inconsistent day is logged and
  -- skipped instead of blocking every other caterer's earnings.
  begin
   select count(*) into total from v1.fulfillments where day_id=r.id;
   select count(*) into got from (select 1 from v1.fulfillments f where f.day_id=r.id for update skip locked) locked;
   if got<total then continue;end if;
   update v1.fulfillments f set status='delivered', confirmed_at=now(), confirmed_by='auto'
    where f.day_id=r.id and f.status in ('scheduled','preparing','out_for_delivery')
     and not exists(select 1 from v1.delivery_issues i where i.day_id=f.day_id and i.meal=f.meal and i.status in ('open','responded','escalated'));
   if exists(select 1 from v1.fulfillments f where f.day_id=r.id and f.status not in ('delivered','cancelled')) then
    -- A held meal leaves the day exactly as it is.
    if not exists(select 1 from v1.fulfillments f where f.day_id=r.id and f.status in ('scheduled','preparing','out_for_delivery')
     and exists(select 1 from v1.delivery_issues i where i.day_id=f.day_id and i.meal=f.meal and i.status in ('open','responded','escalated')))
     and exists(select 1 from v1.fulfillments f where f.day_id=r.id and f.status='issue') then
     update v1.delivery_days set status='issue', version=version+1 where id=r.id;
    end if;
    continue;
   end if;
   update v1.delivery_days set status='delivered', version=version+1 where id=r.id;
   marked := marked + 1;
   perform v1.complete_subscription_if_done(r.subscription_id);
  exception when others then
   raise warning 'AUTO_DELIVER_SKIPPED day=% sqlstate=%', r.id, sqlstate;
  end;
 end loop;
 return marked;
end $$;
revoke all on function v1.auto_deliver(date) from public, anon, authenticated;

-- Preserve the existing command's qualified receipt lookup when renaming it. The
-- renamed function is the delivery.confirm wrapper: its completion step is replaced
-- by the locking helper above, which also runs when other days still look open.
do $$ declare d text; fixed text;
begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 fixed:=regexp_replace(d,
  'if nextstatus=''delivered'' and not exists\(select 1 from v1\.delivery_days where subscription_id=s\.id and status not in \(''delivered'',''cancelled''\)\) then\s+update v1\.subscriptions set status=''completed'' where id=s\.id and status<>''completed'';\s+end if;',
  'if nextstatus=''delivered'' then perform v1.complete_subscription_if_done(s.id);end if;');
 if fixed=d then raise exception 'delivery.confirm completion step not found';end if;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_depart_base;
 execute replace(replace(fixed,'public.catera_v1_command(','public.catera_v1_command_depart_base('),
   'catera_v1_command.request_id','catera_v1_command_depart_base.request_id');
end $$;
revoke all on function public.catera_v1_command_depart_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
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
   perform v1.notify(r.user_id,'delivery',msg,'/today','depart:'||r.day_id||':'||m);
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
