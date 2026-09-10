alter table v1.allocations add column if not exists refund_deducted int not null default 0;
alter table v1.refunds add column if not exists reconciliation jsonb;
create table if not exists v1.push_tickets(id text primary key,token text not null,job_id uuid references v1.outbox,checked_at timestamptz,created_at timestamptz not null default now());
alter table v1.push_tickets enable row level security;
revoke all on v1.push_tickets from public,anon,authenticated;

-- Manual financial reconciliation is an explicit admin decision with provider evidence.
create or replace function public.catera_v1_reconcile(kind text,identifier uuid,details jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r v1.refunds;c v1.checkouts;pay v1.payouts;amt int;prev v1.receipts;h text:=md5(kind||identifier::text||details::text);
begin
 if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;perform pg_advisory_xact_lock(hashtext(u::text));
 select * into prev from v1.receipts where actor_id=u and receipts.request_id=catera_v1_reconcile.request_id;if found then if prev.hash<>h then raise exception 'CONFLICT';end if;return prev.result;end if;
 if coalesce(length(details->>'reason'),0)<5 or coalesce(length(details->>'reference'),0)<3 then raise exception 'INVALID_INPUT';end if;
 if kind='refund' then
  select * into r from v1.refunds where id=identifier for update;if not found or r.state<>'succeeded' or r.reconciliation is not null then raise exception 'CONFLICT';end if;
  select * into c from v1.checkouts where id=r.checkout_id for update;amt:=(details->>'sellerDeduction')::int;
  if amt is null or amt<0 or amt>r.amount or amt>coalesce((select amount-paid_out from v1.allocations where checkout_id=c.id),0) then raise exception 'AMOUNT_INVALID';end if;
  update v1.allocations set amount=amount-amt,refund_deducted=refund_deducted+amt where checkout_id=c.id;
  update v1.refunds set reconciliation=details||jsonb_build_object('actor',u,'at',now()) where id=r.id;
  if not exists(select 1 from v1.support_cases where checkout_id=c.id and status<>'resolved') and not exists(select 1 from v1.refunds where checkout_id=c.id and state<>'failed' and reconciliation is null) then update v1.allocations set held=0 where checkout_id=c.id;else update v1.allocations set held=least(held,amount-paid_out) where checkout_id=c.id;end if;
  update v1.outbox ob set processed_at=now() where ob.kind='split.reconcile' and payload->>'refundId'=r.id::text;
 elsif kind='payout' then
  select * into pay from v1.payouts where id=identifier for update;if not found or pay.status in('succeeded','failed') then raise exception 'CONFLICT';end if;
  if details->>'status' not in('succeeded','failed') then raise exception 'INVALID_INPUT';end if;
  update v1.payouts set status=details->>'status',provider_id=details->>'reference' where id=identifier;
  if details->>'status'='failed' then update v1.allocations a set paid_out=paid_out-i.amount from v1.payout_items i where i.payout_id=identifier and a.id=i.allocation_id;end if;
  update v1.outbox set processed_at=now() where kind='payout.create' and payload->>'payoutId'=identifier::text;
 else raise exception 'INVALID_INPUT';end if;
 insert into v1.audit(actor_id,action,details) values(u,'reconcile.'||kind,details||jsonb_build_object('id',identifier,'requestId',request_id));
 insert into v1.receipts values(u,request_id,h,jsonb_build_object('id',identifier));return jsonb_build_object('id',identifier);
end $$;
revoke all on function public.catera_v1_reconcile(text,uuid,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_reconcile(text,uuid,jsonb,uuid) to authenticated;
