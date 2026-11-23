-- Active delivery stop contact (2026-11-22).
-- Adds `customer.phone` on today's active (non-cancelled) deliveries inside the `seller` operations read so owners
-- and helpers running today's delivery route can message/call the recipient in one tap from Urutan antar.
-- Privacy scope:
--   * Base read still enforces caterer staff membership (else FORBIDDEN).
--   * Phone is attached ONLY when `operationalDate = today` and the delivery is not cancelled.
--   * Helpers remain blocked from past/future dates' phone numbers and from the `Pelanggan` directory.

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_stop_phone_base;
revoke all on function public.catera_v1_read_stop_phone_base(text,jsonb) from public,anon,authenticated;

create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cid uuid;
begin
 result:=public.catera_v1_read_stop_phone_base(resource,params);
 if resource='seller'
   and nullif(params->>'id','') is not null
   and result->>'operationalDate' is not null
   and result->>'operationalDate' = result->>'today'
   and jsonb_typeof(result->'deliveries')='array' then
  cid:=(params->>'id')::uuid;
  result:=jsonb_set(result,'{deliveries}',coalesce((
   select jsonb_agg(
    case
     when d.status is distinct from 'cancelled'
      and x->>'status' is distinct from 'cancelled'
      and exists (
       select 1 from v1.fulfillments f
       where f.day_id=d.id and f.status is distinct from 'cancelled'
      )
      and coalesce(nullif(cr.phone,''),nullif(pf.phone,'')) is not null
     then jsonb_set(x,'{customer}',coalesce(x->'customer','{}'::jsonb)||jsonb_build_object('phone',coalesce(nullif(cr.phone,''),nullif(pf.phone,''))))
     else x
    end
    order by o
   )
   from jsonb_array_elements(result->'deliveries') with ordinality t(x,o)
   left join v1.delivery_days d on d.id=(x->>'id')::uuid
   left join v1.subscriptions s on s.id=d.subscription_id
   left join v1.customer_records cr on cr.id=s.customer_record_id and cr.caterer_id=cid
   left join v1.profiles pf on pf.id=s.user_id
  ),'[]'::jsonb));
 end if;
 return result;
end $$;

revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
