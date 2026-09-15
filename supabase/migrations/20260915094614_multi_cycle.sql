-- Requires the paid seller pilot and customer-choice migrations. No customer data rewrite.
create table v1.package_duration_revisions(package_id uuid not null references v1.packages,revision int not null check(revision>0),options jsonb not null,created_by uuid not null references v1.profiles,created_at timestamptz not null default now(),primary key(package_id,revision));
create trigger duration_revision_immutable before update or delete on v1.package_duration_revisions for each row execute function v1.immutable();
alter table v1.package_duration_revisions enable row level security;
revoke all on v1.package_duration_revisions from public,anon,authenticated;
create table v1.purchase_features(id boolean primary key default true check(id),multi_cycle boolean not null default false,automatic_payouts boolean not null default false);
insert into v1.purchase_features default values;
alter table v1.purchase_features enable row level security;
revoke all on v1.purchase_features from public,anon,authenticated;

create function v1.duration_pricing(pid uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce((select jsonb_build_object('revision',revision,'options',options) from v1.package_duration_revisions where package_id=pid order by revision desc limit 1),'{"revision":0,"options":[{"cycles":1,"discountPercent":0}]}'::jsonb)
$$;
alter function v1.offer(v1.packages) rename to offer_duration_base;
create function v1.offer(p v1.packages) returns jsonb language sql stable set search_path='' as $$ select v1.offer_duration_base(p)||jsonb_build_object('durationPricing',v1.duration_pricing(p.id)) $$;
create function v1.valid_duration_options(a jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb;seen int[]:='{}';n numeric;pct numeric;begin
 if jsonb_typeof(a) is distinct from 'array' or jsonb_array_length(a) not between 1 and 6 then return false;end if;
 for x in select value from jsonb_array_elements(a) loop
  if jsonb_typeof(x->'cycles') is distinct from 'number' or jsonb_typeof(x->'discountPercent') is distinct from 'number' then return false;end if;
  n:=(x->>'cycles')::numeric;pct:=(x->>'discountPercent')::numeric;
  if n<>trunc(n) or n not between 1 and 6 or n::int=any(seen) or pct not between 0 and 90 or pct<>round(pct,2) or (n=1 and pct<>0) then return false;end if;
  seen:=array_append(seen,n::int);
 end loop;return 1=any(seen);exception when others then return false;end $$;

create function v1.term_dates(pid uuid,o jsonb,start_day date,needed int,qty int,last_day date) returns jsonb language plpgsql set search_path='' as $$
declare d date:=start_day;result jsonb:='[]';begin
 if d is null or needed not between 1 and 360 or qty not between 1 and 100 then raise exception 'INVALID_INPUT';end if;
 while jsonb_array_length(result)<needed and d<=last_day loop
  if o->'weekdays' @> to_jsonb(extract(dow from d)::int) and not exists(select 1 from v1.capacity where package_id=pid and service_date=d and closed) then
   if v1.cutoff(o,d)<=clock_timestamp() then raise exception 'CUTOFF';end if;
   if v1.slots(pid,d)-v1.demand(pid,d)<qty then raise exception 'CAPACITY';end if;
   result:=result||to_jsonb(d::text);
  end if;d:=d+1;
 end loop;
 if jsonb_array_length(result)<>needed then raise exception 'BOOKING_HORIZON';end if;return result;
end $$;

create or replace function v1.quote(u uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$
declare p v1.packages;o jsonb;ad v1.addresses;pol v1.policies;pp v1.pilot_pricing;s v1.subscriptions;
 qty int;cycles int;trial boolean;days int;dates jsonb;horizon date;dur jsonb;opt jsonb;sub numeric;dis numeric;pct numeric:=0;dpct numeric:=0;ddis numeric;net numeric;sfee numeric;fee numeric;src text;rate numeric;policy jsonb;q jsonb;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if coalesce(a->>'promo','')<>'' then raise exception 'PROMOTIONS_DISABLED';end if;
 if jsonb_typeof(a->'portions') is distinct from 'number' or (a->>'portions')::numeric<>trunc((a->>'portions')::numeric) or (a ? 'cycles' and (jsonb_typeof(a->'cycles') is distinct from 'number' or (a->>'cycles')::numeric<>trunc((a->>'cycles')::numeric))) then raise exception 'INVALID_INPUT';end if;
 qty:=(a->>'portions')::int;cycles:=coalesce((a->>'cycles')::int,1);trial:=coalesce((a->>'trial')::boolean,false);
 if qty not between 1 and 100 or cycles not between 1 and 6 or (trial and cycles<>1) then raise exception 'INVALID_INPUT';end if;
 if cycles>1 and not (select multi_cycle from v1.purchase_features where id) and coalesce(current_setting('catera.demo',true),'false')<>'true' then raise exception 'DURATION_UNAVAILABLE';end if;
 select * into p from v1.packages where id=(a->>'packageId')::uuid;if not found then raise exception 'NOT_FOUND';end if;o:=v1.offer(p);
 if p.status<>'published' or o->>'sellerStatus'<>'approved' then raise exception 'NOT_AVAILABLE';end if;
 select * into ad from v1.addresses where id=(a->>'addressId')::uuid and user_id=u;if not found then raise exception 'FORBIDDEN';end if;
 if not(o->'areas' ? ad.area) then raise exception 'COVERAGE';end if;
 if trial and (o->>'trialPrice' is null or (o->>'trialMax' is not null and qty>(o->>'trialMax')::int)) then raise exception 'INVALID_INPUT';end if;
 if trial and exists(select 1 from v1.checkouts c join v1.packages k on k.id=c.package_id where c.user_id=u and k.caterer_id=p.caterer_id and (c.quote->>'trial')::boolean and (c.state in('paid','refunded','partially_refunded','payment_exception') or (c.state='pending' and c.expires_at>clock_timestamp()))) then raise exception 'TRIAL_USED';end if;
 dur:=v1.duration_pricing(p.id);select x into opt from jsonb_array_elements(dur->'options') x where (x->>'cycles')::int=cycles;if opt is null then raise exception 'DURATION_UNAVAILABLE';end if;
 days:=case when trial then 1 else (o->>'days')::int*cycles end;
 horizon:=(statement_timestamp() at time zone (o->>'timezone'))::date+366;
 dates:=v1.term_dates(p.id,o,(a->>'startDate')::date,days,qty,horizon);
 if exists(select 1 from v1.subscriptions x where x.user_id=u and x.package_id=p.id and x.status='active' and x.starts_on<=(dates->>-1)::date and x.ends_on>=(dates->>0)::date) or exists(select 1 from v1.checkouts c where c.user_id=u and c.package_id=p.id and c.state='pending' and c.expires_at>clock_timestamp() and (c.quote->'dates'->>0)::date<=(dates->>-1)::date and (c.quote->'dates'->>-1)::date>=(dates->>0)::date) then raise exception 'OVERLAP';end if;
 if nullif(a->>'renewedFrom','') is not null then
  select * into s from v1.subscriptions where id=(a->>'renewedFrom')::uuid and user_id=u;
  if not found or s.status='cancelled' or trial or s.snapshot->'offer'->>'catererId' is distinct from o->>'catererId' then raise exception 'FORBIDDEN';end if;
  if (dates->>0)::date<=greatest(s.ends_on,coalesce((select max(service_date) from v1.delivery_days where subscription_id=s.id and status<>'cancelled'),s.ends_on)) then raise exception 'OVERLAP';end if;
  if exists(select 1 from v1.subscriptions where renewed_from=s.id and status<>'cancelled') or exists(select 1 from v1.checkouts where quote->>'renewedFrom'=s.id::text and state='pending' and expires_at>clock_timestamp()) then raise exception 'CONFLICT';end if;
 end if;
 pol:=v1.pilot_policy(p.caterer_id);
 if pol.id is null or not pol.approved or (pol.synthetic and coalesce(current_setting('catera.demo',true),'false')<>'true') then raise exception 'NOT_CONFIGURED';end if;
 sub:=case when trial then (o->>'trialPrice')::numeric else (o->>'price')::numeric end*qty*days;
 if sub>2147483647 then raise exception 'AMOUNT_TOO_LARGE';end if;
 if not trial then select coalesce(max((x->>'percent')::numeric),0) into pct from jsonb_array_elements(o->'tiers') x where (x->>'min')::int<=qty;dpct:=(opt->>'discountPercent')::numeric;end if;
 dis:=round(sub*pct/100);ddis:=round((sub-dis)*dpct/100);net:=sub-dis-ddis;
 select source into src from v1.relationships where user_id=u and caterer_id=p.caterer_id;
 if src is null then src:=case when exists(select 1 from v1.invites where code=a->>'invite' and caterer_id=p.caterer_id and role='customer' and (used_by is null or used_by=u)) then 'invited' else 'marketplace' end;end if;
 rate:=case when src='marketplace' then pol.marketplace_percent else pol.invited_percent end;fee:=pol.service_fee;sfee:=round(net*rate/100);
 if sfee<0 or sfee>net or net+fee>2147483647 then raise exception 'AMOUNT_TOO_LARGE';end if;
 select * into pp from v1.pilot_pricing where caterer_id=p.caterer_id and approved and effective_at<=statement_timestamp() order by effective_at desc limit 1;
 policy:=jsonb_build_object('id',coalesce(pp.id::text,'global'),'model',coalesce(pp.model,'transaction'),'cohort',coalesce(pp.cohort,'global'),'monthlyFee',pp.monthly_fee,'effectiveAt',pp.effective_at,'synthetic',pol.synthetic,'serviceFee',pol.service_fee,'marketplacePercent',pol.marketplace_percent,'invitedPercent',pol.invited_percent,'approved',pol.approved);
 q:=jsonb_build_object('pricingVersion',2,'currency','IDR','packageId',p.id,'portions',qty,'trial',trial,'cycles',cycles,'daysPerCycle',(o->>'days')::int,'deliveryDays',days,'dates',dates,'bookingThrough',horizon,'bookingPolicyVersion',1,'durationPricing',dur,'durationOption',opt,'subtotal',sub,'discount',dis,'discountPercent',pct,'durationDiscount',ddis,'durationDiscountPercent',dpct,'packageNet',net,'promotion',0,'promotionSnapshot',null,'serviceFee',fee,'total',net+fee,'sellerFee',sfee,'sellerFeePercent',rate,'sellerNet',net-sfee,'perDay',round(net/qty/days),'source',src,'offer',o,'address',to_jsonb(ad)-'user_id','pricingPolicy',policy,'settlementModel','delivery_earned_v1','settlementRounding','original_schedule_first_remainder','renewedFrom',s.id);
 return q;
end $$;

create function v1.checkout_terms_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if old.quote->>'pricingVersion'='2' and (new.quote is distinct from old.quote or new.user_id is distinct from old.user_id or new.package_id<>old.package_id) then raise exception 'IMMUTABLE_TERMS';end if;return new;end $$;
create trigger checkout_terms before update on v1.checkouts for each row execute function v1.checkout_terms_guard();
create function v1.term_horizon_guard() returns trigger language plpgsql set search_path='' as $$ declare s v1.subscriptions;begin
 if new.service_date is distinct from old.service_date then select * into s from v1.subscriptions where id=new.subscription_id;
  if s.snapshot->>'bookingThrough' is not null and new.service_date>(s.snapshot->>'bookingThrough')::date then raise exception 'BOOKING_HORIZON';end if;
 end if;return new;end $$;
create trigger term_horizon before update of service_date on v1.delivery_days for each row execute function v1.term_horizon_guard();

do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_duration_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_duration_base('),'catera_v1_command.request_id','catera_v1_command_duration_base.request_id');
end $$;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p v1.packages;rev int;old v1.receipts;h text:=md5(action||payload::text);r jsonb;begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action='promotion.save' then raise exception 'PROMOTIONS_DISABLED';end if;
 if request_id is null then raise exception 'INVALID_INPUT';end if;perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts where actor_id=u and receipts.request_id=catera_v1_command.request_id;if found then if old.hash<>h then raise exception 'CONFLICT';end if;return old.result;end if;
 if action='package.save' and payload->'offer' ? 'durationPricing' then
  if not v1.valid_duration_options(payload->'offer'->'durationPricing'->'options') then raise exception 'INVALID_INPUT';end if;
  if payload->>'id' is not null then
   select * into p from v1.packages where id=(payload->>'id')::uuid for update;
   if (payload->'offer'->'durationPricing'->>'revision')::int is distinct from (v1.duration_pricing(p.id)->>'revision')::int then raise exception 'CONFLICT';end if;
  end if;
  r:=public.catera_v1_command_duration_base(action,payload,request_id);
  select * into p from v1.packages where id=(r->>'id')::uuid;
  if (v1.duration_pricing(p.id)->'options') is distinct from (payload->'offer'->'durationPricing'->'options') then
   rev:=(v1.duration_pricing(p.id)->>'revision')::int;
   insert into v1.package_duration_revisions values(p.id,rev+1,payload->'offer'->'durationPricing'->'options',u,now());
  end if;return r;
 end if;
 if action<>'package.durationPricing.save' then return public.catera_v1_command_duration_base(action,payload,request_id);end if;
 if request_id is null then raise exception 'INVALID_INPUT';end if;perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts where actor_id=u and receipts.request_id=catera_v1_command.request_id;if found then if old.hash<>h then raise exception 'CONFLICT';end if;return old.result;end if;
 select * into p from v1.packages where id=(payload->>'packageId')::uuid for update;
 if not found or p.caterer_id is distinct from (payload->>'catererId')::uuid or not v1.is_staff(u,p.caterer_id,true) then raise exception 'FORBIDDEN';end if;
 if p.status not in('draft','published') then raise exception 'INVALID_STATE';end if;
 rev:=(v1.duration_pricing(p.id)->>'revision')::int;
 if (payload->>'revision')::int is distinct from rev then raise exception 'CONFLICT';end if;
 if not v1.valid_duration_options(payload->'options') then raise exception 'INVALID_INPUT';end if;
 insert into v1.package_duration_revisions values(p.id,rev+1,(select jsonb_agg(x order by (x->>'cycles')::int) from jsonb_array_elements(payload->'options') x),u,now());
 r:=jsonb_build_object('id',p.id,'revision',rev+1);
 insert into v1.audit(actor_id,action,details) values(u,action,payload||r);insert into v1.receipts values(u,request_id,h,r);return r;
end $$;
revoke all on function public.catera_v1_command_duration_base(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;

create function v1.multi_renewal(s v1.subscriptions,pid uuid,cycles int) returns jsonb language plpgsql set search_path='' as $$
declare p v1.packages;o jsonb;ad jsonb;aid uuid;minimum date;horizon date;dt date;run int:=0;needed int;dates jsonb:='[]';pending uuid;child v1.subscriptions;counter int:=0;begin
 if s.status='cancelled' or cycles not between 1 and 6 then raise exception 'INVALID_INPUT';end if;
 loop
  select * into child from v1.subscriptions where renewed_from=s.id and status<>'cancelled' order by starts_on desc limit 1;
  exit when not found;s:=child;counter:=counter+1;if counter>366 then raise exception 'CONFLICT';end if;
 end loop;
 select * into p from v1.packages where id=coalesce(pid,s.package_id) and caterer_id=(s.snapshot->'offer'->>'catererId')::uuid;
 if not found then raise exception 'NOT_FOUND';end if;o:=v1.offer(p);needed:=(o->>'days')::int*cycles;
 if not exists(select 1 from jsonb_array_elements(v1.duration_pricing(p.id)->'options') x where (x->>'cycles')::int=cycles) then raise exception 'DURATION_UNAVAILABLE';end if;
 select id into pending from v1.checkouts where quote->>'renewedFrom'=s.id::text and state='pending' and expires_at>clock_timestamp() limit 1;
 select address into ad from v1.delivery_days where subscription_id=s.id and status<>'cancelled' order by service_date desc limit 1;ad:=coalesce(ad,s.snapshot->'address');
 select id into aid from v1.addresses where user_id=s.user_id and line=ad->>'line' and area=ad->>'area' and city=ad->>'city' order by id limit 1;
 horizon:=(statement_timestamp() at time zone (o->>'timezone'))::date+366;
 minimum:=greatest((statement_timestamp() at time zone (o->>'timezone'))::date+1,s.ends_on+1,
 (select max(d.service_date)+1 from v1.delivery_days d join v1.subscriptions ss on ss.id=d.subscription_id where (ss.user_id=s.user_id or ss.customer_record_id=s.customer_record_id) and ss.snapshot->'offer'->>'catererId'=o->>'catererId' and d.status<>'cancelled'),
 (select max((c.quote->'dates'->>-1)::date)+1 from v1.checkouts c where c.user_id=s.user_id and c.state='pending' and c.expires_at>clock_timestamp() and c.quote->'offer'->>'catererId'=o->>'catererId'));
 if pending is null and p.status='published' and o->>'sellerStatus'='approved' then
  for dt in select dd::date from generate_series(minimum,horizon,interval '1 day') dd loop
   if o->'weekdays' @> to_jsonb(extract(dow from dt)::int) and not exists(select 1 from v1.capacity where package_id=p.id and service_date=dt and closed) then
    if v1.cutoff(o,dt)>clock_timestamp() and v1.slots(p.id,dt)-v1.demand(p.id,dt)>=s.portions then run:=run+1;dates:=dates||to_jsonb(dt::text);else run:=0;dates:='[]';end if;
    exit when run=needed;
   end if;
  end loop;
 end if;
 return jsonb_build_object('subscriptionId',s.id,'packageId',p.id,'portions',s.portions,'address',ad,'addressId',aid,'cycles',cycles,'minimumStartDate',minimum,'bookingThrough',horizon,'dates',case when run=needed then dates else '[]'::jsonb end,'startDate',coalesce((dates->>0)::date,minimum),'pendingCheckoutId',pending,'replacementRequired',p.status<>'published' or o->>'sellerStatus'<>'approved','available',run=needed and pending is null,'offers',coalesce((select jsonb_agg(v1.offer(x) order by x.slug) from v1.packages x where x.caterer_id=p.caterer_id and x.status='published'),'[]'));
end $$;
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_duration_base;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$ declare s v1.subscriptions;begin
 if resource='renewal-context' then select * into s from v1.subscriptions where id=(params->>'id')::uuid and user_id=auth.uid();if not found then raise exception 'FORBIDDEN';end if;return v1.multi_renewal(s,nullif(params->>'packageId','')::uuid,coalesce((params->>'cycles')::int,1));end if;
 return public.catera_v1_read_duration_base(resource,params);
end $$;
revoke all on function public.catera_v1_read_duration_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;

-- Calendar options apply the same immutable horizon as the write path.
alter function v1.availability(uuid,jsonb) rename to availability_duration_base;
create function v1.availability(u uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$ declare result jsonb;horizon date;begin
 result:=v1.availability_duration_base(u,a);
 select (s.snapshot->>'bookingThrough')::date into horizon from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where d.id=(a->>'id')::uuid;
 if horizon is null then return result;end if;
 return (select coalesce(jsonb_agg(case when (x->>'date')::date>horizon then x||jsonb_build_object('available',false,'reason','BOOKING_HORIZON') else x end order by x->>'date'),'[]') from jsonb_array_elements(result) x);
end $$;
revoke all on all functions in schema v1 from public,anon,authenticated;
