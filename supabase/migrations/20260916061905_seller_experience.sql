-- Additive seller experience. No existing purchase terms or ledger entries change.
create table v1.payout_destinations (
 id uuid primary key default gen_random_uuid(), caterer_id uuid not null references v1.caterers,
 version int not null, bank_name text not null, holder text not null, account_number text not null,
 recipient_type text not null check(recipient_type in('INDIVIDUAL','BUSINESS')),
 status text not null default 'submitted' check(status in('submitted','approved','rejected')),
 active boolean not null default false, recipient jsonb, reason text, created_by uuid not null references v1.profiles,
 reviewed_by uuid references v1.profiles, created_at timestamptz not null default now(), reviewed_at timestamptz,
 unique(caterer_id,version), check(not active or status='approved')
);
create unique index payout_destination_active on v1.payout_destinations(caterer_id) where active;
create unique index payout_destination_pending on v1.payout_destinations(caterer_id) where status='submitted';
create index payout_destination_queue on v1.payout_destinations(status,created_at,id);
create table v1.account_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references v1.profiles,
 caterer_id uuid references v1.caterers, kind text not null check(kind in('help','deletion')),
 body text not null, status text not null default 'open' check(status in('open','resolved')),
 resolution text, created_at timestamptz not null default now(), resolved_by uuid references v1.profiles
);
create index account_request_owner on v1.account_requests(user_id,created_at desc);
create index account_request_queue on v1.account_requests(status,created_at,id);
alter table v1.payout_destinations enable row level security;
alter table v1.account_requests enable row level security;
revoke all on v1.payout_destinations,v1.account_requests from anon,authenticated;

create function v1.destination_summary(d v1.payout_destinations) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',d.id,'catererId',d.caterer_id,'version',d.version,'bank',d.bank_name,'holder',d.holder,'maskedAccount','•••• '||right(d.account_number,4),'recipientType',d.recipient_type,'status',d.status,'active',d.active,'reason',d.reason,'createdAt',d.created_at)
$$;

-- Expose failure reasons without exposing the captured recipient payload.
alter function v1.settlement_state(uuid) rename to settlement_state_experience_base;
create function v1.settlement_state(cid uuid) returns jsonb language sql stable set search_path='' as $$
 select v1.settlement_state_experience_base(cid)||jsonb_build_object('payouts',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,amount,status,created_at,failure_code from v1.payouts where caterer_id=cid and settlement_run_id is not null order by created_at desc,id limit 100)x),'[]'::jsonb))
$$;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_experience_base;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();cid uuid:=nullif(params->>'id','')::uuid;cr uuid;r jsonb;begin
 if resource='seller-identity' then
  if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
  return (select jsonb_build_object('name',name) from v1.caterers where id=cid);
 elsif resource='message-customers' then
  if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,name,user_id from v1.customer_records where caterer_id=cid and name ilike '%'||left(coalesce(params->>'search',''),100)||'%' order by name,id limit 25 offset greatest(0,coalesce((params->>'offset')::int,0)))x),'[]'), 'total',(select count(*) from v1.customer_records where caterer_id=cid and name ilike '%'||left(coalesce(params->>'search',''),100)||'%'));
 elsif resource='payout-setup' then
  if not (v1.is_staff(u,cid,true) or v1.is_admin(u)) then raise exception 'FORBIDDEN';end if;
  return jsonb_build_object('active',(select v1.destination_summary(d) from v1.payout_destinations d where caterer_id=cid and active),'latest',(select v1.destination_summary(d) from v1.payout_destinations d where caterer_id=cid order by version desc limit 1),'dispatchEnabled',(select automatic_payouts from v1.purchase_features where id),'settlement',v1.settlement_state(cid));
 elsif resource='payout-destination-queue' then
  if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
  return coalesce((select jsonb_agg(v1.destination_summary(d)||jsonb_build_object('caterer',c.name)) from v1.payout_destinations d join v1.caterers c on c.id=d.caterer_id where d.status='submitted'),'[]');
 elsif resource='payout-destination-detail' then
  if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
  return (select v1.destination_summary(d)||jsonb_build_object('accountNumber',account_number) from v1.payout_destinations d where id=cid);
 elsif resource='account-requests' then
  if u is null then raise exception 'UNAUTHORIZED';end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select ar.*,p.name from v1.account_requests ar join v1.profiles p on p.id=ar.user_id where (v1.is_admin(u) or ar.user_id=u) order by ar.created_at desc limit 100)x),'[]');
 elsif resource='seller-customers' and params ? 'customerId' then
  if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
  select id into cr from v1.customer_records where caterer_id=cid and (user_id=(params->>'customerId')::uuid or id=(params->>'customerId')::uuid) order by id limit 1;
  if cr is null then raise exception 'NOT_FOUND';end if;
  return public.catera_v1_read_experience_base(resource,(params-'customerId')||jsonb_build_object('customerRecordId',cr));
 end if;
 return public.catera_v1_read_experience_base(resource,params);
end $$;
revoke all on function public.catera_v1_read_experience_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

-- Preserve the base function's qualified request-id references when renaming.
do $$ declare definition text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into definition;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_experience_base;
 execute replace(replace(definition,'public.catera_v1_command(','public.catera_v1_command_experience_base('),'catera_v1_command.request_id','catera_v1_command_experience_base.request_id');
end $$;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();cid uuid:=nullif(payload->>'catererId','')::uuid;cr v1.customer_records;dest v1.payout_destinations;old v1.receipts;h text:=md5(action||payload::text);r jsonb;ident uuid;d v1.delivery_days;owner_id uuid;begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action not in('customer.deliveryChange','payoutDestination.submit','payoutDestination.review','accountRequest.create','accountRequest.resolve') and not(action='message.send' and payload ? 'customerRecordId') then return public.catera_v1_command_experience_base(action,payload,request_id);end if;
 if request_id is null then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 if action='payoutDestination.review' then select caterer_id into cid from v1.payout_destinations where id=(payload->>'id')::uuid;end if;
 if cid is not null then perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));end if;
 select * into old from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id;
 if found then if old.hash<>h then raise exception 'CONFLICT';end if;return old.result;end if;
 if action='customer.deliveryChange' then
  r:=public.catera_v1_command_experience_base(action,payload,request_id);
  select * into d from v1.delivery_days where id=(r->>'id')::uuid;
  r:=r||jsonb_build_object('delivery',v1.delivery(d),'subscription',(select jsonb_build_object('id',id,'starts_on',starts_on,'ends_on',ends_on) from v1.subscriptions where id=d.subscription_id));
  update v1.receipts x set result=r where x.actor_id=u and x.request_id=catera_v1_command.request_id;return r;
 elsif action='message.send' then
  if not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
  select * into cr from v1.customer_records where id=(payload->>'customerRecordId')::uuid and caterer_id=cid;
  if not found then raise exception 'FORBIDDEN';end if;
  if cr.user_id is null then raise exception 'CUSTOMER_NOT_LINKED';end if;
  if length(trim(coalesce(payload->>'body',''))) not between 1 and 2000 then raise exception 'INVALID_INPUT';end if;
  insert into v1.conversations(customer_id,caterer_id) values(cr.user_id,cid) on conflict(customer_id,caterer_id) do update set customer_id=excluded.customer_id returning id into ident;
  insert into v1.messages(conversation_id,sender_id,body) values(ident,u,trim(payload->>'body'));
  perform v1.notify(cr.user_id,'message','Pesan baru dari katerer.','/messages');
  r:=jsonb_build_object('id',ident);
 elsif action='payoutDestination.submit' then
  if not v1.is_staff(u,cid,true) then raise exception 'FORBIDDEN';end if;
  if length(trim(coalesce(payload->>'bank',''))) not between 2 and 100 or length(trim(coalesce(payload->>'holder',''))) not between 2 and 150 or coalesce(payload->>'accountNumber','') !~ '^[0-9]{5,34}$' or coalesce(payload->>'recipientType','') not in('INDIVIDUAL','BUSINESS') then raise exception 'INVALID_INPUT';end if;
  if exists(select 1 from v1.payout_destinations where caterer_id=cid and status='submitted') then raise exception 'CONFLICT';end if;
  insert into v1.payout_destinations(caterer_id,version,bank_name,holder,account_number,recipient_type,created_by) values(cid,coalesce((select max(version) from v1.payout_destinations where caterer_id=cid),0)+1,trim(payload->>'bank'),trim(payload->>'holder'),payload->>'accountNumber',payload->>'recipientType',u) returning * into dest;
  r:=v1.destination_summary(dest);
 elsif action='payoutDestination.review' then
  if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
  select * into dest from v1.payout_destinations where id=(payload->>'id')::uuid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if dest.status<>'submitted' or dest.version is distinct from (payload->>'version')::int then raise exception 'CONFLICT';end if;
  if length(trim(coalesce(payload->>'reason',''))) not between 5 and 1000 or coalesce(payload->>'decision','') not in('approved','rejected') then raise exception 'INVALID_INPUT';end if;
  if payload->>'decision'='approved' then
   if coalesce(payload->>'routingCode','') !~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$' then raise exception 'INVALID_INPUT';end if;
   if dest.recipient_type='INDIVIDUAL' and (length(trim(coalesce(payload->>'givenName',''))) not between 1 and 50 or length(trim(coalesce(payload->>'surname',''))) not between 1 and 50) then raise exception 'INVALID_INPUT';end if;
   if dest.recipient_type='BUSINESS' and length(trim(coalesce(payload->>'businessName',''))) not between 1 and 50 then raise exception 'INVALID_INPUT';end if;
   update v1.payout_destinations set active=false where caterer_id=cid and active;
  end if;
  update v1.payout_destinations set status=payload->>'decision',active=payload->>'decision'='approved',reason=replace(payload->>'reason',dest.account_number,'[masked]'),reviewed_by=u,reviewed_at=now(),recipient=case when payload->>'decision'='approved' then jsonb_build_object('type',dest.recipient_type,'relationship','SUPPLIER','account_details',jsonb_build_object('currency','IDR','account_country','ID','account_holder_name',dest.holder,'account_number',dest.account_number,'routing_type_1','SWIFT','routing_value_1',payload->>'routingCode'))||case when dest.recipient_type='BUSINESS' then jsonb_build_object('business_name',trim(payload->>'businessName')) else jsonb_build_object('given_name',trim(payload->>'givenName'),'surname',trim(payload->>'surname')) end else null end where id=dest.id returning * into dest;
  r:=v1.destination_summary(dest);
  perform v1.notify(dest.created_by,'payout','Status rekening pencairan diperbarui.','/seller/settings#payout');
 elsif action='accountRequest.create' then
  if cid is not null and not v1.is_staff(u,cid) then raise exception 'FORBIDDEN';end if;
  if coalesce(payload->>'kind','') not in('help','deletion') or length(trim(coalesce(payload->>'body',''))) not between 5 and 2000 then raise exception 'INVALID_INPUT';end if;
  insert into v1.account_requests(user_id,caterer_id,kind,body) values(u,cid,payload->>'kind',trim(payload->>'body')) returning id into ident;r:=jsonb_build_object('id',ident);
 else
  if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
  if length(trim(coalesce(payload->>'resolution',''))) not between 5 and 2000 then raise exception 'INVALID_INPUT';end if;
  update v1.account_requests set status='resolved',resolution=payload->>'resolution',resolved_by=u where id=(payload->>'id')::uuid and status='open' returning user_id,id into owner_id,ident;
  if not found then raise exception 'CONFLICT';end if;
  perform v1.notify(owner_id,'support','Permintaan akun diperbarui.','/seller/settings#help');r:=jsonb_build_object('id',ident);
 end if;
 -- Audit identity and decision only; bank numbers, message bodies and private help text are excluded.
 insert into v1.audit(actor_id,action,details) values(u,action,jsonb_build_object('id',r->>'id','catererId',cid,'status',r->>'status'));
 insert into v1.receipts values(u,request_id,h,r);return r;
end $$;
revoke all on function public.catera_v1_command_experience_base(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_experience_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid;recipient jsonb;p v1.payouts;begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='upload.expired' then
  if to_regclass('storage.objects') is null then return '[]'::jsonb;end if;
  return coalesce((select jsonb_agg(name) from (select name from storage.objects where bucket_id='catera-v1-food-staging' and created_at<clock_timestamp()-interval '2 hours' order by created_at limit 100)x),'[]');
 elsif action='payout.destination' then
  return (select jsonb_build_object('recipient',d.recipient,'purposeCode','OTHER') from v1.payout_destinations d where caterer_id=(payload->>'catererId')::uuid and active);
 elsif action='payout.prepare' then
  select * into p from v1.payouts where id=(payload->>'id')::uuid;
  if p.id is null then raise exception 'NOT_FOUND';end if;
  perform pg_advisory_xact_lock(hashtext('pilot:'||p.caterer_id::text));
  select d.recipient into recipient from v1.payout_destinations d where caterer_id=p.caterer_id and active;
  if recipient is not null and p.recipient_request is null then payload:=jsonb_set(payload,'{request,recipient}',recipient);end if;
 end if;
 return public.catera_v1_system_experience_base(action,payload);
end $$;
revoke all on function public.catera_v1_system_experience_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;

-- Clients receive an object-scoped signed upload capability, never a service key.
do $$ begin
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists "Catera owners upload food photos" on storage.objects';
 end if;
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catera-v1-food-staging','catera-v1-food-staging',false,8388608,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
 end if;
end $$;
