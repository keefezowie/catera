-- Dapur's customer read never carries an archived address (Phase G, G13 follow-up).
--   A customer record keeps a copy of the address of the first plan. When the customer later archives that
--   address (address.delete, or address.replace after the days moved), the copy still named it. The read now
--   answers, for a record whose copy names an archived address of the same customer, the address of the next
--   delivery day of that record still to come, else an empty address. The customer's wider address book is
--   never read here: kitchen staff see only addresses the customer gave that kitchen.
--   Authorization is unchanged: the base read runs first, with its own staff check.

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_live_address_base;
revoke all on function public.catera_v1_read_live_address_base(text,jsonb) from public,anon,authenticated;

create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; uuid_re constant text:='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
 result:=public.catera_v1_read_live_address_base(resource,params);
 if resource='seller-customers' and jsonb_typeof(result->'customers')='array' then
  result:=jsonb_set(result,'{customers}',coalesce((select jsonb_agg(
   case when cu->>'user_id' ~ uuid_re and cu->>'id' ~ uuid_re and cu->'address'->>'id' ~ uuid_re
     and exists(select 1 from v1.addresses a
      where a.id=(cu->'address'->>'id')::uuid and a.user_id=(cu->>'user_id')::uuid and a.archived_at is not null)
    then jsonb_set(cu,'{address}',coalesce(
     (select d.address from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id
       where s.customer_record_id=(cu->>'id')::uuid and d.status not in('delivered','cancelled')
        and d.service_date>=(now() at time zone 'Asia/Jakarta')::date
        and not (coalesce(d.address->>'id','') ~ uuid_re and exists(select 1 from v1.addresses a
          where a.id=(d.address->>'id')::uuid and a.archived_at is not null))
       order by d.service_date,d.id limit 1),
     '{}'::jsonb))
    else cu end order by n)
   from jsonb_array_elements(result->'customers') with ordinality t(cu,n)),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
