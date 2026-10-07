-- Deliveries count as done unless reported (caterer simplification, Oct 7 2026).
-- Past days still scheduled, preparing or on the way become delivered, which
-- recognises their earning through the existing delivery-day trigger.
-- Mirrors the day-status derivation in delivery.status; reported problems and
-- cancelled days are never touched. Locked days are skipped and picked up by
-- the next run, so a concurrent caterer update always wins.
create or replace function v1.auto_deliver(p_today date) returns integer
language plpgsql security definer set search_path='' as $$
declare r record; marked integer := 0;
begin
 for r in
  select d.id, d.subscription_id from v1.delivery_days d
  where d.service_date < p_today and d.status in ('scheduled','preparing','out_for_delivery')
  order by d.id
  for update skip locked
 loop
  -- Each day is its own subtransaction: one inconsistent day is logged and
  -- skipped instead of blocking every other caterer's earnings.
  begin
   update v1.fulfillments set status='delivered'
    where day_id=r.id and status in ('scheduled','preparing','out_for_delivery');
   if exists(select 1 from v1.fulfillments where day_id=r.id and status not in ('delivered','cancelled')) then
    if exists(select 1 from v1.fulfillments where day_id=r.id and status='issue') then
     update v1.delivery_days set status='issue', version=version+1 where id=r.id;
    end if;
    continue;
   end if;
   update v1.delivery_days set status='delivered', version=version+1 where id=r.id;
   marked := marked + 1;
   if not exists(select 1 from v1.delivery_days where subscription_id=r.subscription_id and status not in ('delivered','cancelled')) then
    update v1.subscriptions set status='completed' where id=r.subscription_id and status<>'completed';
   end if;
  exception when others then
   raise warning 'AUTO_DELIVER_SKIPPED day=% sqlstate=%', r.id, sqlstate;
  end;
 end loop;
 return marked;
end $$;
revoke all on function v1.auto_deliver(date) from public, anon, authenticated;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_autodeliver_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='delivery.autoDeliver' then
  if payload->>'today' is null then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtext('caterer:auto-deliver'));
  return to_jsonb(v1.auto_deliver((payload->>'today')::date));
 end if;
 return public.catera_v1_system_autodeliver_base(action,payload);
end $$;
revoke all on function public.catera_v1_system_autodeliver_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
