-- Operational complaints are separate from financial support cases. Opening or
-- resolving one never changes reservations, allocations, or settlement holds.
create table v1.delivery_issues (
 id uuid primary key default gen_random_uuid(), day_id uuid not null references v1.delivery_days,
 meal text not null, user_id uuid not null references v1.profiles,
 caterer_id uuid not null references v1.caterers, subject text not null, description text not null,
 status text not null default 'open' check(status in('open','responded','resolved','escalated')),
 version int not null default 1, case_id uuid references v1.support_cases,
 created_at timestamptz not null default now(),
 foreign key(day_id,meal) references v1.fulfillments(day_id,meal)
);
create unique index delivery_issue_active on v1.delivery_issues(day_id,meal,user_id) where status in('open','responded','escalated');
create index delivery_issue_seller on v1.delivery_issues(caterer_id,status,created_at,id);
create index delivery_issue_customer on v1.delivery_issues(user_id,created_at,id);
create table v1.delivery_issue_events (
 id uuid primary key default gen_random_uuid(), issue_id uuid not null references v1.delivery_issues,
 actor_id uuid not null references v1.profiles, action text not null, body text not null,
 created_at timestamptz not null default now()
);
create index delivery_issue_history on v1.delivery_issue_events(issue_id,created_at,id);
create trigger delivery_issue_history_immutable before update or delete on v1.delivery_issue_events for each row execute function v1.immutable();
alter table v1.delivery_issues enable row level security;
alter table v1.delivery_issue_events enable row level security;
revoke all on v1.delivery_issues,v1.delivery_issue_events from public,anon,authenticated;
create table v1.choice_fallback_actions (
 day_id uuid not null, meal text not null, service_date date not null,
 actor_id uuid not null references v1.profiles, note text not null, created_at timestamptz not null default now(),
 primary key(day_id,meal,service_date), foreign key(day_id,meal) references v1.fulfillments(day_id,meal)
);
alter table v1.choice_fallback_actions enable row level security;
revoke all on v1.choice_fallback_actions from public,anon,authenticated;
create trigger choice_fallback_actions_immutable before update or delete on v1.choice_fallback_actions for each row execute function v1.immutable();
create index beta_notification_identity on v1.notifications(user_id,kind,href);

create function v1.beta_notify_once(key text,u uuid,k text,b text,h text,extra jsonb default '{}') returns void language plpgsql set search_path='' as $$
declare inserted int;n uuid;begin
 if u is null then return;end if;
 insert into v1.outbox(kind,payload,dedupe,processed_at) values('reminder.record','{}',key,now()) on conflict(dedupe) do nothing;
 get diagnostics inserted=row_count;if inserted=0 then return;end if;
 -- Preserve deduplication when upgrading from historical reminder keys.
 if exists(select 1 from v1.notifications where user_id=u and kind=k and body=b and href=h) then return;end if;
 insert into v1.notifications(user_id,kind,body,href) values(u,k,b,h) returning id into n;
 insert into v1.outbox(kind,payload,dedupe) values('push',jsonb_build_object('userId',u,'body',b,'href',h)||extra,n::text);
end $$;

create function v1.beta_production_signature(entries jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(x-'canChange' order by x->>'id'),'[]') from jsonb_array_elements(entries)x
$$;

create function v1.beta_attention(cid uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare r jsonb;begin
 if not v1.is_staff(auth.uid(),cid) then raise exception 'FORBIDDEN';end if;
 with items as (
 select 'issue-'||i.id id,'delivery_issue' kind,1 priority,i.created_at at_time,
 i.subject context,'/seller/support?issue='||i.id href
 from v1.delivery_issues i where i.caterer_id=cid and i.status in('open','responded')
 union all
 select 'case-'||c.id,'support',1,c.created_at,c.subject,'/seller/support?case='||c.id
 from v1.support_cases c where c.caterer_id=cid and c.status='open'
 union all
 select 'delivery-'||d.id||'-'||f.meal,'delivery',0,d.service_date::timestamp at time zone (s.snapshot->'offer'->>'timezone'),
 d.service_date||' · '||f.meal||' · '||(s.snapshot->'offer'->>'name'),'/seller?date='||d.service_date||'&meal='||f.meal
 from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
 where p.caterer_id=cid and s.status='active' and d.status<>'cancelled' and f.status='issue'
 union all
 select 'choice-'||d.id||'-'||f.meal,
 case when statement_timestamp()>=v1.cutoff(s.snapshot->'offer',d.service_date) then 'choice_fallback' else 'choice_deadline' end,
 2,v1.cutoff(s.snapshot->'offer',d.service_date),d.service_date||' · '||f.meal||' · '||(s.snapshot->'offer'->>'name'),
 '/seller/schedule?date='||d.service_date||'&package='||p.id
 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id join v1.fulfillments f on f.day_id=d.id
 where p.caterer_id=cid and s.status='active' and d.status not in('cancelled','delivered') and f.status not in('cancelled','delivered')
 and s.snapshot->'offer'->>'menuSelectionMode'='customer' and statement_timestamp()>=v1.cutoff(s.snapshot->'offer',d.service_date)-interval '24 hours'
 and not exists(select 1 from v1.customer_menus cm where cm.day_id=d.id and cm.meal=f.meal and cm.details is not null)
 and not exists(select 1 from v1.choice_fallback_actions fa where fa.day_id=d.id and fa.meal=f.meal and fa.service_date=d.service_date)
 union all
 select 'payment-'||c.id,'payment',1,c.created_at,c.quote->'offer'->>'name',
 '/seller/support?case='||sc.id
 from v1.checkouts c join v1.packages p on p.id=c.package_id
 join lateral(select id from v1.support_cases where checkout_id=c.id and status<>'resolved' order by created_at,id limit 1)sc on true
 where p.caterer_id=cid and c.state='payment_exception'
 union all
 select 'production-'||pr.id,'production_changed',1,pr.created_at,pr.service_date::text,
 '/seller/schedule?date='||pr.service_date||'&production=1'
 from (select distinct on(service_date) * from v1.production where caterer_id=cid order by service_date,revision desc)pr
 where exists(select 1 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=cid and d.service_date=pr.service_date and d.status not in('delivered','cancelled'))
 and v1.beta_production_signature(pr.entries) is distinct from v1.beta_production_signature(coalesce((select jsonb_agg(v1.delivery(d)) from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=cid and d.service_date=pr.service_date and d.status<>'cancelled'),'[]'))
 ), ranked as (select * from items order by priority,at_time,id limit 100)
 select jsonb_build_object('timezone',(select timezone from v1.caterers where id=cid),'total',(select count(*) from items),'items',coalesce((select jsonb_agg(to_jsonb(ranked) order by priority,at_time,id) from ranked),'[]')) into r;
 return r;
end $$;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_beta_base;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();cid uuid:=nullif(params->>'id','')::uuid;begin
 if resource='seller-attention' then return v1.beta_attention(cid);end if;
 if resource='delivery-issues' then
  if u is null then raise exception 'UNAUTHORIZED';end if;
  if cid is not null and not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id) from (
   select i.*,d.service_date,s.snapshot->'offer'->>'name' package_name,
   coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'body',e.body,'created_at',e.created_at) order by e.created_at,e.id) from v1.delivery_issue_events e where e.issue_id=i.id),'[]') events
   from v1.delivery_issues i join v1.delivery_days d on d.id=i.day_id join v1.subscriptions s on s.id=d.subscription_id
   where (cid is null and i.user_id=u or cid is not null and i.caterer_id=cid)
   and (not(params ? 'issue') or i.id=(params->>'issue')::uuid)
   order by i.created_at desc,i.id limit 100)x),'[]');
 end if;
 return public.catera_v1_read_beta_base(resource,params);
end $$;
revoke all on function public.catera_v1_read_beta_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

do $$ declare def text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into def;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_beta_base;
 execute replace(replace(def,'public.catera_v1_command(','public.catera_v1_command_beta_base('),'catera_v1_command.request_id','catera_v1_command_beta_base.request_id');
end $$;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old v1.receipts;h text:=md5(action||payload::text);r jsonb;i v1.delivery_issues;
 d v1.delivery_days;s v1.subscriptions;cid uuid;ident uuid;body text;begin
 if action='support.escalate' and not exists(select 1 from v1.support_cases sc where sc.id=(payload->>'id')::uuid and (sc.user_id=u or v1.is_staff(u,sc.caterer_id))) then raise exception 'FORBIDDEN';end if;
 if action not in('attention.choiceHandled','deliveryIssue.create','deliveryIssue.respond','deliveryIssue.resolve','deliveryIssue.escalate') then
  return public.catera_v1_command_beta_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if request_id is null then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id;
 if found then if old.hash<>h then raise exception 'CONFLICT';end if;return old.result;end if;
 body:=trim(coalesce(payload->>'body',''));
 if length(body) not between 5 and 2000 then raise exception 'INVALID_INPUT';end if;
 if action='attention.choiceHandled' then
  select * into d from v1.delivery_days where id=(payload->>'deliveryId')::uuid;
  select * into s from v1.subscriptions where id=d.subscription_id;
  cid:=(s.snapshot->'offer'->>'catererId')::uuid;
  if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
  perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
  perform id from v1.packages where id=s.package_id for update;
  select * into d from v1.delivery_days where id=d.id for update;
  if s.status<>'active' or d.status in('delivered','cancelled') or d.service_date is distinct from (payload->>'date')::date
   or s.snapshot->'offer'->>'menuSelectionMode' is distinct from 'customer' or v1.cutoff(s.snapshot->'offer',d.service_date)>clock_timestamp()
   or not exists(select 1 from v1.fulfillments where day_id=d.id and meal=payload->>'meal' and status not in('delivered','cancelled'))
   or exists(select 1 from v1.customer_menus where day_id=d.id and meal=payload->>'meal' and details is not null) then raise exception 'CONFLICT';end if;
  insert into v1.choice_fallback_actions(day_id,meal,service_date,actor_id,note) values(d.id,payload->>'meal',d.service_date,u,body) on conflict do nothing;
  r:=jsonb_build_object('id',d.id);
  insert into v1.audit(actor_id,action,details) values(u,action,jsonb_build_object('id',d.id,'meal',payload->>'meal','date',d.service_date,'note',body));
  insert into v1.receipts(actor_id,request_id,hash,result) values(u,request_id,h,r);return r;
 end if;
 if action='deliveryIssue.create' then
  select * into d from v1.delivery_days where id=(payload->>'deliveryId')::uuid;
  select * into s from v1.subscriptions where id=d.subscription_id and user_id=u;
  if not found then raise exception 'FORBIDDEN';end if;
  if not exists(select 1 from v1.fulfillments where day_id=d.id and meal=payload->>'meal') or length(trim(coalesce(payload->>'subject',''))) not between 3 and 120 then raise exception 'INVALID_INPUT';end if;
  cid:=(s.snapshot->'offer'->>'catererId')::uuid;
  perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
  if exists(select 1 from v1.delivery_issues where day_id=d.id and meal=payload->>'meal' and user_id=u and status in('open','responded','escalated')) then raise exception 'CONFLICT';end if;
  insert into v1.delivery_issues(day_id,meal,user_id,caterer_id,subject,description) values(d.id,payload->>'meal',u,cid,trim(payload->>'subject'),body) returning * into i;
  perform v1.notify(st.user_id,'support','Ada kendala pada pengantaran. Tinjau dan tanggapi.','/seller/support?issue='||i.id) from v1.staff st where st.caterer_id=cid;
 else
  select caterer_id into cid from v1.delivery_issues where id=(payload->>'id')::uuid;
  if cid is null then raise exception 'NOT_FOUND';end if;
  perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
  select * into i from v1.delivery_issues where id=(payload->>'id')::uuid for update;
  if not (v1.is_staff(u,cid) or (action='deliveryIssue.escalate' and i.user_id=u)) then raise exception 'FORBIDDEN';end if;
  if i.version is distinct from (payload->>'version')::int or i.case_id is not null or i.status='escalated' or (i.status='resolved' and action<>'deliveryIssue.escalate') then raise exception 'CONFLICT';end if;
  if action='deliveryIssue.escalate' then
   select * into d from v1.delivery_days where id=i.day_id;
   select * into s from v1.subscriptions where id=d.subscription_id;
   -- Explicit platform escalation enters the existing support/hold policy.
   insert into v1.support_cases(user_id,caterer_id,delivery_id,subscription_id,checkout_id,subject,description,status)
    values(i.user_id,cid,d.id,s.id,s.checkout_id,i.subject,i.description||E'\n'||i.meal||E'\n'||coalesce((select string_agg(e.created_at::text||' '||e.action||': '||e.body,E'\n' order by e.created_at,e.id) from v1.delivery_issue_events e where e.issue_id=i.id),'')||E'\n'||body,'escalated') returning id into ident;
   update v1.allocations set held=greatest(held,amount-paid_out) where checkout_id=s.checkout_id;
  end if;
  update v1.delivery_issues set status=case action when 'deliveryIssue.resolve' then 'resolved' when 'deliveryIssue.respond' then 'responded' else 'escalated' end,
   version=version+1,case_id=ident where id=i.id returning * into i;
  perform v1.notify(i.user_id,'support',case when i.status='resolved' then 'Katerer menandai kendala pengantaran selesai. Anda tetap dapat meminta Catera meninjau.' else 'Kendala pengantaran Anda diperbarui.' end,'/support?issue='||i.id);
 end if;
 insert into v1.delivery_issue_events(issue_id,actor_id,action,body) values(i.id,u,action,body);
 r:=jsonb_build_object('id',i.id,'version',i.version,'status',i.status,'caseId',i.case_id);
 insert into v1.audit(actor_id,action,details) values(u,action,jsonb_build_object('id',i.id,'dayId',i.day_id,'meal',i.meal,'caseId',i.case_id));
 insert into v1.receipts(actor_id,request_id,hash,result) values(u,request_id,h,r);
 return r;
end $$;
revoke all on function public.catera_v1_command_beta_base(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
revoke all on all functions in schema v1 from public,anon,authenticated;

-- Existing maintenance has check-then-insert reminder markers. Serialize runs so
-- two scheduled workers cannot fail or duplicate notifications at that boundary.
alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_beta_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare job v1.outbox;n v1.notifications;begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='notification.eligible' then
  select * into job from v1.outbox where id=(catera_v1_system.payload->>'id')::uuid and kind='push';
  if not found then return 'false';end if;
  if job.payload ? 'checkoutId' then return to_jsonb(exists(select 1 from v1.checkouts c where c.id=(job.payload->>'checkoutId')::uuid and c.user_id=(job.payload->>'userId')::uuid and c.state=job.payload->>'expectedState' and (c.state<>'pending' or c.expires_at>clock_timestamp())));end if;
  if job.payload ? 'choiceDayId' then return to_jsonb(exists(select 1 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.fulfillments f on f.day_id=d.id
   where d.id=(job.payload->>'choiceDayId')::uuid and d.service_date=(job.payload->>'choiceDate')::date and f.meal=job.payload->>'choiceMeal' and s.status='active' and d.status not in('cancelled','delivered') and f.status not in('cancelled','delivered')
   and not exists(select 1 from v1.customer_menus cm where cm.day_id=d.id and cm.meal=f.meal and cm.details is not null)
   and ((job.payload->>'choiceMode'='reminder' and clock_timestamp()<v1.cutoff(s.snapshot->'offer',d.service_date)) or (job.payload->>'choiceMode'='fallback' and clock_timestamp()>=v1.cutoff(s.snapshot->'offer',d.service_date)))));end if;
  select * into n from v1.notifications where id::text=job.dedupe;
  if n.kind='renewal' then return to_jsonb(exists(select 1 from v1.subscriptions s where s.id::text=split_part(n.href,'/',3) and s.user_id=n.user_id and s.status='active'
   and not coalesce((s.snapshot->>'trial')::boolean,false) and (select count(*) from v1.delivery_days d where d.subscription_id=s.id and d.status not in('delivered','cancelled'))<=3
   and not exists(select 1 from v1.subscriptions nx where nx.renewed_from=s.id and nx.status<>'cancelled')
   and not exists(select 1 from v1.checkouts c where c.quote->>'renewedFrom'=s.id::text and c.state='pending' and c.expires_at>clock_timestamp())));end if;
  return 'true';
 end if;
 if action='maintenance' then perform pg_advisory_xact_lock(hashtext('beta:maintenance'));end if;
 return public.catera_v1_system_beta_base(action,payload);
end $$;
revoke all on function public.catera_v1_system_beta_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;

create function v1.beta_issue_support_resolution() returns trigger language plpgsql set search_path='' as $$
declare i v1.delivery_issues;begin
 if new.status='resolved' and old.status<>'resolved' then
  for i in update v1.delivery_issues set status='resolved',version=version+1 where case_id=new.id returning * loop
   insert into v1.delivery_issue_events(issue_id,actor_id,action,body) values(i.id,auth.uid(),'support.resolve',new.resolution);
  end loop;
 end if;return new;
end $$;
create trigger beta_issue_support_resolution after update of status on v1.support_cases for each row execute function v1.beta_issue_support_resolution();

-- Recovery notifications reflect committed checkout transitions, never redirects.
create function v1.beta_payment_notice() returns trigger language plpgsql set search_path='' as $$
begin
 if new.user_id is null or new.quote->>'source'='legacy' or new.state not in('pending','failed','expired','payment_exception') then return new;end if;
 if tg_op='UPDATE' and old.state is not distinct from new.state then return new;end if;
 perform v1.beta_notify_once('payment-state-'||new.id||'-'||new.state,new.user_id,'payment',case new.state
  when 'pending' then 'Pembayaran belum selesai. Lanjutkan pembayaran sebelum batas waktu.'
  when 'failed' then 'Pembayaran gagal. Periksa status sebelum meninjau pembelian kembali.'
  when 'expired' then 'Waktu pembayaran habis. Periksa status dan tinjau ulang ketersediaan.'
  else 'Pembayaran memerlukan peninjauan Catera. Jangan melakukan pembayaran ulang untuk pesanan ini.' end,'/payment/'||new.id,jsonb_build_object('checkoutId',new.id,'expectedState',new.state));
 return new;
end $$;
create trigger beta_payment_notice after insert or update of state on v1.checkouts for each row execute function v1.beta_payment_notice();

create or replace function v1.choice_notices() returns void language plpgsql set search_path='' as $$
declare candidate record;r record;mode text;key text;extra jsonb;owner_id uuid;begin
 for candidate in select d.id,f.meal,p.id package_id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id join v1.fulfillments f on f.day_id=d.id
 where s.snapshot->'offer'->>'menuSelectionMode'='customer' and s.status='active' and d.status not in('cancelled','delivered') and f.status not in('cancelled','delivered') and clock_timestamp()>=v1.cutoff(s.snapshot->'offer',d.service_date)-interval '24 hours' order by p.id,d.id,f.meal loop
  perform id from v1.packages where id=candidate.package_id for update;
  perform id from v1.delivery_days where id=candidate.id for update;
  select d.id,d.service_date,s.id subscription_id,s.user_id,p.caterer_id,f.meal,v1.cutoff(s.snapshot->'offer',d.service_date) cutoff_at into r
   from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id join v1.fulfillments f on f.day_id=d.id
   where d.id=candidate.id and f.meal=candidate.meal and s.status='active' and d.status not in('cancelled','delivered') and f.status not in('cancelled','delivered')
   and clock_timestamp()>=v1.cutoff(s.snapshot->'offer',d.service_date)-interval '24 hours'
   and not exists(select 1 from v1.customer_menus cm where cm.day_id=d.id and cm.meal=f.meal and cm.details is not null);
  if not found then continue;end if;
  mode:=case when clock_timestamp()<r.cutoff_at then 'reminder' else 'fallback' end;
  key:='choice-'||r.id||'-'||r.meal||'-'||r.service_date||'-'||mode;
  extra:=jsonb_build_object('choiceDayId',r.id,'choiceMeal',r.meal,'choiceDate',r.service_date,'choiceMode',mode);
  perform v1.beta_notify_once(key||'-customer-'||r.user_id,r.user_id,'menu',r.service_date||' · '||case when r.meal='lunch' then 'Siang: ' else 'Malam: ' end||case when mode='reminder' then 'Pilih menu sebelum batas waktu; jika belum memilih, katerer menentukan hidangannya.' else 'Batas waktu telah lewat. Katerer memilih hidangan Anda; pengantaran tetap berjalan.' end,'/subscriptions/'||r.subscription_id||'/menu',extra);
  if mode='fallback' then
   for owner_id in select user_id from v1.staff where caterer_id=r.caterer_id loop
    perform v1.beta_notify_once(key||'-seller-'||owner_id,owner_id,'menu',r.service_date||' · '||r.meal||': Pelanggan belum memilih menu. Tentukan hidangan dan komunikasikan kepada pelanggan.','/seller/schedule?date='||r.service_date,extra);
   end loop;
  end if;
 end loop;
end $$;

-- Keep existing reminder policy, but use seller timezones and avoid reminding a
-- customer to start another renewal while their renewal checkout is pending.
do $$ declare f record;def text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'catera_v1_system%' loop
  def:=pg_get_functiondef(f.oid);
  if position('dedupe=''renew-''' in def)>0 then
   def:=replace(def,'d.service_date=current_date+1','d.service_date=(statement_timestamp() at time zone (s.snapshot->''offer''->>''timezone''))::date+1');
   def:=replace(def,'nx.status<>''cancelled'') loop','nx.status<>''cancelled'') and not exists(select 1 from v1.checkouts pending where pending.quote->>''renewedFrom''=s.id::text and pending.state=''pending'' and pending.expires_at>statement_timestamp()) loop');
   def:=replace(def,'''/subscriptions/''||item.id','''/renew/''||item.id');
   execute def;
  end if;
 end loop;
 select pg_get_functiondef('v1.choice_notices()'::regprocedure) into def;
 def:=replace(def,'''/seller/calendar?date=''','''/seller/schedule?date=''');execute def;
end $$;
revoke all on all functions in schema v1 from public,anon,authenticated;
