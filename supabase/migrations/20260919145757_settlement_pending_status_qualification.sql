-- Preserve the existing service-role guard, grants and complete settlement behavior.
-- Qualify the polling query to avoid collision with the PL/pgSQL status variable.
do $migration$
declare definition text; updated text;
begin
 select pg_get_functiondef('public.catera_v1_system_experience_base(text,jsonb)'::regprocedure) into definition;
 updated:=replace(definition,$old$select id from v1.payouts where settlement_run_id is not null and provider_id is not null and status in('pending','pending_compliance','submitting') and (settlement_polled_at is null or settlement_polled_at<clock_timestamp()-interval '5 minutes') order by settlement_polled_at nulls first,created_at limit 20 for update skip locked$old$,$new$select pending_payout.id from v1.payouts pending_payout where pending_payout.settlement_run_id is not null and pending_payout.provider_id is not null and pending_payout.status in('pending','pending_compliance','submitting') and (pending_payout.settlement_polled_at is null or pending_payout.settlement_polled_at<clock_timestamp()-interval '5 minutes') order by pending_payout.settlement_polled_at nulls first,pending_payout.created_at limit 20 for update skip locked$new$);
 if updated=definition and position($new$select pending_payout.id from v1.payouts pending_payout where pending_payout.settlement_run_id is not null and pending_payout.provider_id is not null and pending_payout.status in('pending','pending_compliance','submitting') and (pending_payout.settlement_polled_at is null or pending_payout.settlement_polled_at<clock_timestamp()-interval '5 minutes') order by pending_payout.settlement_polled_at nulls first,pending_payout.created_at limit 20 for update skip locked$new$ in definition)=0 then
  raise exception 'Expected settlement pending query missing';
 end if;
 execute updated;
end $migration$;
