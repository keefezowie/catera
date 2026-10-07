-- Auto-deliver guards (final review of the caterer app, Oct 8 2026).
-- 1. Only days on or after the date the rule was switched on: the pilot's older
--    days were never run under "silence means delivered" and stay as they are.
-- 2. Never a day the customer reported (open, responded or escalated
--    delivery_issues): it waits until the report is resolved.
create table v1.auto_deliver_policy(
 id boolean primary key default true check(id),
 since date not null
);
insert into v1.auto_deliver_policy(since) values ((now() at time zone 'Asia/Jakarta')::date);
revoke all on v1.auto_deliver_policy from public, anon, authenticated;

create or replace function v1.auto_deliver(p_today date) returns integer
language plpgsql security definer set search_path='' as $$
declare r record; marked integer := 0;
begin
 for r in
  select d.id, d.subscription_id from v1.delivery_days d
  where d.service_date < p_today
   and d.service_date >= (select since from v1.auto_deliver_policy)
   and d.status in ('scheduled','preparing','out_for_delivery')
   and not exists(select 1 from v1.delivery_issues i where i.day_id=d.id and i.status in ('open','responded','escalated'))
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
