-- Additive provider identity, durable submission claims and authenticated inbox.
create table v1.payment_provider_config (
 id boolean primary key default true check(id), provider text not null check(provider in('xendit','doku')),
 environment text not null, merchant text not null,
 check(provider<>'doku' or (environment='sandbox' and length(merchant)>0))
);
insert into v1.payment_provider_config values(true,'xendit','legacy','');
alter table v1.checkouts add column provider text;
alter table v1.checkouts add column provider_environment text;
alter table v1.checkouts add column provider_merchant text;
-- Only classify identifiers whose origin can be established. Unknown history stays unknown.
update v1.checkouts set provider='xendit',provider_environment='legacy',provider_merchant=''
 where provider_id like 'ps-%' or provider_id like 'session-%';
update v1.checkouts set provider='demo',provider_environment='synthetic',provider_merchant=''
 where provider_id like 'demo-%';
update v1.checkouts set provider='xendit',provider_environment='legacy',provider_merchant=''
 where provider_id is null and payment_url is null and state='pending';
create function v1.checkout_provider() returns trigger language plpgsql set search_path='' as $$
declare cfg v1.payment_provider_config;begin
 if tg_op='UPDATE' then
  if (new.provider,new.provider_environment,new.provider_merchant) is distinct from (old.provider,old.provider_environment,old.provider_merchant) then raise exception 'IMMUTABLE_PROVIDER';end if;
 else
  select * into strict cfg from v1.payment_provider_config where id;
  new.provider:=cfg.provider;new.provider_environment:=cfg.environment;new.provider_merchant:=cfg.merchant;
 end if;return new;
end $$;
create trigger checkout_provider before insert or update of provider,provider_environment,provider_merchant on v1.checkouts for each row execute function v1.checkout_provider();

create table v1.provider_operations (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in('payment','payout','refund')),
 entity_id uuid not null, provider text not null default 'doku' check(provider='doku'),
 environment text not null default 'sandbox' check(environment='sandbox'), merchant text not null,
 reference text not null, amount int not null check(amount>0), currency text not null default 'IDR' check(currency='IDR'),
 state text not null default 'submitting', request jsonb not null default '{}', result jsonb not null default '{}',
 lease_until timestamptz, lease_token uuid not null default gen_random_uuid(), polled_at timestamptz, error_code text, created_at timestamptz not null default now(),
 unique(kind,entity_id),unique(provider,environment,merchant,reference)
);
create table v1.provider_inbox (
 id text primary key, operation_id uuid not null references v1.provider_operations,
 event jsonb not null, fingerprint text not null, received_at timestamptz not null default now(), processed_at timestamptz,
 attempts int not null default 0, available_at timestamptz not null default now(), error_code text
);
alter table v1.refunds add column attention_reason text;
alter table v1.refunds add column customer_action_url text;
alter table v1.refunds add column customer_action_expires_at timestamptz;
create sequence v1.doku_external_id;
-- Partition newly planned payouts before dispatch, never combine provider funding pools.
create function v1.partition_provider_payouts() returns void language plpgsql set search_path='' as $$
declare p v1.payouts;g record;child uuid;minimum int;begin
 for p in select * from v1.payouts where settlement_run_id is not null and status='approved' and recipient_request is null order by caterer_id,id loop
  perform pg_advisory_xact_lock(hashtext('pilot:'||p.caterer_id::text));
  perform 1 from v1.payouts where id=p.id and status='approved' and recipient_request is null for update;if not found then continue;end if;
  if (select count(*) from (select distinct c.provider,c.provider_environment,c.provider_merchant from v1.payout_items i join v1.allocations a on a.id=i.allocation_id join v1.checkouts c on c.id=a.checkout_id where i.payout_id=p.id)x)<2 then continue;end if;
  select minimum_amount into minimum from v1.settlement_policies where id=(select policy_id from v1.settlement_runs where id=p.settlement_run_id);
  for g in select c.provider,c.provider_environment,c.provider_merchant,sum(i.amount)::int amount,array_agg(i.allocation_id) ids from v1.payout_items i join v1.allocations a on a.id=i.allocation_id join v1.checkouts c on c.id=a.checkout_id where i.payout_id=p.id group by c.provider,c.provider_environment,c.provider_merchant loop
   if g.amount<minimum then continue;end if;
   insert into v1.payouts(caterer_id,amount,settlement_run_id) values(p.caterer_id,g.amount,p.settlement_run_id) returning id into child;
   insert into v1.payout_items select child,allocation_id,amount from v1.payout_items where payout_id=p.id and allocation_id=any(g.ids);
   insert into v1.settlement_payout_items select child,allocation_id,amount from v1.settlement_payout_items where payout_id=p.id and allocation_id=any(g.ids);
   insert into v1.outbox(kind,payload,dedupe) values('payout.create',jsonb_build_object('payoutId',child),'settlement:'||child);
  end loop;
  update v1.payouts set status='cancelled',failure_code='PARTITIONED_BY_PROVIDER' where id=p.id;
 end loop;
end $$;
do $$ declare t text;begin
 foreach t in array array['payment_provider_config','provider_operations','provider_inbox'] loop
  execute format('alter table v1.%I enable row level security',t);
  execute format('revoke all on v1.%I from public,anon,authenticated',t);
 end loop;
end $$;

do $$ declare definition text;begin
 select pg_get_functiondef('public.catera_v1_system(text,jsonb)'::regprocedure) into definition;
 alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_provider_base;
 execute replace(replace(definition,'public.catera_v1_system(','public.catera_v1_system_provider_base('),'catera_v1_system.payload','catera_v1_system_provider_base.payload');
end $$;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare c v1.checkouts;o v1.provider_operations;p v1.payouts;ev v1.provider_inbox;r jsonb;ident uuid;cfg v1.payment_provider_config;source_count int;begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='settlement.run' then
  r:=public.catera_v1_system_provider_base(action,payload);perform v1.partition_provider_payouts();return r;
 elsif action='provider.configure' then
  if payload->>'provider' not in('xendit','doku') or length(coalesce(payload->>'reason',''))<5 then raise exception 'INVALID_INPUT';end if;
  update v1.payment_provider_config set provider=payload->>'provider',environment=payload->>'environment',merchant=coalesce(payload->>'merchant','') where id returning * into cfg;
  insert into v1.audit(action,details) values(action,to_jsonb(cfg)||jsonb_build_object('reason',payload->>'reason'));return to_jsonb(cfg);
 elsif action='provider.config' then return (select to_jsonb(x) from v1.payment_provider_config x where id);
 elsif action='provider.externalId' then return to_jsonb(nextval('v1.doku_external_id')::text);
 elsif action='provider.operation' then
  return (select to_jsonb(x) from v1.provider_operations x where (payload ? 'reference' and x.reference=payload->>'reference' and x.merchant=payload->>'merchant') or (not(payload ? 'reference') and x.entity_id=(payload->>'id')::uuid and x.kind=payload->>'kind'));
 elsif action='provider.payment.claim' then
  select * into c from v1.checkouts where id=(payload->>'id')::uuid for update;
  if c.id is null or c.provider is distinct from 'doku' or c.provider_environment is distinct from 'sandbox' or c.provider_merchant is distinct from payload->>'merchant' then raise exception 'PAYMENT_PROVIDER_IDENTITY_MISMATCH';end if;
  select * into o from v1.provider_operations where kind='payment' and entity_id=c.id;
  if found then return to_jsonb(o)||jsonb_build_object('submit',false);end if;
  if c.state<>'pending' or c.expires_at<=clock_timestamp() then raise exception 'PAYMENT_HOLD_TOO_SHORT';end if;
  insert into v1.provider_operations(kind,entity_id,merchant,reference,amount,request,lease_until)
   values('payment',c.id,c.provider_merchant,payload->>'reference',(c.quote->>'total')::int,payload->'request',clock_timestamp()+interval '45 seconds') returning * into o;
  -- The correlation exists before the network call, including a callback beating the response.
  update v1.checkouts set provider_id=o.reference where id=c.id;
  return to_jsonb(o)||jsonb_build_object('submit',true);
 elsif action='provider.payment.attached' then
  select * into o from v1.provider_operations where kind='payment' and entity_id=(payload->>'id')::uuid for update;
  if o.id is null then raise exception 'NOT_FOUND';end if;
  update v1.provider_operations set result=payload->'result',state=case when state='submitting' then 'pending' else state end,lease_until=null where id=o.id;
  update v1.checkouts set payment_url=payload->'result'->>'url' where id=o.entity_id and state='pending';return '{}';
 elsif action='provider.error' then
  update v1.provider_operations set error_code=left(payload->>'code',100),lease_until=case when state='preparing' and payload ? 'leaseToken' then null else lease_until end where kind=payload->>'kind' and entity_id=(payload->>'id')::uuid and (not(payload ? 'leaseToken') or lease_token=(payload->>'leaseToken')::uuid);return '{}';
 elsif action='provider.pending' then
  with candidates as(select id from v1.provider_operations where kind=payload->>'kind' and state not in('failed','expired','reversed') and (state<>'succeeded' or (kind='payout' and (polled_at is null or polled_at<clock_timestamp()-interval '1 hour'))) and (lease_until is null or lease_until<clock_timestamp()) and (polled_at is null or polled_at<clock_timestamp()-interval '1 minute') order by polled_at nulls first,created_at limit 20 for update skip locked), claimed as(update v1.provider_operations x set polled_at=clock_timestamp() from candidates y where x.id=y.id returning x.*)
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into r from claimed;return r;
 elsif action='provider.inbox.receive' then
  select * into o from v1.provider_operations where id=(payload->>'operationId')::uuid;
  if o.id is null then raise exception 'NOT_FOUND';end if;
  select * into ev from v1.provider_inbox where id=payload->>'eventId';
  if found then if ev.fingerprint<>md5((payload->'event')::text) then raise exception 'CONFLICT';end if;return jsonb_build_object('duplicate',true);end if;
  insert into v1.provider_inbox(id,operation_id,event,fingerprint) values(payload->>'eventId',o.id,payload->'event',md5((payload->'event')::text)) on conflict do nothing;return '{}';
 elsif action='provider.inbox.claim' then
  with candidates as(select id from v1.provider_inbox where processed_at is null and available_at<=clock_timestamp() order by received_at limit 20 for update skip locked), claimed as(update v1.provider_inbox x set attempts=attempts+1,available_at=clock_timestamp()+interval '1 minute' from candidates y where x.id=y.id returning x.*)
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into r from claimed;return r;
 elsif action='provider.inbox.apply' then
  select * into ev from v1.provider_inbox where id=payload->>'id' for update;
  if ev.id is null then raise exception 'NOT_FOUND';end if;
  if ev.processed_at is not null then return jsonb_build_object('duplicate',true);end if;
  select * into o from v1.provider_operations where id=ev.operation_id;
  if o.kind='payment' then
   r:=public.catera_v1_system_provider_base('payment.event',ev.event);
   update v1.provider_operations set state=case when ev.event->>'status'='paid' then 'succeeded' when state='succeeded' then state else 'expired' end,error_code=null where id=o.id;
  else raise exception 'INVALID_ACTION';end if;
  update v1.provider_inbox set processed_at=clock_timestamp(),error_code=null where id=ev.id;return r;
 elsif action='provider.inbox.error' then update v1.provider_inbox set error_code=left(payload->>'code',100) where id=payload->>'id';return '{}';
 elsif action='provider.refund.block' then
  select ch.* into c from v1.refunds f join v1.checkouts ch on ch.id=f.checkout_id where f.id=(payload->>'id')::uuid;
  if c.provider is distinct from 'doku' then raise exception 'PAYMENT_PROVIDER_IDENTITY_MISMATCH';end if;
  update v1.refunds set state='needs_attention',attention_reason=left(payload->>'reason',100) where id=(payload->>'id')::uuid and state in('requested','needs_attention');return '{}';
 elsif action='provider.payout.identity' then
  select * into p from v1.payouts where id=(payload->>'id')::uuid;
  if p.id is null then raise exception 'NOT_FOUND';end if;
  select count(*) into source_count from(select distinct ch.provider,ch.provider_environment,ch.provider_merchant from v1.payout_items i join v1.allocations a on a.id=i.allocation_id join v1.checkouts ch on ch.id=a.checkout_id where i.payout_id=p.id)q;
  if source_count<>1 then raise exception 'PAYOUT_MIXED_PROVIDER_REQUIRES_REVIEW';end if;
  select ch.* into c from v1.payout_items i join v1.allocations a on a.id=i.allocation_id join v1.checkouts ch on ch.id=a.checkout_id where i.payout_id=p.id limit 1;
  if c.provider is null then raise exception 'HISTORICAL_PROVIDER_REVIEW_REQUIRED';end if;
  return jsonb_build_object('provider',c.provider,'environment',c.provider_environment,'merchant',c.provider_merchant);
 elsif action='provider.payout.destination' then
  return (select jsonb_build_object('version',d.version,'accountNumber',d.account_number,'holder',d.holder,'bankCode',d.recipient->'account_details'->>'routing_value_1') from v1.payout_destinations d where d.caterer_id=(payload->>'catererId')::uuid and d.active);
 elsif action='provider.payout.claim' then
  select * into p from v1.payouts where id=(payload->>'id')::uuid;
  if p.id is null then raise exception 'NOT_FOUND';end if;
  perform pg_advisory_xact_lock(hashtext('pilot:'||p.caterer_id::text));
  -- Globally serialize source funding; one unsettled DOKU transfer at a time.
  perform pg_advisory_xact_lock(hashtext('doku-funding:'||(payload->>'merchant')));
  select * into p from v1.payouts where id=(payload->>'id')::uuid for update;
  r:=public.catera_v1_system('provider.payout.identity',jsonb_build_object('id',p.id));
  if r->>'provider' is distinct from 'doku' or r->>'environment' is distinct from 'sandbox' or r->>'merchant' is distinct from payload->>'merchant' then raise exception 'PAYMENT_PROVIDER_IDENTITY_MISMATCH';end if;
  select * into o from v1.provider_operations where kind='payout' and entity_id=p.id;
  if found and (o.state<>'preparing' or o.lease_until>clock_timestamp()) then return to_jsonb(o)||jsonb_build_object('submit',false);end if;
  if exists(select 1 from v1.provider_operations where kind='payout' and merchant=payload->>'merchant' and entity_id<>p.id and (state in('submitting','pending') or (state='preparing' and lease_until>clock_timestamp()))) then raise exception 'DOKU_FUNDING_BUSY';end if;
  if o.id is not null then update v1.provider_operations set lease_until=clock_timestamp()+interval '2 minutes',lease_token=gen_random_uuid() where id=o.id returning * into o;return to_jsonb(o)||jsonb_build_object('submit',true);end if;
  -- Preserve the existing ledger's last-moment eligibility check via its canonical request.
  r:=public.catera_v1_system_provider_base('payout.prepare',jsonb_build_object('id',p.id,'request',jsonb_build_object('reference_id',p.id,'payout_details',jsonb_build_object('source_amount',p.amount),'recipient',payload->'request')));
  if r is null then return null;end if;
  insert into v1.provider_operations(kind,entity_id,merchant,reference,amount,request,lease_until,state)
   values('payout',p.id,payload->>'merchant',p.id::text,p.amount,payload->'request',clock_timestamp()+interval '2 minutes','preparing') returning * into o;
  return to_jsonb(o)||jsonb_build_object('submit',true);
 elsif action='provider.payout.capture' then
  select * into p from v1.payouts where id=(payload->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtext('pilot:'||p.caterer_id::text));
  if not(select automatic_payouts from v1.purchase_features where id) or not coalesce((v1.settlement_policy(p.caterer_id)).enabled,false)
    or exists(select 1 from v1.settlement_payout_items i join v1.allocations a on a.id=i.allocation_id where i.payout_id=p.id and (a.held>0 or exists(select 1 from v1.support_cases s where s.checkout_id=a.checkout_id and s.status<>'resolved') or exists(select 1 from v1.refunds f where f.checkout_id=a.checkout_id and f.state<>'failed' and f.reconciliation is null)))
    or (select coalesce(sum(v1.settlement_earned(a.id)-v1.settlement_used(a.id)-v1.settlement_held(a.id)),0) from v1.allocations a join v1.checkouts ch on ch.id=a.checkout_id where a.caterer_id=p.caterer_id and ch.quote->>'settlementModel'='delivery_earned_v1')<0 then raise exception 'SETTLEMENT_HELD';end if;
  update v1.provider_operations set result=payload->'result',state='submitting' where kind='payout' and entity_id=p.id and state='preparing' and result='{}' and lease_token=(payload->>'leaseToken')::uuid and lease_until>clock_timestamp();
  if not found then raise exception 'CONFLICT';end if;return '{}';
 elsif action='provider.payout.wake' then
  update v1.provider_operations set polled_at=null where kind='payout' and reference=payload->>'reference' and merchant=payload->>'merchant';
  if not found then raise exception 'NOT_FOUND';end if;return '{}';
 elsif action='provider.payout.event' then
  select * into o from v1.provider_operations where kind='payout' and entity_id=(payload->>'id')::uuid for update;
  if o.id is null then raise exception 'NOT_FOUND';end if;
  r:=public.catera_v1_system_provider_base('payout.event',payload);
  update v1.provider_operations set state=(select status from v1.payouts where id=o.entity_id),lease_until=null,error_code=null where id=o.id;return r;
 elsif action='refund.lookup' then
  r:=public.catera_v1_system_provider_base(action,payload);
  select ch.* into c from v1.checkouts ch where ch.id=(r->>'checkout_id')::uuid;
  return r||jsonb_build_object('provider',c.provider,'provider_environment',c.provider_environment,'provider_merchant',c.provider_merchant);
 elsif action in('payment.attach','payment.event','refund.update','payout.event','payout.update') then
  if action like 'payment.%' then select * into c from v1.checkouts where id=coalesce(payload->>'checkoutId',payload->>'id')::uuid;
  elsif action='refund.update' then select ch.* into c from v1.refunds f join v1.checkouts ch on ch.id=f.checkout_id where f.id=(payload->>'id')::uuid;
  else
   if exists(select 1 from v1.provider_operations where kind='payout' and entity_id=(payload->>'id')::uuid) then raise exception 'PROVIDER_EVENT_ROUTE_REQUIRED';end if;
  end if;
  if c.provider='doku' then raise exception 'PROVIDER_EVENT_ROUTE_REQUIRED';end if;
 elsif action='health' then
  r:=public.catera_v1_system_provider_base(action,payload);
  return r||jsonb_build_object('providerErrors',(select count(*) from v1.provider_operations where error_code is not null),'providerInboxPending',(select count(*) from v1.provider_inbox where processed_at is null),'refundsNeedingAttention',(select count(*) from v1.refunds where state='needs_attention'));
 end if;
 return public.catera_v1_system_provider_base(action,payload);
end $$;
revoke all on function public.catera_v1_system_provider_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
revoke all on function v1.checkout_provider() from public,anon,authenticated;
revoke all on function v1.partition_provider_payouts() from public,anon,authenticated;
revoke all on sequence v1.doku_external_id from public,anon,authenticated;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_provider_base;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;begin
 r:=public.catera_v1_read_provider_base(resource,params);
 if resource='customer' and auth.uid() is not null then
  r:=r||jsonb_build_object('refunds',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'case_id',f.case_id,'amount',f.amount,'state',f.state,'customer_action_url',f.customer_action_url,'customer_action_expires_at',f.customer_action_expires_at)) from v1.refunds f join v1.checkouts c on c.id=f.checkout_id where c.user_id=auth.uid()),'[]'));
 elsif resource='admin' and v1.is_admin(auth.uid()) then
  r:=r||jsonb_build_object('providerOperations',coalesce((select jsonb_agg(to_jsonb(x)) from (select kind,entity_id,state,error_code,created_at from v1.provider_operations order by created_at desc limit 50)x),'[]'));
 end if;return r;
end $$;
revoke all on function public.catera_v1_read_provider_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
