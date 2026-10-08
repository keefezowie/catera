-- A delivery problem can only be reported for a day that has come (walkthrough C-01).
-- deliveryIssue.create raises NOT_ALLOWED when the delivery's service date is after today in
-- Asia/Jakarta. The check runs only for the customer who owns the day, so another account still
-- gets the base command's FORBIDDEN and learns nothing about the day. A retried request whose
-- receipt is already stored goes to the base unchanged and replays its result.
-- A narrow wrapper over the command chain, as 20261008111000_push_report_renewal_dedupe.sql does:
-- that wrapper (which deletes the unsent "has it arrived?" reminder) stays the base and still runs
-- for every accepted report.

alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_issue_date_base;
revoke all on function public.catera_v1_command_issue_date_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); did text:=payload->>'deliveryId';
begin
 if action='deliveryIssue.create' and u is not null
  and did ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists(select 1 from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id)
  and exists(
   select 1 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id
   where d.id=did::uuid and s.user_id=u and d.service_date>(now() at time zone 'Asia/Jakarta')::date
  ) then
  raise exception 'NOT_ALLOWED';
 end if;
 return public.catera_v1_command_issue_date_base(action,payload,request_id);
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;
