-- Catera Dapur answers a customer's delivery report (walkthrough K-04).
-- The caterer's delivery-issues read (params.id = caterer) gains who sent each report:
--   customerName      the caterer's record name for the customer, else their profile name
--   customerPhone     the number on the caterer's own customer record, if any (for "Chat WhatsApp")
--   customerRecordId  that customer record
-- Additive keys only. The base read still authorizes (staff of that caterer, else FORBIDDEN);
-- the customer's own list (no params.id) is returned unchanged.

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_issue_customer_base;
revoke all on function public.catera_v1_read_issue_customer_base(text,jsonb) from public,anon,authenticated;

create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;cid uuid;
begin
 r:=public.catera_v1_read_issue_customer_base(resource,params);
 if resource is distinct from 'delivery-issues' or nullif(params->>'id','') is null or jsonb_typeof(r) is distinct from 'array' then
  return r;
 end if;
 cid:=(params->>'id')::uuid;
 return coalesce((
  select jsonb_agg(x||jsonb_build_object(
   'customerName',coalesce(cr.name,pf.name),
   'customerPhone',cr.phone,
   'customerRecordId',cr.id
  ) order by o)
  from jsonb_array_elements(r) with ordinality t(x,o)
  left join v1.delivery_days d on d.id=(x->>'day_id')::uuid
  left join v1.subscriptions s on s.id=d.subscription_id
  left join v1.customer_records cr on cr.id=s.customer_record_id and cr.caterer_id=cid
  left join v1.profiles pf on pf.id=(x->>'user_id')::uuid
 ),'[]'::jsonb);
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
