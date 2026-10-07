-- Review fixes for 20261008103000_push_timing.sql (that file stays as committed).
--  1. subscription.remindRenewal uses the key of the daily maintenance renewal reminder
--     ('renew-'||id), so whichever runs first is the only renewal push the customer gets.
--  2. Filing a delivery report deletes the unsent "has it arrived?" reminder, exactly as
--     delivery.confirm does.

create or replace function v1.remind_renewal(p_today date, p_hour integer) returns integer
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
  key:='renew-'||r.id;
  if exists(select 1 from v1.outbox where dedupe=key) then continue;end if;
  perform v1.notify(r.user_id,'renewal','Paket '||coalesce(r.name,'')||' tinggal 3 hari. Perpanjang tanpa jeda.','/renew/'||r.id,key);
  queued:=queued+1;
 end loop;
 return queued;
end $$;
revoke all on function v1.remind_renewal(date,integer) from public, anon, authenticated;

-- A narrow wrapper, only for deliveryIssue.create, rather than a rewrite of the command that
-- handles it. The report is created by the base command first. Then the meal's fulfillment row
-- is locked for update: v1.remind_due holds that row in share mode while it queues a reminder,
-- so either its reminder is committed before we look (and deleted here) or the report is already
-- visible to it (and it queues nothing). The reports of one caterer are serialised by the base
-- command's advisory lock, so the lock upgrade cannot deadlock between two reports.
-- The base is re-created under its new name so its own-name receipt lookup keeps working.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_issue_reminder_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_issue_reminder_base('),
   'catera_v1_command.request_id','catera_v1_command_issue_reminder_base.request_id');
end $$;
revoke all on function public.catera_v1_command_issue_reminder_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; did uuid; m text;
begin
 r:=public.catera_v1_command_issue_reminder_base(action,payload,request_id);
 if action='deliveryIssue.create' then
  did:=(payload->>'deliveryId')::uuid; m:=payload->>'meal';
  perform 1 from v1.fulfillments f where f.day_id=did and f.meal=m for update;
  delete from v1.outbox where dedupe='arrive:'||did||':'||m and processed_at is null;
 end if;
 return r;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;
