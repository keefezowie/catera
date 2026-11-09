-- The seller read listed payment_url on unpaid checkouts (2026-11-09). That is the customer's hosted DOKU page: any
-- staff member could open it, see the amount and pay or forward it. The caterer app never uses the field.
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_no_payurl_base;
revoke all on function public.catera_v1_read_no_payurl_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.catera_v1_read_no_payurl_base(resource,params);
 if resource='seller' and jsonb_typeof(result->'transactions')='array' then
  result:=jsonb_set(result,'{transactions}',coalesce((select jsonb_agg(x-'payment_url' order by n)
   from jsonb_array_elements(result->'transactions') with ordinality t(x,n)),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
