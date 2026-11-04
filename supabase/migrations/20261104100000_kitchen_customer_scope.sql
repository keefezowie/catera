-- A kitchen sees only its own customers, and only the addresses they gave it (security audit 2026-11-04, M1).
--   v1.relationships gains a row the moment a customer opens a checkout, before any payment. The caterer's import
--   options read listed every such person with their whole address book, and import.commit {customerId} accepted
--   them. Both now go by what the customer actually gave this kitchen:
--   * a kitchen customer has a subscription on one of the kitchen's packages, or is on a customer record the kitchen
--     itself created with a phone number (an invited or claimed customer). An abandoned checkout is neither. Records
--     backfilled from relationships in 20260914160856 carry no phone, so they do not count on their own either.
--   * a kitchen address is one a delivery day of that customer's subscriptions with the kitchen was sent to.
--   Pricing attribution still reads v1.relationships.source; it is untouched. Authorization is unchanged: the base
--   read and the base import row run their own staff checks first.

create function v1.kitchen_customer(u uuid,cid uuid) returns boolean language sql stable set search_path='' as $$
 select u is not null and cid is not null and (
  exists(select 1 from v1.subscriptions s join v1.packages p on p.id=s.package_id where s.user_id=u and p.caterer_id=cid)
  or exists(select 1 from v1.customer_records r where r.user_id=u and r.caterer_id=cid and r.phone is not null))
$$;
create function v1.kitchen_address(u uuid,cid uuid,aid uuid) returns boolean language sql stable set search_path='' as $$
 select u is not null and cid is not null and aid is not null and exists(select 1 from v1.delivery_days d
  join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
  where s.user_id=u and p.caterer_id=cid and d.address->>'id'=aid::text)
$$;
revoke all on function v1.kitchen_customer(uuid,uuid) from public,anon,authenticated;
revoke all on function v1.kitchen_address(uuid,uuid,uuid) from public,anon,authenticated;

-- import.preview and import.commit: a row naming a Catera account must name one of the kitchen's customers, and a
-- saved address of theirs only when they gave it to this kitchen. Other rows (a record id, or a new customer typed in
-- with their own address) are unchanged.
alter function v1.pilot_import_row(uuid,jsonb,boolean) rename to pilot_import_row_scope_base;
create function v1.pilot_import_row(cid uuid,a jsonb,commit_row boolean) returns jsonb language plpgsql set search_path='' as $$
declare who uuid; aid uuid;
begin
 if jsonb_typeof(a) is not distinct from 'object' and nullif(a->>'customerRecordId','') is null
   and nullif(a->>'customerId','') is not null then
  begin who:=(a->>'customerId')::uuid;exception when others then raise exception 'INVALID_INPUT';end;
  if not v1.kitchen_customer(who,cid) then raise exception 'FORBIDDEN';end if;
 end if;
 if jsonb_typeof(a) is not distinct from 'object' and nullif(a->>'addressId','') is not null then
  begin aid:=(a->>'addressId')::uuid;exception when others then raise exception 'INVALID_INPUT';end;
  if who is null and nullif(a->>'customerRecordId','') is not null then
   begin
    select r.user_id into who from v1.customer_records r where r.id=(a->>'customerRecordId')::uuid and r.caterer_id=cid;
   exception when others then raise exception 'INVALID_INPUT';end;
  end if;
  if not v1.kitchen_address(who,cid,aid) then raise exception 'FORBIDDEN';end if;
 end if;
 return v1.pilot_import_row_scope_base(cid,a,commit_row);
end $$;
revoke all on function v1.pilot_import_row(uuid,jsonb,boolean) from public,anon,authenticated;
revoke all on function v1.pilot_import_row_scope_base(uuid,jsonb,boolean) from public,anon,authenticated;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_scope_base;
revoke all on function public.catera_v1_read_scope_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cid uuid;
begin
 result:=public.catera_v1_read_scope_base(resource,params);
 if resource='seller-import-options' and jsonb_typeof(result->'customers')='array' then
  -- The base read has already checked that the caller is this kitchen's staff, so the id is a valid kitchen.
  cid:=(params->>'id')::uuid;
  result:=jsonb_set(result,'{customers}',coalesce((select jsonb_agg(jsonb_set(cu,'{addresses}',coalesce((select jsonb_agg(x order by n)
    from jsonb_array_elements(cu->'addresses') with ordinality t(x,n)
    where x->>'id' ~ '^[0-9a-fA-F-]{36}$' and v1.kitchen_address((cu->>'id')::uuid,cid,(x->>'id')::uuid)),'[]'::jsonb)) order by m)
   from jsonb_array_elements(result->'customers') with ordinality q(cu,m)
   where cu->>'id' ~ '^[0-9a-fA-F-]{36}$' and v1.kitchen_customer((cu->>'id')::uuid,cid)),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
