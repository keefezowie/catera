-- Sign-in rethink, backend (docs/superpowers/specs/2026-10-30-sign-in-rethink.md). Phone OTP is gone, so
-- neither the caterer's WhatsApp nor the customer's phone can come from a verified auth.users.phone any more.
--   * v1.caterers.whatsapp: the kitchen's WhatsApp number, E.164 (+62...), null allowed.
--     seller.create accepts an optional `whatsapp`; seller.whatsapp {whatsapp, catererId?} sets or clears it,
--     owner only (staff FORBIDDEN). A bad number is INVALID_INPUT.
--   * v1.caterer_whatsapp(cid) answers the column first and falls back to the owner's verified auth phone, so
--     pilot kitchens keep working. Who sees it is unchanged: v1.delivery shows it only to the customer on a
--     delivery of their own subscription. The seller read carries it for the owner only; staff and admin reads
--     never carry it.
--   * v1.profiles.phone: the customer's own phone, E.164, set or cleared by profile.update {name?, phone?}.
--     The actor read answers it (falling back to the verified auth phone), and provider.payment.customer
--     (paylater contact) prefers it over auth.users.phone.

alter table v1.caterers add column whatsapp text check(whatsapp ~ '^\+62[1-9][0-9]{7,12}$');
alter table v1.profiles add column phone text check(phone ~ '^\+62[1-9][0-9]{7,12}$');

-- A user's verified auth phone in E.164, or null. auth.users is read dynamically so a database without it (the
-- local demo) or a role without the grant simply has no number.
create function v1.verified_auth_phone(uid uuid) returns text language plpgsql stable set search_path='' as $$
declare p text;
begin
 if uid is null or to_regclass('auth.users') is null then return null;end if;
 begin
  execute 'select u.phone from auth.users u where u.id=$1 and u.phone is not null and u.phone_confirmed_at is not null'
   into p using uid;
 exception when insufficient_privilege or undefined_table then
  return null;
 end;
 p:=regexp_replace(coalesce(p,''),'\D','','g');
 p:=regexp_replace(p,'^(0062|62)?0?','62');
 p:='+'||p;
 return case when p ~ '^\+62[1-9][0-9]{7,12}$' then p end;
end $$;

create or replace function v1.caterer_whatsapp(cid uuid) returns text language plpgsql stable set search_path='' as $$
declare w text;
begin
 select c.whatsapp into w from v1.caterers c where c.id=cid;
 if w is not null then return w;end if;
 return (select v1.verified_auth_phone(st.user_id) from v1.staff st
  where st.caterer_id=cid and st.role='owner' and v1.verified_auth_phone(st.user_id) is not null order by st.user_id limit 1);
end $$;

-- A payload value that must be an E.164 Indonesian number or null. A trunk 0 kept after +62 (+620812...) is dropped.
create function v1.contact_phone(v jsonb) returns text language plpgsql immutable set search_path='' as $$
declare p text;
begin
 if v is null or jsonb_typeof(v)='null' then return null;end if;
 if jsonb_typeof(v)<>'string' then raise exception 'INVALID_INPUT';end if;
 p:=regexp_replace(v#>>'{}','^\+620','+62');
 if p !~ '^\+62[1-9][0-9]{7,12}$' then raise exception 'INVALID_INPUT';end if;
 return p;
end $$;

-- Renames the current entry point to its base. A body that names its own parameters with the function name
-- (catera_v1_command.request_id) is re-created under the new name, as 20261014100000_profile_update.sql does.
create function v1.rename_entry_point(fn text,args text,base text) returns void language plpgsql set search_path='' as $f$
declare d text;begin
 select pg_get_functiondef(('public.'||fn||'('||args||')')::regprocedure) into d;
 execute format('alter function public.%I(%s) rename to %I',fn,args,base);
 execute replace(replace(d,'public.'||fn||'(','public.'||base||'('),fn||'.',base||'.');
end $f$;

select v1.rename_entry_point('catera_v1_command','text,jsonb,uuid','catera_v1_command_contact_base');
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r jsonb; w text; cid uuid; n int;
begin
 if action not in('seller.create','seller.whatsapp','profile.update') then
  return public.catera_v1_command_contact_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'INVALID_INPUT';end if;
 if action='seller.create' then
  w:=v1.contact_phone(payload->'whatsapp');
  r:=public.catera_v1_command_contact_base(action,payload-'whatsapp',request_id);
  if w is not null then update v1.caterers set whatsapp=w where id=(r->>'id')::uuid;end if;
  return r;
 end if;
 if action='seller.whatsapp' then
  if not payload ? 'whatsapp' or (payload-'whatsapp'-'catererId')<>'{}'::jsonb then raise exception 'INVALID_INPUT';end if;
  w:=v1.contact_phone(payload->'whatsapp');
  if payload ? 'catererId' then
   if jsonb_typeof(payload->'catererId') is distinct from 'string'
    or payload->>'catererId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'INVALID_INPUT';end if;
   cid:=(payload->>'catererId')::uuid;
  else
   select count(*),min(st.caterer_id::text)::uuid into n,cid from v1.staff st where st.user_id=u and st.role='owner';
   if n>1 then raise exception 'INVALID_INPUT';end if;
  end if;
  if cid is null or not v1.is_staff(u,cid,true) then raise exception 'FORBIDDEN';end if;
  update v1.caterers set whatsapp=w where id=cid;
  return jsonb_build_object('catererId',cid,'whatsapp',w);
 end if;
 -- profile.update {name?, phone?}: at least one field.
 if payload='{}'::jsonb or (payload-'name'-'phone')<>'{}'::jsonb then raise exception 'INVALID_INPUT';end if;
 -- The answer echoes the fields sent: {name}, {phone} or both.
 w:=v1.contact_phone(payload->'phone');
 r:='{}';
 if payload ? 'name' then
  r:=public.catera_v1_command_contact_base(action,payload-'phone',request_id);
 end if;
 if payload ? 'phone' then
  update v1.profiles set phone=w where id=u;
  if not found then raise exception 'NOT_FOUND';end if;
  r:=r||jsonb_build_object('phone',w);
 end if;
 return r;
end $$;
revoke all on function public.catera_v1_command_contact_base(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

select v1.rename_entry_point('catera_v1_read','text,jsonb','catera_v1_read_contact_base');
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 result:=public.catera_v1_read_contact_base(resource,params);
 if resource='actor' and jsonb_typeof(result)='object' then
  result:=result||jsonb_build_object('phone',coalesce(result->>'phone',v1.verified_auth_phone(u)));
 elsif resource='seller' and jsonb_typeof(result->'caterer')='object' then
  -- The base read checked staff access. Only the owner is shown the kitchen's number.
  result:=jsonb_set(result,'{caterer}',(result->'caterer')-'whatsapp'
   ||case when v1.is_staff(u,(result->'caterer'->>'id')::uuid,true)
     then jsonb_build_object('whatsapp',(select c.whatsapp from v1.caterers c where c.id=(result->'caterer'->>'id')::uuid))
     else '{}'::jsonb end);
 elsif resource='admin' and jsonb_typeof(result->'caterers')='array' then
  result:=jsonb_set(result,'{caterers}',(select coalesce(jsonb_agg(c-'whatsapp' order by n),'[]'::jsonb)
   from jsonb_array_elements(result->'caterers') with ordinality t(c,n)));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read_contact_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

select v1.rename_entry_point('catera_v1_system','text,jsonb','catera_v1_system_contact_base');
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; ph text; u uuid; key uuid; old v1.receipts;
begin
 -- pilot.claim as in paid_seller_pilot, except that a wrong number ({status:'unavailable'}) keeps no receipt:
 -- the same request id may then be retried with the right number.
 if action='pilot.claim' then
  if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
  u:=(payload->>'userId')::uuid;key:=(payload->>'requestId')::uuid;
  if u is null or key is null then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtext(u::text));
  select * into old from v1.receipts where actor_id=u and request_id=key;
  if found then if old.hash<>md5(payload::text) then raise exception 'CONFLICT';end if;return old.result;end if;
  r:=v1.pilot_claim(u,payload->>'token',payload->>'verifiedPhone');
  if r->>'status' is distinct from 'unavailable' then insert into v1.receipts values(u,key,md5(payload::text),r);end if;
  return r;
 end if;
 r:=public.catera_v1_system_contact_base(action,payload);
 if action='provider.payment.customer' and jsonb_typeof(r)='object' then
  select p.phone into ph from v1.checkouts c join v1.profiles p on p.id=c.user_id where c.id=(payload->>'id')::uuid;
  if ph is not null then r:=r||jsonb_build_object('phone',ph);end if;
 end if;
 return r;
end $$;
revoke all on function public.catera_v1_system_contact_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
-- Claims are proved by a typed phone now, not an SMS. The preview shows the first and last four digits, so a wrong
-- number counts against the link: the mismatch commits (an answer, not an exception) and the fifth one expires the link.
-- A wrong token, an expired or used link stay CLAIM_UNAVAILABLE exceptions as before.
alter table v1.customer_claims add column failed_attempts int not null default 0;
create or replace function v1.pilot_claim(u uuid,token text,phone text) returns jsonb language plpgsql set search_path='' as $$
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
 if link.used_at is not null or link.expires_at<=clock_timestamp() then raise exception 'CLAIM_UNAVAILABLE';end if;
 if cr.phone is distinct from phone then
  update v1.customer_claims set failed_attempts=failed_attempts+1,
   expires_at=case when failed_attempts+1>=5 then least(expires_at,clock_timestamp()) else expires_at end where id=link.id;
  return jsonb_build_object('status','unavailable');
 end if;
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

revoke all on function v1.verified_auth_phone(uuid),v1.caterer_whatsapp(uuid),v1.contact_phone(jsonb),v1.pilot_claim(uuid,text,text) from public,anon,authenticated;
drop function v1.rename_entry_point(text,text,text);
