-- Staged migration: existing configuration remains hosted until explicitly cut over.
alter table v1.payment_provider_config add column payment_mode text not null default 'hosted' check(payment_mode in('hosted','direct'));
alter table v1.payment_provider_config add column direct_methods text[] not null default '{}';
alter table v1.checkouts add column payment_mode text not null default 'hosted' check(payment_mode in('hosted','direct'));
alter table v1.provider_operations add column payment_mode text not null default 'hosted';
alter table v1.provider_operations add column channel text check(channel in('VIRTUAL_ACCOUNT_BRI','QRIS'));

create function v1.direct_checkout_mode() returns trigger language plpgsql set search_path='' as $$
declare cfg v1.payment_provider_config;begin
 if tg_op='UPDATE' then
  if new.payment_mode is distinct from old.payment_mode then raise exception 'IMMUTABLE_PROVIDER';end if;
 else
  select * into strict cfg from v1.payment_provider_config where id;
  new.payment_mode:=case when cfg.provider='doku' then cfg.payment_mode else 'hosted' end;
  if new.payment_mode='direct' and cardinality(cfg.direct_methods)=0 then raise exception 'PAYMENT_UNAVAILABLE';end if;
 end if;return new;
end $$;
create trigger checkout_direct_mode before insert or update of payment_mode on v1.checkouts for each row execute function v1.direct_checkout_mode();
create function v1.direct_operation_identity() returns trigger language plpgsql set search_path='' as $$ begin
 if (new.payment_mode,new.channel) is distinct from (old.payment_mode,old.channel) then raise exception 'IMMUTABLE_PROVIDER';end if;return new;
end $$;
create trigger direct_operation_identity before update of payment_mode,channel on v1.provider_operations for each row execute function v1.direct_operation_identity();

alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_direct_base;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c v1.checkouts;o v1.provider_operations;cfg v1.payment_provider_config;begin
 if action not in('checkout.payment.start','checkout.payment.refresh') then return public.catera_v1_command_direct_base(action,payload,request_id);end if;
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 select * into c from v1.checkouts where id=(payload->>'id')::uuid and user_id=auth.uid() for update;
 if c.id is null then raise exception 'NOT_FOUND';end if;
 if c.payment_mode<>'direct' then raise exception 'INVALID_STATE';end if;
 select * into o from v1.provider_operations where kind='payment' and entity_id=c.id;
 if action='checkout.payment.start' then
  if o.id is not null then
   if o.channel is distinct from payload->>'method' then raise exception 'PAYMENT_METHOD_LOCKED';end if;
  else
   if c.state<>'pending' or c.expires_at<=clock_timestamp()+interval '1 minute' then raise exception 'PAYMENT_HOLD_TOO_SHORT';end if;
   select * into strict cfg from v1.payment_provider_config where id;
   if cfg.provider<>c.provider or cfg.environment<>c.provider_environment or cfg.merchant<>c.provider_merchant or cfg.payment_mode<>'direct' or not coalesce(payload->>'method'=any(cfg.direct_methods),false) then raise exception 'PAYMENT_UNAVAILABLE';end if;
   insert into v1.provider_operations(kind,entity_id,merchant,reference,amount,state,payment_mode,channel)
    values('payment',c.id,c.provider_merchant,'CT'||replace(c.id::text,'-',''),(c.quote->>'total')::int,'preparing','direct',payload->>'method') returning * into o;
   update v1.checkouts set provider_id=o.reference where id=c.id;
  end if;
 end if;
 return jsonb_build_object('id',c.id);
end $$;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_direct_base;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;c v1.checkouts;o v1.provider_operations;cfg v1.payment_provider_config;begin
 if resource='payment-methods' then
  select * into strict cfg from v1.payment_provider_config where id;
  return jsonb_build_object('mode',case when cfg.provider='doku' then cfg.payment_mode else 'hosted' end,'availableMethods',case when cfg.provider='doku' and cfg.payment_mode='direct' then to_jsonb(cfg.direct_methods) else '[]'::jsonb end);
 end if;
 r:=public.catera_v1_read_direct_base(resource,params);
 if resource='checkout' then
  select * into c from v1.checkouts where id=(params->>'id')::uuid and user_id=auth.uid();
  if c.id is null then raise exception 'NOT_FOUND';end if;
  r:=r||jsonb_build_object('payment_mode',c.payment_mode);
  if c.payment_mode='direct' then
   select * into o from v1.provider_operations where kind='payment' and entity_id=c.id;
   select * into strict cfg from v1.payment_provider_config where id;
   r:=r||jsonb_build_object('payment',jsonb_build_object('mode','direct',
    'availableMethods',case when cfg.provider=c.provider and cfg.environment=c.provider_environment and cfg.merchant=c.provider_merchant and cfg.payment_mode='direct' then to_jsonb(cfg.direct_methods) else '[]'::jsonb end,
    'selectedMethod',o.channel,'expiresAt',coalesce(o.result->>'expiresAt',c.expires_at::text),
    'status',case when c.state='paid' then 'paid' when c.state in('failed','expired') then c.state when o.id is null then 'choose_method' when o.state='failed' then 'failed' when o.result ? 'instructions' then 'awaiting_payment' when o.state='preparing' then 'preparing' else 'checking' end,
    'instructions',case when c.state='pending' and least(c.expires_at,coalesce((o.result->>'expiresAt')::timestamptz,c.expires_at))>clock_timestamp() then o.result->'instructions' else null end));
  end if;
 end if;return r;
end $$;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_direct_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare o v1.provider_operations;c v1.checkouts;cfg v1.payment_provider_config;begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='provider.direct.configure' then
  if payload->>'mode' not in('hosted','direct') or length(coalesce(payload->>'reason',''))<5 or jsonb_typeof(payload->'methods')<>'array' then raise exception 'INVALID_INPUT';end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'methods') x where x not in('VIRTUAL_ACCOUNT_BRI','QRIS')) then raise exception 'INVALID_INPUT';end if;
  update v1.payment_provider_config set payment_mode=payload->>'mode',direct_methods=array(select jsonb_array_elements_text(payload->'methods')) where id;
  insert into v1.audit(action,details) values(action,payload);return '{}';
 elsif action='provider.direct.submit' then
  select * into c from v1.checkouts where id=(payload->>'id')::uuid for update;
  select * into o from v1.provider_operations where kind='payment' and entity_id=c.id for update;
  if o.id is null or o.payment_mode<>'direct' then raise exception 'NOT_FOUND';end if;
  if o.state<>'preparing' then return to_jsonb(o)||jsonb_build_object('submit',false);end if;
  select * into strict cfg from v1.payment_provider_config where id;
  if cfg.provider<>o.provider or cfg.environment<>o.environment or cfg.merchant<>o.merchant or cfg.payment_mode<>'direct' or not(o.channel=any(cfg.direct_methods)) then raise exception 'PAYMENT_UNAVAILABLE';end if;
  if c.state<>'pending' or c.expires_at<=clock_timestamp()+interval '30 seconds' then raise exception 'PAYMENT_HOLD_TOO_SHORT';end if;
  update v1.provider_operations set request=payload->'request',state='submitting',lease_until=clock_timestamp()+interval '45 seconds',polled_at=clock_timestamp() where id=o.id returning * into o;
  return to_jsonb(o)||jsonb_build_object('submit',true);
 elsif action='provider.direct.attached' then
  select * into c from v1.checkouts where id=(payload->>'id')::uuid for update;
  select * into o from v1.provider_operations where kind='payment' and entity_id=c.id for update;
  if o.id is null or o.payment_mode<>'direct' then raise exception 'NOT_FOUND';end if;
  if (payload->'result'->>'expiresAt')::timestamptz>c.expires_at then raise exception 'DOKU_EXPIRY_MISMATCH';end if;
  if o.result ? 'instructions' then return '{}';end if;
  update v1.provider_operations set result=payload->'result',state=case when state='submitting' then 'pending' else state end,lease_until=null,error_code=null where id=o.id;return '{}';
 elsif action='provider.direct.refresh' then
  update v1.provider_operations set polled_at=clock_timestamp() where kind='payment' and entity_id=(payload->>'id')::uuid and payment_mode='direct' and state in('pending','submitting') and (lease_until is null or lease_until<clock_timestamp()) and (polled_at is null or polled_at<clock_timestamp()-interval '1 minute') returning * into o;
  return case when o.id is null then null else to_jsonb(o) end;
 elsif action in('provider.payment.claim','provider.payment.attached','payment.attach') then
  select * into c from v1.checkouts where id=(payload->>'id')::uuid;
  if c.payment_mode='direct' then raise exception 'DIRECT_PAYMENT_REQUIRED';end if;
 end if;
 return public.catera_v1_system_direct_base(action,payload);
end $$;
revoke all on function v1.direct_checkout_mode(),v1.direct_operation_identity() from public,anon,authenticated;
revoke all on function public.catera_v1_command_direct_base(text,jsonb,uuid),public.catera_v1_read_direct_base(text,jsonb),public.catera_v1_system_direct_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid),public.catera_v1_read(text,jsonb),public.catera_v1_system(text,jsonb) from public;
revoke all on function public.catera_v1_system(text,jsonb) from anon,authenticated;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
