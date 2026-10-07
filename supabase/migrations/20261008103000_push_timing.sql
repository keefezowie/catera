-- Timed arrival and renewal pushes, and a push-only claim (Plan 3a, customer app rebuild).
--   delivery.remindDue        {now}         -> {queued}   an hour after a meal's window, once, unless answered
--   subscription.remindRenewal {today,hour} -> {queued}   three days left, once, from 09.00 Jakarta
--   outbox.claimPush          {limit}       -> [job]      due push jobs only, leased for five minutes
-- All three are service_role system actions. Time is always an input, so a run is repeatable:
-- the Jakarta day is derived from the given instant and the database clock is not read.
-- v1.notify(u,k,b,h,dedupe) comes from 20261008102000_delivery_depart.sql.

-- Queues "has it arrived?" for every meal of the Jakarta day of p_now that is still on
-- its way, has no open report and whose window ended at least an hour before p_now.
-- Locks each meal row in share mode: delivery.confirm takes it for update and then
-- deletes the unsent reminder, so a reminder is either queued before the confirmation
-- (and deleted by it) or the meal is already delivered (and not queued). A meal being
-- confirmed right now is skipped and looked at again on the next run.
create function v1.remind_due(p_now timestamptz) returns integer
language plpgsql set search_path='' as $$
declare r record; queued integer:=0; today date:=(p_now at time zone 'Asia/Jakarta')::date; key text;
begin
 for r in
  select d.id day_id, f.meal, s.user_id
  from v1.fulfillments f
  join v1.delivery_days d on d.id=f.day_id
  join v1.subscriptions s on s.id=d.subscription_id
  where d.service_date=today and d.status<>'cancelled'
   and f.status in ('scheduled','preparing','out_for_delivery')
   and s.user_id is not null
   and not exists(select 1 from v1.delivery_issues i where i.day_id=f.day_id and i.meal=f.meal and i.status in ('open','responded','escalated'))
   and upper(v1.window_bounds(s.snapshot->'offer',f.meal,d.service_date))+interval '60 minutes'<=p_now
  order by d.id, f.meal
  for share of f skip locked
 loop
  key:='arrive:'||r.day_id||':'||r.meal;
  if exists(select 1 from v1.outbox where dedupe=key) then continue;end if;
  perform v1.notify(r.user_id,'delivery','Makanan hari ini sudah sampai? Tandai di Catera.','/today',key);
  queued:=queued+1;
 end loop;
 return queued;
end $$;
revoke all on function v1.remind_due(timestamptz) from public, anon, authenticated;

-- Tells the customer once when exactly three delivery days of an active package are left.
-- Not before the package has started, not when it was already renewed, not before 09.00.
create function v1.remind_renewal(p_today date, p_hour integer) returns integer
language plpgsql set search_path='' as $$
declare r record; queued integer:=0; key text;
begin
 if p_hour<9 then return 0;end if;
 for r in
  select s.id, s.user_id, s.snapshot->'offer'->>'name' as name
  from v1.subscriptions s
  where s.status='active' and s.user_id is not null and s.starts_on<=p_today
   and (select count(*) from v1.delivery_days d where d.subscription_id=s.id and d.status not in ('delivered','cancelled'))=3
   and not exists(select 1 from v1.subscriptions nx where nx.renewed_from=s.id and nx.status<>'cancelled')
  order by s.id
 loop
  key:='renew3:'||r.id;
  if exists(select 1 from v1.outbox where dedupe=key) then continue;end if;
  perform v1.notify(r.user_id,'renewal','Paket '||coalesce(r.name,'')||' tinggal 3 hari. Perpanjang tanpa jeda.','/renew/'||r.id,key);
  queued:=queued+1;
 end loop;
 return queued;
end $$;
revoke all on function v1.remind_renewal(date,integer) from public, anon, authenticated;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_push_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; lim integer; ts timestamptz; dt date; hr integer;
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='delivery.remindDue' then
  begin ts:=(payload->>'now')::timestamptz;exception when others then raise exception 'INVALID_INPUT';end;
  if ts is null then raise exception 'INVALID_INPUT';end if;
  return jsonb_build_object('queued',v1.remind_due(ts));
 end if;
 if action='subscription.remindRenewal' then
  begin dt:=(payload->>'today')::date;hr:=(payload->>'hour')::integer;exception when others then raise exception 'INVALID_INPUT';end;
  if dt is null or hr is null or hr not between 0 and 23 or jsonb_typeof(payload->'hour') is distinct from 'number' then raise exception 'INVALID_INPUT';end if;
  return jsonb_build_object('queued',v1.remind_renewal(dt,hr));
 end if;
 if action='outbox.claimPush' then
  begin lim:=(payload->>'limit')::integer;exception when others then raise exception 'INVALID_INPUT';end;
  if lim is null or lim not between 1 and 200 then raise exception 'INVALID_INPUT';end if;
  with jobs as(select id from v1.outbox where kind='push' and processed_at is null and available_at<=clock_timestamp() order by available_at,id for update skip locked limit lim),
   claimed as(update v1.outbox set attempts=attempts+1,available_at=clock_timestamp()+interval '5 minutes' where id in(select id from jobs) returning *)
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id),'[]') into r from claimed;
  return r;
 end if;
 -- Push jobs belong to outbox.claimPush: the generic claim no longer leases them.
 if action='outbox.claim' then
  with jobs as(select id from v1.outbox where kind<>'push' and processed_at is null and available_at<=clock_timestamp() order by available_at for update skip locked limit 20),
   claimed as(update v1.outbox set attempts=attempts+1,available_at=clock_timestamp()+interval '5 minutes' where id in(select id from jobs) returning *)
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into r from claimed;
  return r;
 end if;
 return public.catera_v1_system_push_base(action,payload);
end $$;
revoke all on function public.catera_v1_system_push_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
revoke all on all functions in schema v1 from public,anon,authenticated;
