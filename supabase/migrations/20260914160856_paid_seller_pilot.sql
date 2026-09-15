-- Additive paid-pilot capabilities. No fixtures or commercial defaults.
create table v1.customer_records(
 id uuid primary key default gen_random_uuid(), caterer_id uuid not null references v1.caterers,
 user_id uuid references v1.profiles, name text not null check(length(name) between 1 and 100),
 phone text check(phone ~ '^\+62[0-9]{8,13}$'), address jsonb not null default '{}',
 origin text not null check(origin in('seller','marketplace')), version int not null default 1,
 claim_review text, created_at timestamptz not null default now()
);
create index customer_records_owner on v1.customer_records(caterer_id,user_id);
create index customer_records_phone on v1.customer_records(caterer_id,phone);
insert into v1.customer_records(caterer_id,user_id,name,origin)
 select r.caterer_id,r.user_id,left(coalesce(nullif(trim(p.name),''),'Pelanggan'),100),case when r.source='marketplace' then 'marketplace' else 'seller' end
 from v1.relationships r join v1.profiles p on p.id=r.user_id;
alter table v1.checkouts add column customer_record_id uuid references v1.customer_records;
alter table v1.checkouts alter column user_id drop not null;
alter table v1.checkouts alter column address_id drop not null;
alter table v1.checkouts add constraint pilot_checkout_identity check(user_id is not null or
 (customer_record_id is not null and (quote->>'purchaseKind') is not distinct from 'legacy_import'));
alter table v1.subscriptions add column customer_record_id uuid references v1.customer_records;
alter table v1.subscriptions add column renewed_from uuid references v1.subscriptions;
alter table v1.subscriptions add column external_reference text;
alter table v1.subscriptions alter column user_id drop not null;
alter table v1.subscriptions add constraint pilot_subscription_identity check(user_id is not null or (legacy and customer_record_id is not null));
create unique index pilot_external_receipt on v1.subscriptions(customer_record_id,external_reference) where external_reference is not null;
create index pilot_subscription_customer on v1.subscriptions(customer_record_id);
create index pilot_subscription_renewal on v1.subscriptions(renewed_from) where renewed_from is not null;
create index pilot_checkout_customer on v1.checkouts(customer_record_id);
create index pilot_pending_renewal on v1.checkouts((quote->>'renewedFrom')) where state='pending';
update v1.subscriptions s set customer_record_id=r.id from v1.customer_records r,v1.packages p
 where s.package_id=p.id and r.caterer_id=p.caterer_id and r.user_id=s.user_id;
update v1.checkouts c set customer_record_id=r.id from v1.customer_records r,v1.packages p
 where c.package_id=p.id and r.caterer_id=p.caterer_id and r.user_id=c.user_id;
alter table v1.support_cases add column customer_record_id uuid references v1.customer_records;
alter table v1.support_cases alter column user_id drop not null;
alter table v1.support_cases add constraint pilot_support_identity check(user_id is not null or customer_record_id is not null);
update v1.support_cases sc set customer_record_id=coalesce(
 (select customer_record_id from v1.subscriptions where id=sc.subscription_id),
 (select customer_record_id from v1.checkouts where id=sc.checkout_id));
create function v1.pilot_support_link() returns trigger language plpgsql set search_path='' as $$
begin
 new.customer_record_id:=coalesce(new.customer_record_id,(select customer_record_id from v1.subscriptions where id=new.subscription_id),
 (select customer_record_id from v1.checkouts where id=new.checkout_id));return new;
end $$;
create trigger pilot_support_link before insert on v1.support_cases for each row execute function v1.pilot_support_link();
create table v1.customer_claims(id uuid primary key default gen_random_uuid(),customer_record_id uuid not null references v1.customer_records,
 token_hash text unique not null,expires_at timestamptz not null,used_at timestamptz,created_by uuid not null references v1.profiles);
create table v1.pilot_pricing(id uuid primary key default gen_random_uuid(),caterer_id uuid not null references v1.caterers,
 model text not null check(model in('transaction','monthly')),cohort text not null check(length(cohort) between 1 and 80),
 effective_at timestamptz not null,service_fee int not null check(service_fee>=0),marketplace_percent numeric not null check(marketplace_percent between 0 and 100),
 invited_percent numeric not null check(invited_percent between 0 and 100),monthly_fee int not null check(monthly_fee>=0),
 approved boolean not null,synthetic boolean not null default true,approved_by uuid not null references v1.profiles,
 reason text not null check(length(reason)>=5),created_at timestamptz not null default now(),unique(caterer_id,effective_at),check(model='monthly' or monthly_fee=0));
create trigger pilot_pricing_immutable before update or delete on v1.pilot_pricing for each row execute function v1.immutable();
create table v1.pilot_enrollments(caterer_id uuid primary key references v1.caterers,pricing_id uuid not null references v1.pilot_pricing,
 starts_on date not null,ends_on date not null,exited_on date,reference text not null check(length(reference)>=5),
 actor_id uuid not null references v1.profiles,created_at timestamptz not null default now(),check(ends_on=starts_on+89),check(exited_on is null or exited_on>=starts_on));
alter table v1.pilot_enrollments enable row level security;
revoke all on v1.pilot_enrollments from public,anon,authenticated;
create table v1.pilot_invoices(id uuid primary key default gen_random_uuid(),caterer_id uuid not null references v1.caterers,
 pricing_id uuid not null references v1.pilot_pricing,period date not null,amount int not null check(amount>=0),
 created_at timestamptz not null default now(),unique(caterer_id,period),check(period=date_trunc('month',period)::date));
create table v1.pilot_invoice_entries(id uuid primary key default gen_random_uuid(),invoice_id uuid not null references v1.pilot_invoices,
 kind text not null check(kind in('payment','refund','adjustment')),amount int not null check(amount<>0),reference text not null check(length(reference)>=3),
 actor_id uuid not null references v1.profiles,created_at timestamptz not null default now());
create trigger pilot_entry_immutable before update or delete on v1.pilot_invoice_entries for each row execute function v1.immutable();
create unique index pilot_entry_reference on v1.pilot_invoice_entries(invoice_id,kind,reference);
create table v1.pilot_observations(id uuid primary key default gen_random_uuid(),caterer_id uuid not null references v1.caterers,
 observed_on date not null,kind text not null check(kind in('processing','payout','incentive','support','acquisition','onboarding','admin_baseline','admin_current','assistance')),
 amount int check(amount>=0),minutes int check(minutes>=0),sample_days int not null default 1 check(sample_days between 1 and 366),synthetic boolean not null,
 reference text not null check(length(reference)>=3),actor_id uuid not null references v1.profiles,created_at timestamptz not null default now(),
 check(amount is not null or minutes is not null));
create trigger pilot_observation_immutable before update or delete on v1.pilot_observations for each row execute function v1.immutable();
create unique index pilot_observation_reference on v1.pilot_observations(caterer_id,kind,observed_on,reference);
create table v1.pilot_followups(id uuid primary key default gen_random_uuid(),subscription_id uuid not null references v1.subscriptions,
 actor_id uuid not null references v1.profiles,kind text not null check(kind in('prepared','declined','unknown')),
 note text not null default '',created_at timestamptz not null default now());
do $$ declare t text;begin foreach t in array array['customer_records','customer_claims','pilot_pricing','pilot_invoices','pilot_invoice_entries','pilot_observations','pilot_followups'] loop
 execute format('alter table v1.%I enable row level security',t);execute format('revoke all on v1.%I from public,anon,authenticated',t);end loop;end $$;

create function v1.pilot_address(a jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(a)='object' and jsonb_typeof(a->'line')='string' and jsonb_typeof(a->'area')='string' and jsonb_typeof(a->'city')='string'
 and (not(a ? 'instructions') or jsonb_typeof(a->'instructions')='string') and length(a->>'line') between 5 and 240 and length(a->>'area') between 1 and 100
 and length(a->>'city') between 1 and 100 and length(coalesce(a->>'instructions',''))<=400,false)
$$;
-- Notification callers also serve seller-managed subscriptions without an account.
create or replace function v1.notify(u uuid,k text,b text,h text) returns void language plpgsql set search_path='' as $$
declare n uuid;begin if u is null then return;end if;
 insert into v1.notifications(user_id,kind,body,href) values(u,k,b,h) returning id into n;
 insert into v1.outbox(kind,payload,dedupe) values('push',jsonb_build_object('userId',u,'body',b,'href',h),n::text);end $$;

create function v1.pilot_policy(cid uuid) returns v1.policies language plpgsql stable set search_path='' as $$
declare p v1.pilot_pricing;r v1.policies;begin
 select * into p from v1.pilot_pricing where caterer_id=cid and approved and effective_at<=statement_timestamp() order by effective_at desc limit 1;
 if found then r.id:=true;r.service_fee:=p.service_fee;r.marketplace_percent:=p.marketplace_percent;
 r.invited_percent:=case when p.model='monthly' then 0 else p.invited_percent end;r.approved:=p.approved;r.synthetic:=p.synthetic;
 else select * into r from v1.policies where id;if not found then raise exception 'NOT_CONFIGURED';end if;end if;return r;end $$;
do $$ declare def text;begin
 select pg_get_functiondef('v1.quote(uuid,jsonb)'::regprocedure) into def;
 if position('select * into pol from v1.policies where id;' in def)=0 then raise exception 'POLICY_ANCHOR_MISSING';end if;
 alter function v1.quote(uuid,jsonb) rename to quote_pilot_base;
 def:=replace(replace(def,'v1.quote(','v1.quote_pilot_base('),'select * into pol from v1.policies where id;','pol:=v1.pilot_policy(p.caterer_id);');execute def;
end $$;
create function v1.pilot_claim(u uuid,token text,phone text) returns jsonb language plpgsql set search_path='' as $$
declare link v1.customer_claims;cr v1.customer_records;why text;begin
 if u is null or phone is null then raise exception 'FORBIDDEN';end if;
 select * into link from v1.customer_claims where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not found or link.expires_at<=clock_timestamp() or link.used_at is not null then raise exception 'CLAIM_UNAVAILABLE';end if;
 select * into cr from v1.customer_records where id=link.customer_record_id;
 perform pg_advisory_xact_lock(hashtext(u::text));
 perform pg_advisory_xact_lock(hashtext('pilot:'||cr.caterer_id::text));
 perform id from v1.packages where caterer_id=cr.caterer_id order by id for update;
 select * into cr from v1.customer_records where id=link.customer_record_id for update;
 select * into link from v1.customer_claims where id=link.id for update;
 if link.used_at is not null or link.expires_at<=clock_timestamp() or cr.phone is distinct from phone then raise exception 'CLAIM_UNAVAILABLE';end if;
 if cr.user_id is not null and cr.user_id<>u then why:='OWNERSHIP_CONFLICT';
 elsif exists(select 1 from v1.customer_records x where x.caterer_id=cr.caterer_id and x.phone=cr.phone and x.id<>cr.id and x.user_id is distinct from u) then why:='AMBIGUOUS_CUSTOMER';
 elsif exists(select 1 from v1.subscriptions s join v1.subscriptions x on x.package_id=s.package_id and x.id<>s.id
  where s.customer_record_id=cr.id and s.status='active' and x.user_id=u and x.status='active' and x.starts_on<=s.ends_on and x.ends_on>=s.starts_on)
 or exists(select 1 from v1.subscriptions s join v1.checkouts c on c.package_id=s.package_id where s.customer_record_id=cr.id and s.status='active'
  and c.user_id=u and c.state='pending' and c.expires_at>clock_timestamp() and (c.quote->'dates'->>0)::date<=s.ends_on and (c.quote->'dates'->>-1)::date>=s.starts_on) then why:='OVERLAP';end if;
 if why is not null then update v1.customer_records set claim_review=why where id=cr.id;
  insert into v1.audit(actor_id,action,details) values(u,'customer.claimReview',jsonb_build_object('customerRecordId',cr.id,'reason',why));
  return jsonb_build_object('status','review','reason',why);end if;
 update v1.customer_records set user_id=u,claim_review=null,version=version+1,
 origin=case when exists(select 1 from v1.relationships where user_id=u and caterer_id=cr.caterer_id and source='marketplace') then 'marketplace' else origin end where id=cr.id;
 update v1.checkouts set user_id=u where customer_record_id=cr.id and user_id is null;
 update v1.subscriptions set user_id=u where customer_record_id=cr.id and user_id is null;
 update v1.support_cases set user_id=u where customer_record_id=cr.id and user_id is null;
 insert into v1.relationships values(u,cr.caterer_id,'legacy') on conflict do nothing;
 if v1.pilot_address(cr.address) and not exists(select 1 from v1.addresses where user_id=u and line=cr.address->>'line' and area=cr.address->>'area') then
  insert into v1.addresses(user_id,label,line,area,city,instructions) values(u,coalesce(nullif(cr.address->>'label',''),'Katering'),cr.address->>'line',cr.address->>'area',cr.address->>'city',coalesce(cr.address->>'instructions',''));end if;
 update v1.customer_claims set used_at=now() where customer_record_id=cr.id and used_at is null;
 insert into v1.audit(actor_id,action,details) values(u,'customer.claim',jsonb_build_object('customerRecordId',cr.id));
 return jsonb_build_object('status','claimed','customerRecordId',cr.id);
end $$;

create function v1.pilot_customer(cr v1.customer_records,detail boolean default false) returns jsonb language sql stable set search_path='' as $$
 select to_jsonb(cr)||jsonb_build_object('subscriptions',coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_on desc) from (
 select s.id,s.package_id,s.portions,s.starts_on,s.ends_on,s.status,s.legacy,s.renewed_from,s.external_reference,coalesce((s.snapshot->>'trial')::boolean,false) as trial,
 s.snapshot->'offer'->>'name' as package_name,s.snapshot->'offer'->>'meal' as meal,
 case when s.legacy then 'external_reported' else 'catera' end as payment_route,
 (select count(*) from v1.delivery_days d where d.subscription_id=s.id and d.status not in('cancelled','delivered')) as remaining,
 (select min(service_date) from v1.delivery_days d where d.subscription_id=s.id and d.status not in('cancelled','delivered')) as next_delivery,
 case when exists(select 1 from v1.subscriptions n where n.renewed_from=s.id and n.status<>'cancelled' and not n.legacy) then 'catera'
 when exists(select 1 from v1.subscriptions n where n.renewed_from=s.id and n.status<>'cancelled' and n.legacy) then 'external_reported'
 else coalesce((select kind from v1.pilot_followups where subscription_id=s.id and kind in('declined','unknown') order by created_at desc limit 1),'unknown') end as renewal_status,
 (select max(created_at) from v1.pilot_followups where subscription_id=s.id and kind='prepared') as prepared_at,
 case when detail then coalesce((select jsonb_agg(v1.delivery(d) order by d.service_date) from v1.delivery_days d where d.subscription_id=s.id),'[]') else '[]'::jsonb end as deliveries
 from v1.subscriptions s where s.customer_record_id=cr.id order by s.starts_on desc limit 100)x),'[]'))
$$;

create function v1.pilot_renewal(s v1.subscriptions,pid uuid default null) returns jsonb language plpgsql stable set search_path='' as $$
declare p v1.packages;o jsonb;ad jsonb;aid uuid;start_day date;d date;attempt int:=0;n int;available boolean;begin
 select * into p from v1.packages where id=coalesce(pid,s.package_id) and caterer_id=(s.snapshot->'offer'->>'catererId')::uuid;
 if not found then raise exception 'NOT_FOUND';end if;
 if s.status='cancelled' then raise exception 'INVALID_STATE';end if;
 o:=v1.offer(p);select address into ad from v1.delivery_days where subscription_id=s.id and status<>'cancelled' order by service_date desc limit 1;
 ad:=coalesce(ad,s.snapshot->'address');
 select id into aid from v1.addresses where user_id=s.user_id and line=ad->>'line' and area=ad->>'area' and city=ad->>'city' order by id limit 1;
 start_day:=greatest(coalesce((select max(dd.service_date)+1 from v1.delivery_days dd join v1.subscriptions ss on ss.id=dd.subscription_id
 where (ss.id=s.id or ss.user_id=s.user_id or ss.customer_record_id=s.customer_record_id) and ss.snapshot->'offer'->>'catererId'=o->>'catererId' and dd.status<>'cancelled'),s.ends_on+1),
 (select max((cc.quote->'dates'->>-1)::date)+1 from v1.checkouts cc where cc.user_id=s.user_id and cc.state='pending' and cc.expires_at>clock_timestamp() and cc.quote->'offer'->>'catererId'=o->>'catererId'),
 (statement_timestamp() at time zone (o->>'timezone'))::date+1);
 if p.status='published' and o->>'sellerStatus'='approved' then
  loop
   d:=start_day;n:=0;available:=true;
   while n<(o->>'days')::int and d<start_day+730 loop
    if o->'weekdays' @> to_jsonb(extract(dow from d)::int) and not exists(select 1 from v1.capacity where package_id=p.id and service_date=d and closed) then
     if v1.cutoff(o,d)<=statement_timestamp() or v1.slots(p.id,d)-v1.demand(p.id,d)<s.portions then available:=false;exit;end if;n:=n+1;
    end if;d:=d+1;
   end loop;
   exit when (available and n=(o->>'days')::int) or attempt>=730;
   start_day:=start_day+1;attempt:=attempt+1;
  end loop;
 end if;
 return jsonb_build_object('subscriptionId',s.id,'packageId',p.id,'portions',s.portions,'address',ad,'addressId',aid,'startDate',start_day,
 'replacementRequired',p.status<>'published' or o->>'sellerStatus'<>'approved','available',coalesce(available,false) and attempt<730,
 'offers',coalesce((select jsonb_agg(v1.offer(x) order by x.slug) from v1.packages x where x.caterer_id=p.caterer_id and x.status='published'),'[]'));
end $$;

create function v1.pilot_metrics(cid uuid,first_day date,last_day date) returns jsonb language plpgsql stable set search_path='' as $$
declare revenue bigint;gmv bigint;promos bigint;monthly bigint;expenses bigint;refund_cost bigint;missing text[];cohorts jsonb;renewals jsonb;begin
 select coalesce(sum(pay.amount),0),coalesce(sum((c.quote->>'serviceFee')::bigint+(c.quote->>'sellerFee')::bigint),0),coalesce(sum((c.quote->>'promotion')::bigint),0)
 into gmv,revenue,promos from v1.payments pay join v1.checkouts c on c.id=pay.checkout_id join v1.packages p on p.id=c.package_id
 where p.caterer_id=cid and pay.state='paid' and (c.quote->'pricingPolicy'->>'synthetic')::boolean=(v1.pilot_policy(cid)).synthetic and c.quote->>'purchaseKind' is distinct from 'legacy_import' and pay.created_at>=first_day and pay.created_at<last_day+1;
 select coalesce(sum(case e.kind when 'payment' then e.amount when 'refund' then -e.amount else 0 end),0) into monthly
 from v1.pilot_invoice_entries e join v1.pilot_invoices i on i.id=e.invoice_id where i.caterer_id=cid and (select synthetic from v1.pilot_pricing where id=i.pricing_id)=(v1.pilot_policy(cid)).synthetic and e.created_at>=first_day and e.created_at<last_day+1;
 select coalesce(sum(amount),0) into expenses from v1.pilot_observations where caterer_id=cid and synthetic=(v1.pilot_policy(cid)).synthetic and observed_on between first_day and last_day and kind in('processing','payout','incentive','support');
 select array_agg(k) into missing from unnest(array['processing','payout','incentive','support']) k where not exists(select 1 from v1.pilot_observations where caterer_id=cid and synthetic=(v1.pilot_policy(cid)).synthetic and kind=k and amount is not null and observed_on between first_day and last_day) or exists(select 1 from v1.pilot_observations where caterer_id=cid and synthetic=(v1.pilot_policy(cid)).synthetic and kind=k and amount is null and observed_on between first_day and last_day);
 select coalesce(sum(r.amount-coalesce((r.reconciliation->>'sellerDeduction')::int,0)),0) into refund_cost from v1.refunds r join v1.checkouts c on c.id=r.checkout_id join v1.packages p on p.id=c.package_id
 where p.caterer_id=cid and (c.quote->'pricingPolicy'->>'synthetic')::boolean=(v1.pilot_policy(cid)).synthetic and r.state='succeeded' and r.created_at>=first_day and r.created_at<last_day+1;
 if exists(select 1 from v1.refunds r join v1.checkouts c on c.id=r.checkout_id join v1.packages p on p.id=c.package_id where p.caterer_id=cid and (c.quote->'pricingPolicy'->>'synthetic')::boolean=(v1.pilot_policy(cid)).synthetic and r.state='succeeded' and r.reconciliation is null and r.created_at>=first_day and r.created_at<last_day+1) then missing:=array_append(coalesce(missing,'{}'),'refund_reconciliation');end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into cohorts from(
 select case when c.quote->>'source'='marketplace' then 'marketplace' else 'seller' end origin,count(*) payments,sum(pay.amount) gmv,
 sum((c.quote->>'serviceFee')::int+(c.quote->>'sellerFee')::int) fees
 from v1.payments pay join v1.checkouts c on c.id=pay.checkout_id join v1.packages p on p.id=c.package_id
 where p.caterer_id=cid and pay.state='paid' and c.quote->>'purchaseKind' is distinct from 'legacy_import' and pay.created_at>=first_day and pay.created_at<last_day+1 group by 1)x;
 select jsonb_build_object('eligible',count(*),'catera',count(*) filter(where route='catera'),'externalReported',count(*) filter(where route='external_reported'),'unknown',count(*) filter(where route='unknown')) into renewals from(
 select case when exists(select 1 from v1.subscriptions n join v1.payments py on py.checkout_id=n.checkout_id and py.state='paid' where n.renewed_from=s.id and not n.legacy and n.status<>'cancelled') then 'catera'
 when exists(select 1 from v1.subscriptions n where n.renewed_from=s.id and n.legacy and n.status<>'cancelled') then 'external_reported' else 'unknown' end route
 from v1.subscriptions s join v1.packages p on p.id=s.package_id where p.caterer_id=cid and s.status<>'cancelled' and not coalesce((s.snapshot->>'trial')::boolean,false)
 and coalesce((s.snapshot->'pricingPolicy'->>'synthetic')::boolean,(s.snapshot->>'pilotSynthetic')::boolean)=(v1.pilot_policy(cid)).synthetic
 and s.ends_on between first_day and last_day and (select count(*) from v1.delivery_days where subscription_id=s.id and status not in('delivered','cancelled'))<=3)x;
 return jsonb_build_object('sellerRetention',coalesce((select jsonb_agg(jsonb_build_object('day',n,'mature',e.starts_on+n-1<=least(last_day,current_date),
 'stillEnrolled',case when e.starts_on+n-1>least(last_day,current_date) then null else e.exited_on is null or e.exited_on>e.starts_on+n-1 end,
 'paid',case when e.starts_on+n-1>least(last_day,current_date) then null else (select coalesce(sum(case ie.kind when 'payment' then ie.amount when 'refund' then -ie.amount else 0 end),0)>0 from v1.pilot_invoice_entries ie join v1.pilot_invoices iv on iv.id=ie.invoice_id
 where iv.caterer_id=cid and (select synthetic from v1.pilot_pricing where id=iv.pricing_id)=(v1.pilot_policy(cid)).synthetic and ie.created_at::date between e.starts_on+n-30 and e.starts_on+n-1)
 or exists(select 1 from v1.payments py join v1.checkouts ch on ch.id=py.checkout_id join v1.packages pk on pk.id=ch.package_id
 where pk.caterer_id=cid and py.state='paid' and ch.state not in('refunded','payment_exception') and (ch.quote->'pricingPolicy'->>'synthetic')::boolean=(v1.pilot_policy(cid)).synthetic and (ch.quote->>'sellerFee')::numeric>0 and py.created_at::date between e.starts_on+n-30 and e.starts_on+n-1) end) order by n)
 from v1.pilot_enrollments e cross join unnest(array[30,60,90]) n where e.caterer_id=cid),'[]'),
 'dataMode',case when (v1.pilot_policy(cid)).synthetic then 'synthetic' else 'commercial' end,
 'unclassifiedGmv',(select coalesce(sum(py.amount),0) from v1.payments py join v1.checkouts ch on ch.id=py.checkout_id join v1.packages pk on pk.id=ch.package_id where pk.caterer_id=cid and py.state='paid' and ch.quote->'pricingPolicy'->>'synthetic' is null and py.created_at>=first_day and py.created_at<last_day+1),
 'from',first_day,'to',last_day,'processedGmv',gmv,'platformFees',revenue,'monthlyCollected',monthly,'promotionCosts',promos,'recordedCosts',expenses,'refundCosts',refund_cost,
 'missingCosts',to_jsonb(coalesce(missing,'{}')),'contribution',case when cardinality(coalesce(missing,'{}'))=0 then revenue+monthly-promos-expenses-refund_cost else null end,'cohorts',cohorts,'renewals',renewals,
 'onboardingCosts',(select sum(amount) from v1.pilot_observations where caterer_id=cid and synthetic=(v1.pilot_policy(cid)).synthetic and kind='onboarding' and observed_on between first_day and last_day),
 'acquisitionCosts',(select sum(amount) from v1.pilot_observations where caterer_id=cid and synthetic=(v1.pilot_policy(cid)).synthetic and kind='acquisition' and observed_on between first_day and last_day),
 'baselineMinutesPerDay',(select round(sum(minutes)::numeric/nullif(sum(sample_days),0),1) from v1.pilot_observations where caterer_id=cid and synthetic=(v1.pilot_policy(cid)).synthetic and kind='admin_baseline' and observed_on between first_day and last_day),
 'currentMinutesPerDay',(select round(sum(minutes)::numeric/nullif(sum(sample_days),0),1) from v1.pilot_observations where caterer_id=cid and synthetic=(v1.pilot_policy(cid)).synthetic and kind='admin_current' and observed_on between first_day and last_day),
 'assistanceMinutes',(select sum(minutes) from v1.pilot_observations where caterer_id=cid and synthetic=(v1.pilot_policy(cid)).synthetic and kind='assistance' and observed_on between first_day and last_day),
 'deliveryIssues',(select count(*) from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=cid and f.status='issue' and d.service_date between first_day and last_day));
end $$;
create function v1.quote(u uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$
declare q jsonb;s v1.subscriptions;p v1.pilot_pricing;begin
 q:=v1.quote_pilot_base(u,a);
 select * into p from v1.pilot_pricing where caterer_id=(q->'offer'->>'catererId')::uuid and approved and effective_at<=statement_timestamp() order by effective_at desc limit 1;
 if not found then q:=q||jsonb_build_object('pricingPolicy',jsonb_build_object('id','global','model','transaction','cohort','global','synthetic',(v1.pilot_policy((q->'offer'->>'catererId')::uuid)).synthetic));end if;
 if found then q:=q||jsonb_build_object('pricingPolicy',jsonb_build_object('id',p.id,'model',p.model,'cohort',p.cohort,'monthlyFee',p.monthly_fee,'serviceFee',p.service_fee,'marketplacePercent',p.marketplace_percent,'invitedPercent',case when p.model='monthly' then 0 else p.invited_percent end,'approved',p.approved,'synthetic',p.synthetic,'effectiveAt',p.effective_at));end if;
 if nullif(a->>'renewedFrom','') is not null then
  select * into s from v1.subscriptions where id=(a->>'renewedFrom')::uuid and user_id=u;
  if not found or s.status='cancelled' or (s.snapshot->'offer'->>'catererId') is distinct from (q->'offer'->>'catererId') or coalesce((q->>'trial')::boolean,false) then raise exception 'FORBIDDEN';end if;
  if (q->'dates'->>0)::date<=coalesce((select max(service_date) from v1.delivery_days where subscription_id=s.id and status<>'cancelled'),s.ends_on) then raise exception 'OVERLAP';end if;
  if exists(select 1 from v1.subscriptions where renewed_from=s.id and status<>'cancelled') or exists(select 1 from v1.checkouts where quote->>'renewedFrom'=s.id::text and state='pending' and expires_at>clock_timestamp()) then raise exception 'CONFLICT';end if;
  q:=q||jsonb_build_object('renewedFrom',s.id);
 end if;return q;end $$;

create function v1.pilot_subscription_link() returns trigger language plpgsql set search_path='' as $$
declare cid uuid;r uuid;begin
 if new.legacy then return new;end if;
 cid:=(new.snapshot->'offer'->>'catererId')::uuid;
 new.renewed_from:=nullif(new.snapshot->>'renewedFrom','')::uuid;
 if new.renewed_from is not null then
  select customer_record_id into r from v1.subscriptions where id=new.renewed_from and user_id=new.user_id;
 end if;
 if r is null then select id into r from v1.customer_records where user_id=new.user_id and caterer_id=cid order by created_at,id limit 1;end if;
 if r is null then insert into v1.customer_records(caterer_id,user_id,name,address,origin)
  select cid,new.user_id,name,coalesce(new.snapshot->'address','{}'),case when new.snapshot->>'source'='marketplace' then 'marketplace' else 'seller' end from v1.profiles where id=new.user_id returning id into r;end if;
 new.customer_record_id:=r;update v1.checkouts set customer_record_id=r where id=new.checkout_id;return new;
end $$;
create trigger pilot_subscription_link before insert on v1.subscriptions for each row execute function v1.pilot_subscription_link();

create function v1.pilot_import_row(cid uuid,a jsonb,commit_row boolean) returns jsonb language plpgsql set search_path='' as $$
declare cr v1.customer_records;p v1.packages;o jsonb;ad jsonb;dt date;dates jsonb:='[]';qty int;needed int;counter int:=0;
 q jsonb;co uuid;sid uuid;did uuid;m text;ref text;prior v1.subscriptions;new_customer boolean:=false;begin
 if nullif(a->>'customerRecordId','') is not null then select * into cr from v1.customer_records where id=(a->>'customerRecordId')::uuid and caterer_id=cid;
  if not found then raise exception 'FORBIDDEN';end if;
 elsif nullif(a->>'customerId','') is not null then
  select * into cr from v1.customer_records where user_id=(a->>'customerId')::uuid and caterer_id=cid order by created_at,id limit 1;
  if not found then
   if not exists(select 1 from v1.relationships where user_id=(a->>'customerId')::uuid and caterer_id=cid) then raise exception 'FORBIDDEN';end if;
   cr.user_id:=(a->>'customerId')::uuid;select name into cr.name from v1.profiles where id=cr.user_id;cr.origin:='seller';new_customer:=true;
  end if;
 else
  cr.name:=trim(a->'customer'->>'name');cr.phone:=a->'customer'->>'phone';cr.address:=a->'customer'->'address';cr.origin:='seller';new_customer:=true;
  if cr.name is null or length(cr.name) not between 1 and 100 or cr.phone is null or cr.phone !~ '^\+62[0-9]{8,13}$' then raise exception 'INVALID_INPUT';end if;
  if exists(select 1 from v1.customer_records where caterer_id=cid and phone=cr.phone) then raise exception 'DUPLICATE_CUSTOMER';end if;
 end if;
 ad:=coalesce(a->'address',cr.address);
 if nullif(a->>'addressId','') is not null then select to_jsonb(x)-'user_id' into ad from v1.addresses x where id=(a->>'addressId')::uuid and user_id=cr.user_id;end if;
 if not v1.pilot_address(ad) then raise exception 'INVALID_INPUT';end if;
 select * into p from v1.packages where id=(a->>'packageId')::uuid and caterer_id=cid;
 if not found then raise exception 'FORBIDDEN';end if;o:=v1.offer(p);
 if p.status<>'published' or o->>'sellerStatus'<>'approved' then raise exception 'NOT_AVAILABLE';end if;
 if not(o->'areas' ? (ad->>'area')) then raise exception 'COVERAGE';end if;
 qty:=(a->>'portions')::int;needed:=(a->>'remainingDays')::int;dt:=(a->>'startDate')::date;ref:=trim(a->>'externalReference');
 if qty is null or qty not between 1 and 100 or needed is null or needed not between 1 and (o->>'days')::int or dt is null or ref is null or length(ref) not between 3 and 120 then raise exception 'INVALID_INPUT';end if;
 if cr.id is not null and exists(select 1 from v1.subscriptions where customer_record_id=cr.id and external_reference=ref) then raise exception 'DUPLICATE_IMPORT';end if;
 while jsonb_array_length(dates)<needed and counter<730 loop
  if o->'weekdays' @> to_jsonb(extract(dow from dt)::int) and not exists(select 1 from v1.capacity where package_id=p.id and service_date=dt and closed) then
   if v1.cutoff(o,dt)<=clock_timestamp() then raise exception 'CUTOFF';end if;
   if v1.slots(p.id,dt)-v1.demand(p.id,dt)<qty then raise exception 'CAPACITY';end if;dates:=dates||to_jsonb(dt::text);
  end if;dt:=dt+1;counter:=counter+1;
 end loop;
 if jsonb_array_length(dates)<>needed then raise exception 'INVALID_DATE';end if;
 if exists(select 1 from v1.subscriptions where package_id=p.id and status='active' and (customer_record_id=cr.id or user_id=cr.user_id) and starts_on<=(dates->>-1)::date and ends_on>=(dates->>0)::date)
 or exists(select 1 from v1.checkouts where package_id=p.id and state='pending' and expires_at>clock_timestamp() and (customer_record_id=cr.id or user_id=cr.user_id) and (quote->'dates'->>0)::date<=(dates->>-1)::date and (quote->'dates'->>-1)::date>=(dates->>0)::date) then raise exception 'OVERLAP';end if;
 if nullif(a->>'renewedFrom','') is not null then
  select * into prior from v1.subscriptions where id=(a->>'renewedFrom')::uuid and customer_record_id=cr.id;
  if not found or prior.status='cancelled' or exists(select 1 from v1.subscriptions where renewed_from=prior.id and status<>'cancelled')
   or exists(select 1 from v1.checkouts where quote->>'renewedFrom'=prior.id::text and state='pending' and expires_at>clock_timestamp()) then raise exception 'CONFLICT';end if;
  if (dates->>0)::date<=prior.ends_on then raise exception 'OVERLAP';end if;
 end if;
 q:=jsonb_build_object('packageId',p.id,'portions',qty,'trial',false,'dates',dates,'subtotal',0,'discount',0,'discountPercent',0,'promotion',0,'serviceFee',0,'sellerFee',0,'total',0,'perDay',0,
  'source','legacy','purchaseKind','legacy_import','pilotSynthetic',(v1.pilot_policy(cid)).synthetic,'externalReference',ref,'externalAmount',a->'externalAmount','renewedFrom',prior.id,'offer',o,'address',ad);
 if not commit_row then return jsonb_build_object('customerName',cr.name,'customerRecordId',cr.id,'newCustomer',new_customer,'quote',q);end if;
 if a ? 'preview' and a->'preview' is distinct from q then raise exception 'PRICE_CHANGED';end if;
 if new_customer then insert into v1.customer_records(caterer_id,user_id,name,phone,address,origin) values(cid,cr.user_id,cr.name,cr.phone,ad,cr.origin) returning * into cr;end if;
 insert into v1.checkouts(user_id,customer_record_id,package_id,address_id,quote,state,expires_at)
 values(cr.user_id,cr.id,p.id,null,q,'paid',now()) returning id into co;
 insert into v1.subscriptions(checkout_id,user_id,customer_record_id,package_id,snapshot,portions,starts_on,ends_on,legacy,external_reference,renewed_from)
 values(co,cr.user_id,cr.id,p.id,q,qty,(dates->>0)::date,(dates->>-1)::date,true,ref,prior.id) returning id into sid;
 update v1.checkouts set subscription_id=sid where id=co;
 for dt in select value::date from jsonb_array_elements_text(dates) loop
  insert into v1.reservations values(co,p.id,dt,qty,'confirmed');
  insert into v1.delivery_days(subscription_id,service_date,address) values(sid,dt,ad) returning id into did;
  foreach m in array case when o->>'meal'='both' then array['lunch','dinner'] else array[o->>'meal'] end loop insert into v1.fulfillments(day_id,meal) values(did,m);end loop;
 end loop;
 if cr.user_id is not null then insert into v1.relationships values(cr.user_id,cid,'legacy') on conflict do nothing;end if;
 return jsonb_build_object('id',sid,'customerRecordId',cr.id);
end $$;

create function v1.pilot_followup_due(record_id uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from v1.subscriptions s where s.customer_record_id=record_id and s.status<>'cancelled' and not coalesce((s.snapshot->>'trial')::boolean,false)
 and (select count(*) from v1.delivery_days d where d.subscription_id=s.id and d.status not in('cancelled','delivered'))<=3
 and not exists(select 1 from v1.subscriptions n where n.renewed_from=s.id and n.status<>'cancelled'))
$$;
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_pilot_base;
revoke all on function public.catera_v1_read_pilot_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();cid uuid;s v1.subscriptions;r jsonb;dt date;first_day date;last_day date;begin
 if resource in('seller-customers','pilot') then
  cid:=(params->>'id')::uuid;
  if u is null or cid is null or not(v1.is_staff(u,cid,resource='pilot') or v1.is_admin(u)) then raise exception 'FORBIDDEN';end if;
  if resource='seller-customers' then
   return jsonb_build_object('customers',coalesce((select jsonb_agg(v1.pilot_customer(x,params ? 'customerRecordId') order by x.name,x.id) from (
    select * from v1.customer_records where caterer_id=cid and (params->>'followup' is distinct from 'true' or v1.pilot_followup_due(id)) and (not(params ? 'customerRecordId') or id=(params->>'customerRecordId')::uuid)
    order by name,id limit 100 offset greatest(coalesce((params->>'offset')::int,0),0))x),'[]'),
    'total',(select count(*) from v1.customer_records where caterer_id=cid and (params->>'followup' is distinct from 'true' or v1.pilot_followup_due(id))),
    'packages',coalesce((select jsonb_agg(v1.offer(p) order by p.slug) from v1.packages p where p.caterer_id=cid and p.status='published'),'[]'));
  end if;
  first_day:=coalesce((params->>'from')::date,date_trunc('month',current_date)::date);last_day:=coalesce((params->>'to')::date,current_date);
  if last_day<first_day or last_day-first_day>366 then raise exception 'INVALID_INPUT';end if;
  return jsonb_build_object('enrollment',(select to_jsonb(e) from v1.pilot_enrollments e where caterer_id=cid),
   'readiness',jsonb_build_object('schema','paid_seller_pilot_v1','lastMaintenance',(select max(created_at) from v1.audit where action='system.maintenance'),
   'syntheticPolicy',(v1.pilot_policy(cid)).synthetic,'approvedPolicy',(v1.pilot_policy(cid)).approved),
   'policies',coalesce((select jsonb_agg(to_jsonb(p) order by effective_at desc) from v1.pilot_pricing p where caterer_id=cid),'[]'),
   'invoices',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('entries',coalesce((select jsonb_agg(to_jsonb(e) order by created_at) from v1.pilot_invoice_entries e where invoice_id=i.id),'[]')) order by period desc) from v1.pilot_invoices i where caterer_id=cid),'[]'),
   'observations',case when v1.is_admin(u) then coalesce((select jsonb_agg(to_jsonb(o) order by observed_on desc) from v1.pilot_observations o where caterer_id=cid and observed_on between first_day and last_day),'[]') else '[]'::jsonb end,
   'metrics',case when v1.is_admin(u) then v1.pilot_metrics(cid,first_day,last_day) else null end);
 elsif resource='renewal-context' then
  select * into s from v1.subscriptions where id=(params->>'id')::uuid and user_id=u;
  if not found then raise exception 'FORBIDDEN';end if;
  return v1.pilot_renewal(s,nullif(params->>'packageId','')::uuid);
 end if;
 r:=public.catera_v1_read_pilot_base(resource,params);
 if resource in('seller','admin') then
  r:=r||jsonb_build_object('cases',coalesce((select jsonb_agg(x||jsonb_build_object('customerName',coalesce(cr.name,pf.name),'customerRecordId',cr.id))
   from jsonb_array_elements(r->'cases') x left join v1.customer_records cr on cr.id=(x->>'customer_record_id')::uuid left join v1.profiles pf on pf.id=(x->>'user_id')::uuid),'[]'));
 end if;
 if resource='seller' then
  cid:=(params->>'id')::uuid;dt:=coalesce((r->>'operationalDate')::date,(params->>'date')::date,current_date);
  r:=r||jsonb_build_object('deliveries',coalesce((select jsonb_agg(v1.delivery(d)||jsonb_build_object('customer',jsonb_build_object('id',coalesce(sub.user_id,sub.customer_record_id),'name',coalesce(cr.name,pf.name))) order by d.id)
   from v1.delivery_days d join v1.subscriptions sub on sub.id=d.subscription_id join v1.packages p on p.id=sub.package_id
   left join v1.customer_records cr on cr.id=sub.customer_record_id left join v1.profiles pf on pf.id=sub.user_id where p.caterer_id=cid and d.service_date=dt),'[]'));
 end if;return r;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

do $$ declare def text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into def;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_pilot_base;
 def:=replace(replace(def,'public.catera_v1_command(','public.catera_v1_command_pilot_base('),'catera_v1_command.request_id','catera_v1_command_pilot_base.request_id');execute def;
end $$;
revoke all on function public.catera_v1_command_pilot_base(text,jsonb,uuid) from public,anon,authenticated;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old v1.receipts;fingerprint text:=md5(action||payload::text);r jsonb;cid uuid;cr v1.customer_records;rows jsonb;q jsonb;rowdata jsonb;
 ident uuid;token text;s v1.subscriptions;d v1.delivery_days;p v1.packages;dt date;ad jsonb;pricing v1.pilot_pricing;inv v1.pilot_invoices;due bigint;paid bigint;amt int;begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action not in('customer.save','customer.invite','customer.followup','customer.deliveryChange','import.preview','import.commit','pilot.pricing','pilot.invoice','pilot.invoiceEntry','pilot.observation','pilot.enroll','pilot.exit') then
  if action='checkout.create' or action in('delivery.reschedule','delivery.address') then
   perform pg_advisory_xact_lock(hashtext(u::text));
   if action='checkout.create' then select caterer_id into cid from v1.packages where id=(payload->>'packageId')::uuid;
   else select pk.caterer_id into cid from v1.delivery_days dd join v1.subscriptions ss on ss.id=dd.subscription_id join v1.packages pk on pk.id=ss.package_id where dd.id=(payload->>'id')::uuid;end if;
   perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
  end if;
  return public.catera_v1_command_pilot_base(action,payload,request_id);end if;
 if request_id is null then raise exception 'INVALID_INPUT';end if;perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 cid:=(payload->>'catererId')::uuid;
 if cid is null or not(v1.is_staff(u,cid,action not in('customer.followup','customer.deliveryChange')) or v1.is_admin(u)) then raise exception 'FORBIDDEN';end if;
 if action like 'pilot.%' and not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
 if action='customer.save' then
  if length(trim(payload->>'name')) not between 1 and 100 or payload->>'name' is null or payload->>'phone' is null or payload->>'phone' !~ '^\+62[0-9]{8,13}$' or not v1.pilot_address(payload->'address') then raise exception 'INVALID_INPUT';end if;
  if nullif(payload->>'id','') is null then
   if exists(select 1 from v1.customer_records where caterer_id=cid and phone=payload->>'phone' and name=trim(payload->>'name')) then raise exception 'DUPLICATE_CUSTOMER';end if;
   insert into v1.customer_records(caterer_id,name,phone,address,origin) values(cid,trim(payload->>'name'),payload->>'phone',payload->'address','seller') returning id into ident;
  else
   select * into cr from v1.customer_records where id=(payload->>'id')::uuid and caterer_id=cid for update;
   if not found or cr.version is distinct from (payload->>'version')::int then raise exception 'CONFLICT';end if;
   update v1.customer_records set name=trim(payload->>'name'),phone=payload->>'phone',address=payload->'address',version=version+1,claim_review=null where id=cr.id returning id into ident;
   if cr.phone is distinct from payload->>'phone' then update v1.customer_claims set expires_at=now() where customer_record_id=cr.id and used_at is null;end if;
  end if;r:=jsonb_build_object('id',ident);
 elsif action='customer.invite' then
  select * into cr from v1.customer_records where id=(payload->>'customerRecordId')::uuid and caterer_id=cid for update;
  if not found or cr.phone is null or cr.user_id is not null then raise exception 'INVALID_STATE';end if;
  update v1.customer_claims set expires_at=now() where customer_record_id=cr.id and used_at is null;
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into v1.customer_claims(customer_record_id,token_hash,expires_at,created_by) values(cr.id,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '7 days',u);
  r:=jsonb_build_object('path','/claim/'||token,'phone',cr.phone);
 elsif action in('import.preview','import.commit') then
  -- Package locks serialize previews/commits with checkout, claiming and kitchen changes.
  if action='import.preview' then rows:=payload->'rows';
  else select i.rows into rows from v1.imports i where id=(payload->>'id')::uuid and caterer_id=cid and state='preview' for update;if not found then raise exception 'CONFLICT';end if;end if;
  if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows) not between 1 and 100 then raise exception 'INVALID_INPUT';end if;
  perform id from v1.packages where id in(select (j->>'packageId')::uuid from jsonb_array_elements(rows)j) order by id for update;
  q:='[]';for rowdata in select * from jsonb_array_elements(rows) loop
   r:=v1.pilot_import_row(cid,rowdata,action='import.commit');
   q:=q||jsonb_build_array(case when action='import.preview' then rowdata||jsonb_build_object('preview',r->'quote','customerName',r->>'customerName','newCustomer',r->'newCustomer') else r end);
  end loop;
  if action='import.preview' then
   if exists(select 1 from jsonb_array_elements(q) with ordinality a(x,n),jsonb_array_elements(q) with ordinality b(y,m)
    where n<m and coalesce(x->>'customerRecordId',x->>'customerId',x->'customer'->>'phone')=coalesce(y->>'customerRecordId',y->>'customerId',y->'customer'->>'phone')
    and ((x ? 'customer') or x->>'externalReference'=y->>'externalReference' or (x->>'packageId'=y->>'packageId' and (x->'preview'->'dates'->>0)::date<=(y->'preview'->'dates'->>-1)::date and (x->'preview'->'dates'->>-1)::date>=(y->'preview'->'dates'->>0)::date))) then raise exception 'DUPLICATE_IMPORT';end if;
   if exists(select 1 from (select (x->>'packageId')::uuid pid,z.service_day::date as service_day,sum((x->>'portions')::int) portions from jsonb_array_elements(q)x cross join lateral jsonb_array_elements_text(x->'preview'->'dates')z(service_day) group by 1,2)a where a.portions>v1.slots(a.pid,a.service_day)-v1.demand(a.pid,a.service_day)) then raise exception 'CAPACITY';end if;
   insert into v1.imports(caterer_id,created_by,rows) values(cid,u,q) returning id into ident;r:=jsonb_build_object('id',ident,'rows',q);
  else update v1.imports set state='committed' where id=(payload->>'id')::uuid;r:=jsonb_build_object('id',payload->>'id','subscriptions',q);end if;
 elsif action='customer.followup' then
  select * into s from v1.subscriptions where id=(payload->>'subscriptionId')::uuid and customer_record_id in(select id from v1.customer_records where caterer_id=cid);
  if not found then raise exception 'FORBIDDEN';end if;
  insert into v1.pilot_followups(subscription_id,actor_id,kind,note) values(s.id,u,payload->>'kind',left(coalesce(payload->>'note',''),500)) returning id into ident;r:=jsonb_build_object('id',ident,'path','/renew/'||s.id);
 elsif action='customer.deliveryChange' then
  if length(trim(payload->>'reason'))<5 or payload->>'reason' is null then raise exception 'INVALID_INPUT';end if;
  select s0.* into s from v1.subscriptions s0 join v1.delivery_days dd on dd.subscription_id=s0.id where dd.id=(payload->>'id')::uuid and s0.customer_record_id in(select id from v1.customer_records where caterer_id=cid);
  if not found then raise exception 'FORBIDDEN';end if;
  select * into p from v1.packages where id=s.package_id for update;select * into s from v1.subscriptions where id=s.id for update;
  select * into d from v1.delivery_days where id=(payload->>'id')::uuid for update;
  if d.version is distinct from (payload->>'version')::int then raise exception 'CONFLICT';end if;
  if d.status<>'scheduled' or v1.cutoff(s.snapshot->'offer',d.service_date)<=clock_timestamp() then raise exception 'CUTOFF';end if;
  if payload ? 'date' then
   dt:=(payload->>'date')::date;
   if not coalesce((s.snapshot->'offer'->>'flexible')::boolean,false) then raise exception 'FIXED_PACKAGE';end if;
   if dt is null or not(s.snapshot->'offer'->'weekdays' @> to_jsonb(extract(dow from dt)::int)) then raise exception 'INVALID_DATE';end if;
   if v1.cutoff(s.snapshot->'offer',dt)<=clock_timestamp() then raise exception 'CUTOFF';end if;
   if exists(select 1 from v1.delivery_days where subscription_id=s.id and service_date=dt) then raise exception 'DUPLICATE_DATE';end if;
   if v1.slots(p.id,dt)-v1.demand(p.id,dt)<s.portions then raise exception 'CAPACITY';end if;
   if exists(select 1 from v1.subscriptions x where x.id<>s.id and x.package_id=p.id and (x.user_id=s.user_id or x.customer_record_id=s.customer_record_id) and x.status='active' and x.starts_on<=greatest(s.ends_on,dt) and x.ends_on>=least(s.starts_on,dt))
   or exists(select 1 from v1.checkouts x where x.id<>s.checkout_id and x.package_id=p.id and (x.user_id=s.user_id or x.customer_record_id=s.customer_record_id) and x.state='pending' and x.expires_at>clock_timestamp() and (x.quote->'dates'->>0)::date<=greatest(s.ends_on,dt) and (x.quote->'dates'->>-1)::date>=least(s.starts_on,dt)) then raise exception 'OVERLAP';end if;
   insert into v1.reservations values(s.checkout_id,p.id,dt,s.portions,'confirmed');delete from v1.reservations where checkout_id=s.checkout_id and service_date=d.service_date;
   update v1.delivery_days set service_date=dt,version=version+1 where id=d.id;
   update v1.subscriptions set starts_on=(select min(service_date) from v1.delivery_days where subscription_id=s.id),ends_on=(select max(service_date) from v1.delivery_days where subscription_id=s.id) where id=s.id;
  elsif payload ? 'address' then
   ad:=payload->'address';if not v1.pilot_address(ad) then raise exception 'INVALID_INPUT';end if;
   if not(s.snapshot->'offer'->'areas' ? (ad->>'area')) then raise exception 'COVERAGE';end if;
   update v1.delivery_days set address=ad,version=version+1 where id=d.id;
  else raise exception 'INVALID_INPUT';end if;
  perform v1.notify(s.user_id,'change','Katerer memperbarui pengantaran sesuai permintaan Anda.','/deliveries/'||d.id);r:=jsonb_build_object('id',d.id);
 elsif action='pilot.enroll' then
  select * into pricing from v1.pilot_pricing where id=(payload->>'pricingId')::uuid and caterer_id=cid and approved;
  if not found or not exists(select 1 from v1.caterers where id=cid and status='approved') or not exists(select 1 from v1.packages where caterer_id=cid and status='published') then raise exception 'INVALID_STATE';end if;
  dt:=(payload->>'startDate')::date;
  if dt<pricing.effective_at::date then raise exception 'INVALID_DATE';end if;
  insert into v1.pilot_enrollments(caterer_id,pricing_id,starts_on,ends_on,reference,actor_id) values(cid,pricing.id,dt,dt+89,payload->>'reference',u);
  r:=jsonb_build_object('id',cid);
 elsif action='pilot.exit' then
  dt:=(payload->>'date')::date;if dt is null or dt>current_date or length(trim(payload->>'reason'))<5 or payload->>'reason' is null then raise exception 'INVALID_INPUT';end if;
  update v1.pilot_enrollments set exited_on=dt where caterer_id=cid and exited_on is null;
  if not found then raise exception 'CONFLICT';end if;r:=jsonb_build_object('id',cid);
 elsif action='pilot.pricing' then
  insert into v1.pilot_pricing(caterer_id,model,cohort,effective_at,service_fee,marketplace_percent,invited_percent,monthly_fee,approved,synthetic,approved_by,reason)
  values(cid,payload->>'model',trim(payload->>'cohort'),(payload->>'effectiveAt')::timestamptz,(payload->>'serviceFee')::int,(payload->>'marketplacePercent')::numeric,(payload->>'invitedPercent')::numeric,(payload->>'monthlyFee')::int,(payload->>'approved')::boolean,(payload->>'synthetic')::boolean,u,payload->>'reason') returning id into ident;r:=jsonb_build_object('id',ident);
 elsif action='pilot.invoice' then
  select * into pricing from v1.pilot_pricing where id=(payload->>'pricingId')::uuid and caterer_id=cid and model='monthly' and approved;
  if not found then raise exception 'INVALID_STATE';end if;
  if (payload->>'period')::date<date_trunc('month',pricing.effective_at)::date then raise exception 'INVALID_DATE';end if;
  insert into v1.pilot_invoices(caterer_id,pricing_id,period,amount) values(cid,pricing.id,(payload->>'period')::date,pricing.monthly_fee) returning id into ident;r:=jsonb_build_object('id',ident);
 elsif action='pilot.invoiceEntry' then
  select * into inv from v1.pilot_invoices where id=(payload->>'invoiceId')::uuid and caterer_id=cid for update;if not found then raise exception 'FORBIDDEN';end if;
  amt:=(payload->>'amount')::int;if amt is null or amt=0 or (payload->>'kind'<>'adjustment' and amt<0) then raise exception 'AMOUNT_INVALID';end if;
  select inv.amount+coalesce(sum(amount) filter(where kind='adjustment'),0),coalesce(sum(case kind when 'payment' then amount when 'refund' then -amount else 0 end),0) into due,paid from v1.pilot_invoice_entries where invoice_id=inv.id;
  if payload->>'kind'='adjustment' then due:=due+amt;elsif payload->>'kind'='payment' then paid:=paid+amt;elsif payload->>'kind'='refund' then paid:=paid-amt;end if;
  if paid<0 or due<paid then raise exception 'AMOUNT_INVALID';end if;
  insert into v1.pilot_invoice_entries(invoice_id,kind,amount,reference,actor_id) values(inv.id,payload->>'kind',amt,payload->>'reference',u) returning id into ident;r:=jsonb_build_object('id',ident);
 elsif action='pilot.observation' then
  insert into v1.pilot_observations(caterer_id,observed_on,kind,amount,minutes,sample_days,reference,actor_id,synthetic)
  values(cid,(payload->>'date')::date,payload->>'kind',(payload->>'amount')::int,(payload->>'minutes')::int,coalesce((payload->>'sampleDays')::int,1),payload->>'reference',u,(v1.pilot_policy(cid)).synthetic) returning id into ident;r:=jsonb_build_object('id',ident);
 end if;
 insert into v1.audit(actor_id,action,details) values(u,action,jsonb_build_object('id',r->>'id','catererId',cid,'reason',payload->>'reason','requestId',request_id));
 insert into v1.receipts values(u,request_id,fingerprint,r);return r;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_pilot_base;
revoke all on function public.catera_v1_system_pilot_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;old v1.receipts;key uuid;h text;r jsonb;begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='pilot.releaseRecord' then return jsonb_build_object('capabilities',jsonb_build_object('sellerCustomers',true,'claiming',true,'renewals',true,'pilotPricing',true,'pilotReporting',true),
  'schemaVersion','paid_seller_pilot_v1','lastMaintenance',(select max(created_at) from v1.audit where action='system.maintenance'),
  'health',public.catera_v1_system_pilot_base('health','{}'),
  'globalPolicy',(select to_jsonb(p) from v1.policies p where id),
  'sellerPolicies',coalesce((select jsonb_agg(jsonb_build_object('catererId',caterer_id,'id',id,'model',model,'effectiveAt',effective_at,'approved',approved,'synthetic',synthetic)) from v1.pilot_pricing),'[]'));end if;
 if action='pilot.claim' then
  u:=(payload->>'userId')::uuid;key:=(payload->>'requestId')::uuid;h:=md5(payload::text);
  if u is null or key is null then raise exception 'INVALID_INPUT';end if;perform pg_advisory_xact_lock(hashtext(u::text));
  select * into old from v1.receipts where actor_id=u and request_id=key;
  if found then if old.hash<>h then raise exception 'CONFLICT';end if;return old.result;end if;
  r:=v1.pilot_claim(u,payload->>'token',payload->>'verifiedPhone');
  insert into v1.receipts values(u,key,h,r);return r;
 end if;return public.catera_v1_system_pilot_base(action,payload);
end $$;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
revoke all on all functions in schema v1 from public,anon,authenticated;

create function v1.pilot_renewal_schedule_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.service_date is distinct from old.service_date and (
 exists(select 1 from v1.checkouts c where c.quote->>'renewedFrom'=new.subscription_id::text and c.state='pending' and c.expires_at>clock_timestamp() and (c.quote->'dates'->>0)::date<=new.service_date)
 or exists(select 1 from v1.subscriptions s where s.renewed_from=new.subscription_id and s.status<>'cancelled' and s.starts_on<=new.service_date)) then raise exception 'OVERLAP';end if;
 return new;
end $$;
create trigger pilot_renewal_schedule_guard before update of service_date on v1.delivery_days for each row execute function v1.pilot_renewal_schedule_guard();

alter function v1.activate(uuid) rename to activate_pilot_base;
create function v1.activate(cid uuid) returns uuid language plpgsql set search_path='' as $$
declare c v1.checkouts;seller uuid;begin
 select * into c from v1.checkouts where id=cid;
 seller:=(c.quote->'offer'->>'catererId')::uuid;
 perform pg_advisory_xact_lock(hashtext('pilot:'||seller::text));
 if c.subscription_id is null and c.quote->>'renewedFrom' is not null and (
 exists(select 1 from v1.delivery_days d where d.subscription_id=(c.quote->>'renewedFrom')::uuid and d.status<>'cancelled' and d.service_date>=(c.quote->'dates'->>0)::date)
 or exists(select 1 from v1.subscriptions s where s.renewed_from=(c.quote->>'renewedFrom')::uuid and s.status<>'cancelled')) then
  update v1.checkouts set state='payment_exception' where id=cid;
  update v1.reservations set state='released' where checkout_id=cid;
  if not exists(select 1 from v1.support_cases where checkout_id=cid) then
   insert into v1.support_cases(user_id,caterer_id,checkout_id,subject,description,status) values(c.user_id,seller,cid,'Pembayaran perlu ditinjau','Jadwal perpanjangan telah berubah.','escalated');end if;
  return null;
 end if;
 return v1.activate_pilot_base(cid);
end $$;

-- Three remaining delivery days, including combined meal packages. Guest records
-- do not consume account notification dedupe keys before the account is claimed.
do $$ declare f record;definition text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'catera_v1_system%' loop
  definition:=pg_get_functiondef(f.oid);
  if position('<=2 loop' in definition)>0 then
   definition:=replace(definition,'<=2 loop','<=3 and s.user_id is not null and not coalesce((s.snapshot->>''trial'')::boolean,false) and not exists(select 1 from v1.subscriptions nx where nx.renewed_from=s.id and nx.status<>''cancelled'') loop');
   execute definition;
  end if;
 end loop;
end $$;
revoke all on all functions in schema v1 from public,anon,authenticated;

-- Nullable account identity must never turn a legacy authorization predicate into NULL.
do $$ declare f record;definition text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('v1','public') and p.prokind='f' and (n.nspname='v1' or p.proname like 'catera_v1_%') loop
  definition:=pg_get_functiondef(f.oid);
  if definition like '%s.user_id<>u%' then
   execute replace(definition,'s.user_id<>u','s.user_id is distinct from u');
  end if;
 end loop;
end $$;
update v1.customer_records cr set address=coalesce(
 (select d.address from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.customer_record_id=cr.id order by d.service_date desc limit 1),
 (select to_jsonb(a)-'user_id' from v1.addresses a where a.user_id=cr.user_id order by a.id limit 1),'{}') where address='{}';

-- Wrap delivery JSON once, so newly frozen manifests and operational reads agree.
alter function v1.delivery(v1.delivery_days) rename to delivery_pilot_base;
create function v1.delivery(d v1.delivery_days) returns jsonb language sql stable set search_path='' as $$
 select v1.delivery_pilot_base(d)||case when v1.is_staff(auth.uid(),(s.snapshot->'offer'->>'catererId')::uuid) then jsonb_build_object('customer',jsonb_build_object(
 'id',coalesce(s.user_id,s.customer_record_id),'name',coalesce(cr.name,p.name)), 'customerRecordId',s.customer_record_id) else '{}'::jsonb end
 from v1.subscriptions s left join v1.customer_records cr on cr.id=s.customer_record_id left join v1.profiles p on p.id=s.user_id where s.id=d.subscription_id
$$;
revoke all on all functions in schema v1 from public,anon,authenticated;
