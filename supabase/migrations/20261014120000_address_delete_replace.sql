-- Address delete and move (Phase G, G13).
--   An address is in use while a delivery day of the caller dated today (Jakarta) or later, not
--   delivered or cancelled, carries its id in its address copy, or while a live pending checkout
--   (state 'pending', not expired) points at it.
--   address.delete {addressId} soft-deletes an unused address (archived_at) and raises
--   ADDRESS_IN_USE otherwise. Paid checkouts and past days keep reading the row.
--   address.replace {fromAddressId,toAddressId} moves every movable day to the other address in one
--   transaction: the day is still 'scheduled', before its one-day cutoff, and the target lies in its
--   plan's areas (COVERAGE per plan). Other days stay. When nothing uses the old address afterwards
--   it is archived in the same transaction.
--   Lock order as delivery.address and checkout.create: the caller's lock, then each caterer's
--   'pilot:' lock in caterer id order, then the day rows in id order, so a move serialises with
--   delivery.cook and delivery.depart on the same day and with the caller's own checkouts.
--   Archived addresses leave the reads (customer list, seller import options, renewal context) and
--   are refused by checkout.create, quote, address.save and delivery.address.
--   Editing an address (address.save with an id) is unchanged: it updates the row only, and the
--   days already booked keep the copy they were given.

alter table v1.addresses add column if not exists archived_at timestamptz;

create or replace function v1.address_use(uid uuid, aid uuid) returns jsonb language sql stable set search_path='' as $$
 with days as (
  select d.service_date,p.caterer_id from v1.delivery_days d
   join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where s.user_id=uid and d.address->>'id'=aid::text and d.status not in('delivered','cancelled')
   and d.service_date>=(now() at time zone 'Asia/Jakarta')::date
 ), pending as (
  select c.id from v1.checkouts c where c.user_id=uid and c.address_id=aid and c.state='pending' and c.expires_at>clock_timestamp()
 )
 select jsonb_build_object(
  'addressId',aid,
  'count',(select count(*) from days),
  'from',(select min(service_date) from days),
  'to',(select max(service_date) from days),
  'kitchens',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id)
   from v1.caterers c where c.id in(select caterer_id from days)),'[]'::jsonb),
  'pendingCheckouts',(select count(*) from pending))
$$;
revoke all on function v1.address_use(uuid,uuid) from public,anon,authenticated;

-- The current command body names its own receipt lookup with the function name, so the base is
-- re-created under its new name, as 20261014100000_profile_update.sql does.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_address_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_address_base('),
   'catera_v1_command.request_id','catera_v1_command_address_base.request_id');
end $$;
revoke all on function public.catera_v1_command_address_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); old v1.receipts; fingerprint text:=md5(action||payload::text); result jsonb;
 aid uuid; src v1.addresses; dst v1.addresses; cid uuid; r record; use jsonb;
 moved int:=0; stayed int:=0; until date; reason text; kitchens jsonb:='{}'::jsonb;
begin
 if action not in('address.delete','address.replace','checkout.create','address.save','delivery.address') then
  return public.catera_v1_command_address_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action in('checkout.create','address.save','delivery.address') then
  -- The caller's lock first, as the base takes it, so an archive and this command never interleave.
  perform pg_advisory_xact_lock(hashtext(u::text));
  if jsonb_typeof(payload) is not distinct from 'object' then
   begin aid:=nullif(payload->>case when action='address.save' then 'id' else 'addressId' end,'')::uuid;
   exception when others then aid:=null;end;
   if aid is not null and exists(select 1 from v1.addresses where id=aid and archived_at is not null) then raise exception 'NOT_FOUND';end if;
  end if;
  return public.catera_v1_command_address_base(action,payload,request_id);
 end if;

 if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'INVALID_INPUT';end if;
 if action='address.delete' and (not(payload ? 'addressId') or (payload - 'addressId')<>'{}'::jsonb) then raise exception 'INVALID_INPUT';end if;
 if action='address.replace' and (not(payload ?& array['fromAddressId','toAddressId']) or (payload - array['fromAddressId','toAddressId'])<>'{}'::jsonb
  or payload->>'fromAddressId'=payload->>'toAddressId') then raise exception 'INVALID_INPUT';end if;
 begin
  aid:=(payload->>case when action='address.delete' then 'addressId' else 'fromAddressId' end)::uuid;
  if action='address.replace' then dst.id:=(payload->>'toAddressId')::uuid;end if;
 exception when others then raise exception 'INVALID_INPUT';end;
 if aid is null or (action='address.replace' and dst.id is null) then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts x where x.actor_id=u and x.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 select * into src from v1.addresses where id=aid and user_id=u for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if action='address.replace' then
  select * into dst from v1.addresses where id=dst.id and user_id=u and archived_at is null;
  if not found then raise exception 'NOT_FOUND';end if;
 end if;

 if action='address.delete' then
  if src.archived_at is null then
   use:=v1.address_use(u,aid);
   if (use->>'count')::int>0 or (use->>'pendingCheckouts')::int>0 then raise exception 'ADDRESS_IN_USE';end if;
   update v1.addresses set archived_at=now(),version=version+1 where id=aid;
  end if;
  result:=jsonb_build_object('id',aid,'deleted',true);
 else
  if src.archived_at is not null then raise exception 'NOT_FOUND';end if;
  for cid in
   select distinct p.caterer_id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
   where s.user_id=u and d.address->>'id'=aid::text and d.status not in('delivered','cancelled')
    and d.service_date>=(now() at time zone 'Asia/Jakarta')::date
   order by p.caterer_id
  loop
   perform pg_advisory_xact_lock(hashtext('pilot:'||cid::text));
  end loop;
  -- Rows locked and re-read after the caterer locks: a day delivery.cook moved meanwhile is no longer 'scheduled'.
  for r in
   select d.id,d.service_date,d.status,s.snapshot->'offer' o,p.caterer_id,c.name from v1.delivery_days d
    join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id join v1.caterers c on c.id=p.caterer_id
   where s.user_id=u and d.address->>'id'=aid::text and d.status not in('delivered','cancelled')
    and d.service_date>=(now() at time zone 'Asia/Jakarta')::date
   order by d.id for update of d
  loop
   reason:=case when r.status<>'scheduled' or v1.cutoff(r.o,r.service_date)<=clock_timestamp() then 'CUTOFF'
    when not coalesce(r.o->'areas' ? dst.area,false) then 'COVERAGE' end;
   if reason is null then
    update v1.delivery_days set address=to_jsonb(dst)-'user_id'-'archived_at',version=version+1 where id=r.id;
    moved:=moved+1;
   else
    stayed:=stayed+1;until:=greatest(until,r.service_date);
    kitchens:=kitchens||jsonb_build_object(r.caterer_id::text,jsonb_build_object('id',r.caterer_id,'name',r.name,
     'reason',case when kitchens->r.caterer_id::text->>'reason'='COVERAGE' then 'COVERAGE' else reason end));
   end if;
  end loop;
  if moved>0 then
   insert into public.catera_v1_events(id,user_id,topic) values(gen_random_uuid(),u,'delivery.changed');
  end if;
  use:=v1.address_use(u,aid);
  if (use->>'count')::int=0 and (use->>'pendingCheckouts')::int=0 then
   update v1.addresses set archived_at=now(),version=version+1 where id=aid;
  end if;
  result:=jsonb_build_object('fromAddressId',aid,'toAddressId',dst.id,'moved',moved,'stayed',stayed,'stayedUntil',until,
   'kitchens',coalesce((select jsonb_agg(v order by v->>'name',v->>'id') from jsonb_each(kitchens) e(k,v)),'[]'::jsonb),
   'pendingCheckouts',(use->>'pendingCheckouts')::int,
   'deleted',(use->>'count')::int=0 and (use->>'pendingCheckouts')::int=0);
 end if;
 insert into v1.audit(actor_id,action,details) values(u,action,payload||jsonb_build_object('requestId',request_id,'result',result));
 insert into v1.receipts(actor_id,request_id,hash,result) values(u,request_id,fingerprint,result);
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_address_base;
revoke all on function public.catera_v1_read_address_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); aid uuid; result jsonb;
begin
 if resource='address-use' then
  if u is null then raise exception 'UNAUTHORIZED';end if;
  begin aid:=(params->>'id')::uuid;exception when others then raise exception 'INVALID_INPUT';end;
  if aid is null or not exists(select 1 from v1.addresses where id=aid and user_id=u and archived_at is null) then raise exception 'NOT_FOUND';end if;
  return v1.address_use(u,aid);
 end if;
 if resource='quote' and jsonb_typeof(params) is not distinct from 'object' then
  begin aid:=nullif(params->>'addressId','')::uuid;exception when others then aid:=null;end;
  if aid is not null and exists(select 1 from v1.addresses where id=aid and archived_at is not null) then raise exception 'NOT_FOUND';end if;
 end if;
 result:=public.catera_v1_read_address_base(resource,params);
 if resource='customer' and jsonb_typeof(result->'addresses')='array' then
  result:=jsonb_set(result,'{addresses}',coalesce((select jsonb_agg(x order by n) from jsonb_array_elements(result->'addresses') with ordinality t(x,n)
   where not exists(select 1 from v1.addresses a where a.id::text=x->>'id' and a.archived_at is not null)),'[]'::jsonb));
 elsif resource='seller-import-options' and jsonb_typeof(result->'customers')='array' then
  result:=jsonb_set(result,'{customers}',coalesce((select jsonb_agg(jsonb_set(cu,'{addresses}',coalesce((select jsonb_agg(x order by n)
   from jsonb_array_elements(cu->'addresses') with ordinality t(x,n)
   where not exists(select 1 from v1.addresses a where a.id::text=x->>'id' and a.archived_at is not null)),'[]'::jsonb)) order by m)
   from jsonb_array_elements(result->'customers') with ordinality q(cu,m)),'[]'::jsonb));
 elsif resource='renewal-context' and exists(select 1 from v1.addresses a where a.id::text=result->>'addressId' and a.archived_at is not null) then
  result:=result||jsonb_build_object('addressId',null);
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
