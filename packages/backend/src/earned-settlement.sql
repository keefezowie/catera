-- Delivery-earned settlement is additive. Historical allocations are never re-credited.
create table v1.settlement_day_allocations(day_id uuid primary key references v1.delivery_days,allocation_id uuid not null references v1.allocations,ordinal int not null,amount int not null check(amount>=0),unique(allocation_id,ordinal));
create table v1.settlement_entries(id uuid primary key default gen_random_uuid(),caterer_id uuid not null references v1.caterers,allocation_id uuid references v1.allocations,day_id uuid references v1.delivery_days,kind text not null check(kind in('earned','entitlement_reduction','refund_debit','recovery','debt_offset')),amount bigint not null,source text not null unique,created_at timestamptz not null default clock_timestamp(),actor_id uuid,details jsonb not null default '{}');
create unique index settlement_one_credit on v1.settlement_entries(day_id) where kind='earned';
create index settlement_seller_entries on v1.settlement_entries(caterer_id,created_at);
create table v1.settlement_policies(id uuid primary key default gen_random_uuid(),caterer_id uuid not null references v1.caterers,enabled boolean not null,synthetic boolean not null,effective_at timestamptz not null default now(),created_at timestamptz not null default now(),actor_id uuid not null references v1.profiles,reason text not null check(length(reason)>=5));
alter table v1.settlement_policies add column minimum_amount int not null default 1 check(minimum_amount>0);
alter table v1.settlement_policies add column maximum_amount int not null default 2147483647 check(maximum_amount>=minimum_amount);
create table v1.settlement_runs(id uuid primary key default gen_random_uuid(),caterer_id uuid not null references v1.caterers,policy_id uuid not null references v1.settlement_policies,cutoff_at timestamptz not null,created_at timestamptz not null default now(),unique(caterer_id,cutoff_at));
alter table v1.payouts add column settlement_run_id uuid references v1.settlement_runs;
alter table v1.payouts add column recipient_request jsonb;
alter table v1.payouts add column provider_updated_at timestamptz;
alter table v1.payouts add column failure_code text;
alter table v1.payouts add column settlement_polled_at timestamptz;
create table v1.settlement_payout_items(payout_id uuid references v1.payouts,allocation_id uuid references v1.allocations,amount int not null check(amount>0),primary key(payout_id,allocation_id));
create table v1.payout_events(event_key text primary key,payout_id uuid not null references v1.payouts,fingerprint text not null,status text not null,created_at timestamptz not null default now());
do $$ declare t text;begin
 foreach t in array array['settlement_day_allocations','settlement_entries','settlement_policies','settlement_runs','settlement_payout_items','payout_events'] loop
 execute format('alter table v1.%I enable row level security',t);execute format('revoke all on v1.%I from public,anon,authenticated',t);
 end loop;
 foreach t in array array['settlement_day_allocations','settlement_entries','settlement_policies','settlement_runs','settlement_payout_items','payout_events'] loop
 execute format('create trigger %I before update or delete on v1.%I for each row execute function v1.immutable()',t||'_immutable',t);
 end loop;
end $$;

create function v1.settlement_policy(cid uuid) returns v1.settlement_policies language sql stable set search_path='' as $$ select p from v1.settlement_policies p where caterer_id=cid and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1 $$;
alter function v1.quote(uuid,jsonb) rename to quote_settlement_base;
create function v1.quote(u uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$ declare q jsonb;p v1.settlement_policies;begin
 q:=v1.quote_settlement_base(u,a);p:=v1.settlement_policy((q->'offer'->>'catererId')::uuid);
 if coalesce(current_setting('catera.demo',true),'false')<>'true' and (p.id is null or p.synthetic) then raise exception 'SETTLEMENT_NOT_CONFIGURED';end if;
 return q||jsonb_build_object('settlementPolicy',case when p.id is null then jsonb_build_object('synthetic',true,'schedule','weekly_monday_0900_Asia_Jakarta') else jsonb_build_object('id',p.id,'synthetic',p.synthetic,'schedule','weekly_monday_0900_Asia_Jakarta') end);
end $$;
create function v1.settlement_cutoff(at_time timestamptz) returns timestamptz language sql immutable set search_path='' as $$
 select case when at_time<((date_trunc('week',at_time at time zone 'Asia/Jakarta')+interval '9 hours') at time zone 'Asia/Jakarta') then ((date_trunc('week',at_time at time zone 'Asia/Jakarta')-interval '7 days'+interval '9 hours') at time zone 'Asia/Jakarta') else ((date_trunc('week',at_time at time zone 'Asia/Jakarta')+interval '9 hours') at time zone 'Asia/Jakarta') end
$$;
create function v1.settlement_earned(aid uuid,until_time timestamptz default 'infinity') returns bigint language sql stable set search_path='' as $$ select coalesce(sum(amount),0)::bigint from v1.settlement_entries where allocation_id=aid and kind in('earned','refund_debit','recovery','debt_offset') and (created_at<until_time or (kind='debt_offset' and (details->>'cutoff')::timestamptz<=until_time)) $$;
create function v1.settlement_used(aid uuid) returns bigint language sql stable set search_path='' as $$ select coalesce(sum(i.amount),0)::bigint from v1.settlement_payout_items i join v1.payouts p on p.id=i.payout_id where i.allocation_id=aid and p.status not in('failed','rejected','reversed','cancelled') $$;
create function v1.settlement_held(aid uuid) returns bigint language sql stable set search_path='' as $$
 select case when a.held>0 or exists(select 1 from v1.support_cases s where s.checkout_id=a.checkout_id and s.status<>'resolved') or exists(select 1 from v1.refunds r where r.checkout_id=a.checkout_id and r.state<>'failed' and r.reconciliation is null) then greatest(0,v1.settlement_earned(a.id)-v1.settlement_used(a.id)) else 0 end from v1.allocations a where a.id=aid
$$;
create function v1.settlement_allocation_guard() returns trigger language plpgsql set search_path='' as $$ declare q jsonb;begin
 select quote into q from v1.checkouts where id=new.checkout_id;
 if q->>'settlementModel'='delivery_earned_v1' then new.amount:=(q->>'sellerNet')::int;end if;return new;
end $$;
create trigger settlement_allocation_amount before insert on v1.allocations for each row execute function v1.settlement_allocation_guard();
alter function v1.activate(uuid) rename to activate_settlement_base;
create function v1.activate(cid uuid) returns uuid language plpgsql set search_path='' as $$ declare sid uuid;c v1.checkouts;a v1.allocations;n int;begin
 sid:=v1.activate_settlement_base(cid);if sid is null then return null;end if;
 select * into c from v1.checkouts where id=cid;
 if c.quote->>'settlementModel'='delivery_earned_v1' then
  select * into a from v1.allocations where checkout_id=cid;n:=jsonb_array_length(c.quote->'dates');
  insert into v1.settlement_day_allocations(day_id,allocation_id,ordinal,amount)
  select d.id,a.id,x.ord::int,(a.amount/n)+case when x.ord<=a.amount%n then 1 else 0 end from jsonb_array_elements_text(c.quote->'dates') with ordinality x(dt,ord) join v1.delivery_days d on d.subscription_id=sid and d.service_date=x.dt::date on conflict do nothing;
 end if;return sid;
end $$;
create function v1.recognize_delivery_earning() returns trigger language plpgsql set search_path='' as $$ declare a v1.allocations;da v1.settlement_day_allocations;amt bigint;begin
 if new.status='delivered' and old.status is distinct from 'delivered' then
  select * into da from v1.settlement_day_allocations where day_id=new.id;if not found then return new;end if;
  select * into a from v1.allocations where id=da.allocation_id;
  if exists(select 1 from v1.fulfillments where day_id=new.id and status<>'delivered') then raise exception 'INVALID_STATE';end if;
  amt:=da.amount+coalesce((select sum(amount) from v1.settlement_entries where day_id=new.id and kind='entitlement_reduction'),0);
  insert into v1.settlement_entries(caterer_id,allocation_id,day_id,kind,amount,source,actor_id) values(a.caterer_id,a.id,new.id,'earned',amt,'delivery:'||new.id,auth.uid()) on conflict(source) do nothing;
 end if;return new;
end $$;
create trigger recognize_delivery_earning after update of status on v1.delivery_days for each row execute function v1.recognize_delivery_earning();

create function v1.settlement_state(cid uuid) returns jsonb language plpgsql stable set search_path='' as $$ declare earned bigint;held bigint;reserved bigint;paid bigint;expected bigint;available bigint;pol v1.settlement_policies;begin
 select coalesce(sum(v1.settlement_earned(a.id)),0),coalesce(sum(v1.settlement_held(a.id)),0) into earned,held from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=cid and c.quote->>'settlementModel'='delivery_earned_v1';
 select coalesce(sum(i.amount) filter(where p.status='succeeded'),0),coalesce(sum(i.amount) filter(where p.status not in('succeeded','failed','rejected','reversed','cancelled')),0) into paid,reserved from v1.settlement_payout_items i join v1.payouts p on p.id=i.payout_id where p.caterer_id=cid;
 select coalesce(sum(d.amount+coalesce((select sum(e.amount) from v1.settlement_entries e where e.day_id=d.day_id and e.kind='entitlement_reduction'),0)),0) into expected from v1.settlement_day_allocations d join v1.allocations a on a.id=d.allocation_id join v1.delivery_days dd on dd.id=d.day_id where a.caterer_id=cid and dd.status<>'cancelled' and not exists(select 1 from v1.settlement_entries e where e.day_id=d.day_id and e.kind='earned');
 pol:=v1.settlement_policy(cid);available:=earned-held-reserved-paid;
 return jsonb_build_object('expected',expected::text,'earned',earned::text,'held',held::text,'reserved',reserved::text,'paid',paid::text,'available',greatest(0,available)::text,'recovery',greatest(0,paid+reserved-earned)::text,'nextPayoutAt',v1.settlement_cutoff(statement_timestamp())+interval '7 days','policy',case when pol.id is null then null else jsonb_build_object('id',pol.id,'enabled',pol.enabled,'synthetic',pol.synthetic,'minimumAmount',pol.minimum_amount,'maximumAmount',pol.maximum_amount) end,
 'entries',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('amount',x.amount::text)) from (select id,allocation_id,day_id,kind,amount,created_at from v1.settlement_entries where caterer_id=cid order by created_at desc,id limit 100)x),'[]'),
 'payouts',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,amount,status,created_at from v1.payouts where caterer_id=cid and settlement_run_id is not null order by created_at desc limit 100)x),'[]'));
end $$;

create function v1.plan_settlement(cid uuid) returns jsonb language plpgsql set search_path='' as $$
declare pol v1.settlement_policies;runid uuid;cut timestamptz:=v1.settlement_cutoff(statement_timestamp());pid uuid;amt bigint;total bigint;budget bigint;rowdata record;debt bigint;payable bigint;debtor record;creditor record;offset_amount bigint;begin
 perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
 pol:=v1.settlement_policy(cid);
 if pol.id is null or not pol.enabled or (pol.synthetic and coalesce(current_setting('catera.demo',true),'false')<>'true') then return jsonb_build_object('blocked','policy');end if;
 if not (select automatic_payouts from v1.purchase_features where id) then return jsonb_build_object('blocked','dispatch_disabled');end if;
 insert into v1.settlement_runs(caterer_id,policy_id,cutoff_at) values(cid,pol.id,cut) on conflict do nothing returning id into runid;
 if runid is null then return jsonb_build_object('duplicate',true);end if;
 -- Record balanced offsets so a recovered debt cannot be deducted again next week.
 for debtor in select a.id,greatest(0,v1.settlement_used(a.id)-v1.settlement_earned(a.id,cut)) owed from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=cid and c.quote->>'settlementModel'='delivery_earned_v1' order by a.id loop
  debt:=debtor.owed;
  for creditor in select a.id,greatest(0,v1.settlement_earned(a.id,cut)-v1.settlement_used(a.id)-v1.settlement_held(a.id)) available from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=cid and a.id<>debtor.id and c.quote->>'settlementModel'='delivery_earned_v1' order by a.id loop
   exit when debt=0;offset_amount:=least(debt,creditor.available);
   if offset_amount>0 then
    insert into v1.settlement_entries(caterer_id,allocation_id,kind,amount,source,details) values
     (cid,debtor.id,'debt_offset',offset_amount,'offset:'||runid||':'||debtor.id||':'||creditor.id||':credit',jsonb_build_object('cutoff',cut,'runId',runid,'counterparty',creditor.id)),
     (cid,creditor.id,'debt_offset',-offset_amount,'offset:'||runid||':'||debtor.id||':'||creditor.id||':debit',jsonb_build_object('cutoff',cut,'runId',runid,'counterparty',debtor.id));
    debt:=debt-offset_amount;
   end if;
  end loop;
 end loop;
 -- Seller-wide debt offsets positive allocations; held purchases never become sources.
 select coalesce(sum(least(0,v1.settlement_earned(a.id,cut)-v1.settlement_used(a.id))),0)*-1 into debt from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=cid and c.quote->>'settlementModel'='delivery_earned_v1';
 select greatest(0,coalesce(sum(greatest(0,v1.settlement_earned(a.id,cut)-v1.settlement_used(a.id)-v1.settlement_held(a.id))),0)-debt) into payable from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=cid and c.quote->>'settlementModel'='delivery_earned_v1';
 if payable<pol.minimum_amount then return jsonb_build_object('id',runid,'blocked','below_minimum');end if;
 if payable%pol.maximum_amount between 1 and pol.minimum_amount-1 then payable:=payable-(payable%pol.maximum_amount);end if;
 total:=0;pid:=null;budget:=2147483647;
 for rowdata in select a.id, greatest(0,v1.settlement_earned(a.id,cut)-v1.settlement_used(a.id)-v1.settlement_held(a.id)) amt from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=cid and c.quote->>'settlementModel'='delivery_earned_v1' order by a.id loop
  amt:=rowdata.amt;
  if debt>0 then debt:=debt-amt;if debt>=0 then continue;else amt:=-debt;debt:=0;end if;end if;
  amt:=least(amt,payable);exit when payable=0;
  while amt>0 loop
   if pid is null then insert into v1.payouts(caterer_id,amount,settlement_run_id) values(cid,1,runid) returning id into pid;total:=0;end if;
   budget:=least(amt,pol.maximum_amount-total);
   insert into v1.settlement_payout_items values(pid,rowdata.id,budget::int) on conflict(payout_id,allocation_id) do nothing;
   insert into v1.payout_items values(pid,rowdata.id,budget::int);
   total:=total+budget;amt:=amt-budget;payable:=payable-budget;
   update v1.payouts set amount=total::int where id=pid;
   if total=pol.maximum_amount then insert into v1.outbox(kind,payload,dedupe) values('payout.create',jsonb_build_object('payoutId',pid),'settlement:'||pid);pid:=null;end if;
  end loop;
 end loop;
 if pid is not null then insert into v1.outbox(kind,payload,dedupe) values('payout.create',jsonb_build_object('payoutId',pid),'settlement:'||pid);end if;
 insert into v1.audit(action,details) values('settlement.run',jsonb_build_object('id',runid,'catererId',cid,'cutoff',cut));return jsonb_build_object('id',runid);
end $$;

-- Public reads reuse existing authorization and transport.
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_settlement_base;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$ declare cid uuid:=(params->>'id')::uuid;begin
 if resource='settlement-controls' then
  if not v1.is_admin(auth.uid()) then raise exception 'FORBIDDEN';end if;return (select jsonb_build_object('multiCycle',multi_cycle,'automaticPayouts',automatic_payouts) from v1.purchase_features where id);
 end if;
 if resource='seller-settlement' then
  if auth.uid() is null or not(v1.is_admin(auth.uid()) or v1.is_staff(auth.uid(),cid,true)) then raise exception 'FORBIDDEN';end if;
  return v1.settlement_state(cid);
 end if;return public.catera_v1_read_settlement_base(resource,params);
end $$;
revoke all on function public.catera_v1_read_settlement_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_settlement_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_settlement_base('),'catera_v1_command.request_id','catera_v1_command_settlement_base.request_id');
end $$;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();cid uuid;old v1.receipts;h text:=md5(action||payload::text);r jsonb;aid uuid;owed bigint;pid uuid;begin
 if u is null then raise exception 'UNAUTHORIZED';end if;perform pg_advisory_xact_lock(hashtext(u::text));
 cid:=nullif(payload->>'catererId','')::uuid;
 if action like 'delivery.%' and action<>'delivery.statusBatch' then select p.caterer_id into cid from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where d.id=nullif(payload->>'id','')::uuid;end if;
 if action='checkout.create' then select caterer_id into cid from v1.packages where id=(payload->>'packageId')::uuid;end if;
 if action='support.create' then select (snapshot->'offer'->>'catererId')::uuid into cid from v1.subscriptions where id=(payload->>'subscriptionId')::uuid;end if;
 if action='support.resolve' then select caterer_id into cid from v1.support_cases where id=(payload->>'id')::uuid;end if;
 if action='settlement.recovery' then select caterer_id into cid from v1.allocations where id=(payload->>'allocationId')::uuid;end if;
 if cid is not null then perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));end if;
 if action='payout.approve' then
  if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
  if request_id is null or length(coalesce(payload->>'reason',''))<5 then raise exception 'INVALID_INPUT';end if;
  select * into old from v1.receipts where actor_id=u and receipts.request_id=catera_v1_command.request_id;if found then if old.hash<>h then raise exception 'CONFLICT';end if;return old.result;end if;
  perform 1 from v1.caterers where id=cid for update;
  select coalesce(sum(greatest(0,a.amount-a.held-a.paid_out)),0) into owed from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=cid and c.quote->>'settlementModel' is distinct from 'delivery_earned_v1';
  if owed<=0 then raise exception 'SETTLEMENT_SCHEDULED';end if;if owed>2147483647 then raise exception 'AMOUNT_TOO_LARGE';end if;
  insert into v1.payouts(caterer_id,amount) values(cid,owed::int) returning id into pid;
  insert into v1.payout_items select pid,a.id,a.amount-a.held-a.paid_out from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=cid and a.amount-a.held-a.paid_out>0 and c.quote->>'settlementModel' is distinct from 'delivery_earned_v1';
  update v1.allocations a set paid_out=a.paid_out+i.amount from v1.payout_items i where i.payout_id=pid and i.allocation_id=a.id;
  insert into v1.outbox(kind,payload,dedupe) values('payout.create',jsonb_build_object('payoutId',pid),pid::text);
  r:=jsonb_build_object('id',pid);insert into v1.audit(actor_id,action,details) values(u,action,payload||r);insert into v1.receipts values(u,request_id,h,r);return r;
 end if;
 if action not in('settlement.policy','settlement.features','settlement.recovery') then return public.catera_v1_command_settlement_base(action,payload,request_id);end if;
 if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
 if request_id is null or length(coalesce(payload->>'reason',''))<5 then raise exception 'INVALID_INPUT';end if;
 select * into old from v1.receipts where actor_id=u and receipts.request_id=catera_v1_command.request_id;if found then if old.hash<>h then raise exception 'CONFLICT';end if;return old.result;end if;
 if action='settlement.policy' then
  insert into v1.settlement_policies(caterer_id,enabled,synthetic,actor_id,reason,minimum_amount,maximum_amount) values(cid,(payload->>'enabled')::boolean,(payload->>'synthetic')::boolean,u,payload->>'reason',coalesce((payload->>'minimumAmount')::int,1),coalesce((payload->>'maximumAmount')::int,2147483647)) returning jsonb_build_object('id',id) into r;
 elsif action='settlement.features' then
  update v1.purchase_features set multi_cycle=(payload->>'multiCycle')::boolean,automatic_payouts=(payload->>'automaticPayouts')::boolean where id;r:=jsonb_build_object('saved',true);
 else
  aid:=(payload->>'allocationId')::uuid;select a.caterer_id into cid from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.id=aid and c.quote->>'settlementModel'='delivery_earned_v1';if cid is null then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));owed:=greatest(0,v1.settlement_used(aid)-v1.settlement_earned(aid));
  if (payload->>'amount')::bigint not between 1 and owed or length(coalesce(payload->>'reference',''))<3 then raise exception 'AMOUNT_INVALID';end if;
  insert into v1.settlement_entries(caterer_id,allocation_id,kind,amount,source,actor_id,details) values(cid,aid,'recovery',(payload->>'amount')::bigint,'recovery:'||request_id,u,payload) returning jsonb_build_object('id',id) into r;
 end if;
 insert into v1.audit(actor_id,action,details) values(u,action,payload||r);insert into v1.receipts values(u,request_id,h,r);return r;
end $$;
revoke all on function public.catera_v1_command_settlement_base(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_settlement_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare p v1.payouts;cid uuid;key text;finger text;status text;old v1.payout_events;result jsonb:='[]';rowdata record;begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='settlement.run' then
  for rowdata in select distinct caterer_id from v1.settlement_policies order by caterer_id loop result:=result||v1.plan_settlement(rowdata.caterer_id);end loop;return result;
 elsif action='settlement.pending' then
  with candidates as (select pending_payout.id from v1.payouts pending_payout where pending_payout.settlement_run_id is not null and pending_payout.provider_id is not null and pending_payout.status in('pending','pending_compliance','submitting') and (pending_payout.settlement_polled_at is null or pending_payout.settlement_polled_at<clock_timestamp()-interval '5 minutes') order by pending_payout.settlement_polled_at nulls first,pending_payout.created_at limit 20 for update skip locked), claimed as (update v1.payouts claimed_payout set settlement_polled_at=clock_timestamp() from candidates c where claimed_payout.id=c.id returning claimed_payout.id,claimed_payout.provider_id,claimed_payout.recipient_request) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;return result;
 elsif action in('payout.prepare','payout.event') then
  select * into p from v1.payouts where id=(payload->>'id')::uuid;if not found then raise exception 'NOT_FOUND';end if;
  perform pg_advisory_xact_lock(hashtext('pilot:'||p.caterer_id::text));select * into p from v1.payouts where id=p.id for update;
  if p.settlement_run_id is null then raise exception 'INVALID_STATE';end if;
  if action='payout.prepare' then
   if p.status not in('approved','submitting') then return null;end if;
   if p.status='approved' and (select coalesce(sum(v1.settlement_earned(a.id)-v1.settlement_used(a.id)-v1.settlement_held(a.id)),0) from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where a.caterer_id=p.caterer_id and c.quote->>'settlementModel'='delivery_earned_v1')<0 then update v1.payouts set status='cancelled',failure_code='REFUND_ADJUSTMENT' where id=p.id;return null;end if;
   if p.status='approved' and (not(select automatic_payouts from v1.purchase_features where id) or not coalesce((v1.settlement_policy(p.caterer_id)).enabled,false) or exists(select 1 from v1.settlement_payout_items i join v1.allocations a on a.id=i.allocation_id where i.payout_id=p.id and (a.held>0 or exists(select 1 from v1.support_cases s where s.checkout_id=a.checkout_id and s.status<>'resolved')))) then update v1.payouts set status='cancelled',failure_code='SETTLEMENT_HELD' where id=p.id;return null;end if;
   if p.recipient_request is null then
    if jsonb_typeof(payload->'request') is distinct from 'object' or (payload->'request'->'payout_details'->>'source_amount')::numeric is distinct from p.amount::numeric or payload->'request'->>'reference_id' is distinct from p.id::text then raise exception 'AMOUNT_INVALID';end if;
    update v1.payouts set recipient_request=payload->'request',status='submitting' where id=p.id returning * into p;
   end if;return to_jsonb(p);
  end if;
  if payload->>'providerId' is null or (p.provider_id is not null and p.provider_id<>payload->>'providerId') or (payload->>'amount')::numeric is distinct from p.amount::numeric or payload->>'currency' is distinct from 'IDR' then raise exception 'AMOUNT_INVALID';end if;
  key:=payload->>'eventKey';finger:=md5(payload::text);status:=payload->>'status';
  if key is null or status not in('pending','pending_compliance','succeeded','failed','rejected','reversed') then raise exception 'INVALID_INPUT';end if;
  select * into old from v1.payout_events where event_key=key;if found then if old.fingerprint<>finger then raise exception 'CONFLICT';end if;return jsonb_build_object('duplicate',true);end if;
  if p.status in('failed','rejected','reversed','cancelled') and status<>p.status then raise exception 'CONFLICT';end if;
  if p.status='succeeded' and status not in('succeeded','reversed') then return jsonb_build_object('ignored',true);end if;
  if status='reversed' and p.status<>'succeeded' then raise exception 'CONFLICT';end if;
  insert into v1.payout_events values(key,p.id,finger,status,now());
  if status='succeeded' and p.status<>'succeeded' then update v1.allocations a set paid_out=paid_out+i.amount from v1.settlement_payout_items i where i.payout_id=p.id and a.id=i.allocation_id;end if;
  if status='reversed' and p.status='succeeded' then update v1.allocations a set paid_out=paid_out-i.amount from v1.settlement_payout_items i where i.payout_id=p.id and a.id=i.allocation_id;end if;
  update v1.payouts set status=(payload->>'status'),provider_id=payload->>'providerId',provider_updated_at=clock_timestamp(),failure_code=payload->>'failureCode' where id=p.id;
  insert into v1.audit(action,details) values('settlement.payoutEvent',jsonb_build_object('id',p.id,'status',status,'eventKey',key));return jsonb_build_object('id',p.id,'status',status);
 end if;
 if action in('payment.event','refund.update') then
  if action='payment.event' then select user_id into rowdata from v1.checkouts where id=(payload->>'checkoutId')::uuid;if rowdata.user_id is not null then perform pg_advisory_xact_lock(hashtext(rowdata.user_id::text));end if;select pk.caterer_id into cid from v1.checkouts c join v1.packages pk on pk.id=c.package_id where c.id=(payload->>'checkoutId')::uuid;
  else select pk.caterer_id into cid from v1.refunds r join v1.checkouts c on c.id=r.checkout_id join v1.packages pk on pk.id=c.package_id where r.id=(payload->>'id')::uuid;end if;
  if cid is not null then perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));end if;
 end if;
 if action='payout.update' and exists(select 1 from v1.payouts where id=(payload->>'id')::uuid and settlement_run_id is not null) then raise exception 'INVALID_ACTION';end if;
 return public.catera_v1_system_settlement_base(action,payload);
end $$;
revoke all on function public.catera_v1_system_settlement_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
revoke all on all functions in schema v1 from public,anon,authenticated;

do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_reconcile(text,uuid,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_reconcile(text,uuid,jsonb,uuid) rename to catera_v1_reconcile_settlement_base;
 execute replace(replace(d,'public.catera_v1_reconcile(','public.catera_v1_reconcile_settlement_base('),'catera_v1_reconcile.request_id','catera_v1_reconcile_settlement_base.request_id');
end $$;
create function public.catera_v1_reconcile(kind text,identifier uuid,details jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r v1.refunds;a v1.allocations;old v1.receipts;h text:=md5(kind||identifier::text||details::text);deduction bigint;remaining bigint;take bigint;rowdata record;result jsonb;begin
 if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
 if kind='payout' and exists(select 1 from v1.payouts where id=identifier and settlement_run_id is not null) then raise exception 'SETTLEMENT_PROVIDER_RECONCILIATION';end if;
 select * into r from v1.refunds where id=identifier;
 select aa.* into a from v1.allocations aa join v1.checkouts c on c.id=aa.checkout_id where aa.checkout_id=r.checkout_id and c.quote->>'settlementModel'='delivery_earned_v1';
 if kind<>'refund' or a.id is null then return public.catera_v1_reconcile_settlement_base(kind,identifier,details,request_id);end if;
 perform pg_advisory_xact_lock(hashtext(u::text));perform pg_advisory_xact_lock(hashtext('pilot:'||a.caterer_id::text));
 select * into old from v1.receipts where actor_id=u and receipts.request_id=catera_v1_reconcile.request_id;if found then if old.hash<>h then raise exception 'CONFLICT';end if;return old.result;end if;
 select * into r from v1.refunds where id=identifier for update;
 if request_id is null or r.state<>'succeeded' or r.reconciliation is not null or length(coalesce(details->>'reason',''))<5 or length(coalesce(details->>'reference',''))<3 then raise exception 'CONFLICT';end if;
 if jsonb_typeof(details->'sellerDeduction') is distinct from 'number' or (details->>'sellerDeduction')::numeric<>trunc((details->>'sellerDeduction')::numeric) then raise exception 'AMOUNT_INVALID';end if;
 deduction:=(details->>'sellerDeduction')::bigint;
 if deduction<0 or deduction>r.amount then raise exception 'AMOUNT_INVALID';end if;
 if details ? 'dayIds' and (jsonb_typeof(details->'dayIds') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(details->'dayIds') x where not exists(select 1 from v1.settlement_day_allocations d where d.day_id::text=x and d.allocation_id=a.id))) then raise exception 'INVALID_INPUT';end if;
 remaining:=deduction;
 for rowdata in select d.*,d.amount+coalesce((select sum(e.amount) from v1.settlement_entries e where e.day_id=d.day_id and e.kind in('refund_debit','entitlement_reduction')),0) available from v1.settlement_day_allocations d where d.allocation_id=a.id and (not(details ? 'dayIds') or details->'dayIds' ? d.day_id::text) order by d.ordinal loop
  take:=least(remaining,greatest(0,rowdata.available));if take>0 then
   insert into v1.settlement_entries(caterer_id,allocation_id,day_id,kind,amount,source,actor_id,details) values(a.caterer_id,a.id,rowdata.day_id,case when exists(select 1 from v1.settlement_entries e where e.day_id=rowdata.day_id and e.kind='earned') then 'refund_debit' else 'entitlement_reduction' end,-take,'refund:'||r.id||':'||rowdata.day_id,u,jsonb_build_object('refundId',r.id,'reference',details->>'reference'));
   remaining:=remaining-take;
  end if;exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'AMOUNT_INVALID';end if;
 update v1.refunds set reconciliation=details||jsonb_build_object('actor',u,'at',now(),'settlementModel','delivery_earned_v1') where id=r.id;
 if not exists(select 1 from v1.support_cases where checkout_id=r.checkout_id and status<>'resolved') and not exists(select 1 from v1.refunds where checkout_id=r.checkout_id and state<>'failed' and reconciliation is null) then update v1.allocations set held=0 where id=a.id;end if;
 update v1.outbox ob set processed_at=now() where ob.kind='split.reconcile' and ob.payload->>'refundId'=r.id::text;
 result:=jsonb_build_object('id',r.id);insert into v1.audit(actor_id,action,details) values(u,'settlement.refund',details||result);insert into v1.receipts values(u,request_id,h,result);return result;
end $$;
revoke all on function public.catera_v1_reconcile_settlement_base(text,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.catera_v1_reconcile(text,uuid,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_reconcile(text,uuid,jsonb,uuid) to authenticated;
