-- Payment channels: every direct DOKU method (7 bank virtual accounts, QRIS, 4 e-wallets, 3 paylater) is allowed.
-- Redirect channels use a DOKU Checkout invoice (under 30 characters, same value as dokuInvoice in packages/backend).
-- provider.payment.customer gives the server the contact fields a paylater request needs; it is service role only.

alter table v1.provider_operations drop constraint provider_operations_channel_check;
alter table v1.provider_operations add constraint provider_operations_channel_check check(channel in(
 'QRIS','VIRTUAL_ACCOUNT_BCA','VIRTUAL_ACCOUNT_BANK_MANDIRI','VIRTUAL_ACCOUNT_BRI','VIRTUAL_ACCOUNT_BNI',
 'VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI','VIRTUAL_ACCOUNT_BANK_PERMATA','VIRTUAL_ACCOUNT_BANK_CIMB',
 'EMONEY_SHOPEE_PAY','EMONEY_DANA','EMONEY_OVO','EMONEY_LINKAJA',
 'PEER_TO_PEER_KREDIVO','PEER_TO_PEER_AKULAKU','PEER_TO_PEER_INDODANA'));

alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_channels_base;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;h text;begin
 r:=public.catera_v1_command_channels_base(action,payload,request_id);
 if action='checkout.payment.start' and payload->>'method' in('EMONEY_SHOPEE_PAY','EMONEY_DANA','EMONEY_OVO','EMONEY_LINKAJA','PEER_TO_PEER_KREDIVO','PEER_TO_PEER_AKULAKU','PEER_TO_PEER_INDODANA') then
  h:='CT'||left(encode(sha256(convert_to((payload->>'id')::uuid::text,'UTF8')),'hex'),26);
  update v1.provider_operations set reference=h where kind='payment' and entity_id=(payload->>'id')::uuid and reference<>h;
  update v1.checkouts set provider_id=h where id=(payload->>'id')::uuid and provider_id is distinct from h;
 end if;
 return r;
end $$;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_channels_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare c v1.checkouts;nm text;ph text;em text;ln text;ct text;pk text;begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='provider.direct.configure' then
  if payload->>'mode' not in('hosted','direct') or length(coalesce(payload->>'reason',''))<5 or jsonb_typeof(payload->'methods')<>'array' then raise exception 'INVALID_INPUT';end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'methods') x where x not in(
   'QRIS','VIRTUAL_ACCOUNT_BCA','VIRTUAL_ACCOUNT_BANK_MANDIRI','VIRTUAL_ACCOUNT_BRI','VIRTUAL_ACCOUNT_BNI',
   'VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI','VIRTUAL_ACCOUNT_BANK_PERMATA','VIRTUAL_ACCOUNT_BANK_CIMB',
   'EMONEY_SHOPEE_PAY','EMONEY_DANA','EMONEY_OVO','EMONEY_LINKAJA',
   'PEER_TO_PEER_KREDIVO','PEER_TO_PEER_AKULAKU','PEER_TO_PEER_INDODANA')) then raise exception 'INVALID_INPUT';end if;
  update v1.payment_provider_config set payment_mode=payload->>'mode',direct_methods=array(select jsonb_array_elements_text(payload->'methods')) where id;
  insert into v1.audit(action,details) values(action,payload);return '{}';
 elsif action='provider.payment.customer' then
  select * into c from v1.checkouts where id=(payload->>'id')::uuid;
  if c.id is null then raise exception 'NOT_FOUND';end if;
  select p.name into nm from v1.profiles p where p.id=c.user_id;
  select a.line,a.city into ln,ct from v1.addresses a where a.id=c.address_id;
  select coalesce(c.quote->>'packageName',k.offer->>'name') into pk from v1.packages k where k.id=c.package_id;
  if to_regclass('auth.users') is not null then
   execute 'select u.phone,u.email from auth.users u where u.id=$1' into ph,em using c.user_id;
  end if;
  return jsonb_build_object('name',nm,'phone',nullif(ph,''),'email',nullif(em,''),'address',ln,'city',ct,'postcode',null,'packageName',pk);
 end if;
 return public.catera_v1_system_channels_base(action,payload);
end $$;

revoke all on function public.catera_v1_command_channels_base(text,jsonb,uuid),public.catera_v1_system_channels_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid),public.catera_v1_system(text,jsonb) from public;
revoke all on function public.catera_v1_system(text,jsonb) from anon,authenticated;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
