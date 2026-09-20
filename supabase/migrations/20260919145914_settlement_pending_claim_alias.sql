-- Avoid the local payout record variable p in the polling claim.
do $migration$
declare definition text; updated text;
begin
 select pg_get_functiondef('public.catera_v1_system_experience_base(text,jsonb)'::regprocedure) into definition;
 updated:=replace(definition,$old$update v1.payouts p set settlement_polled_at=clock_timestamp() from candidates c where p.id=c.id returning p.id,p.provider_id,p.recipient_request$old$,$new$update v1.payouts claimed_payout set settlement_polled_at=clock_timestamp() from candidates c where claimed_payout.id=c.id returning claimed_payout.id,claimed_payout.provider_id,claimed_payout.recipient_request$new$);
 if updated=definition and position($new$update v1.payouts claimed_payout set settlement_polled_at=clock_timestamp() from candidates c where claimed_payout.id=c.id returning claimed_payout.id,claimed_payout.provider_id,claimed_payout.recipient_request$new$ in definition)=0 then raise exception 'Expected payout claim missing';end if;
 execute updated;
end $migration$;
