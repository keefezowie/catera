-- Owner-only choices for the guided prepaid importer. No global customer lookup.
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_usability_base;
revoke all on function public.catera_v1_read_usability_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; result jsonb;
begin
 if resource='seller-import-options' then
  if u is null then raise exception 'UNAUTHORIZED';end if;
  cid:=(params->>'id')::uuid;
  if cid is null or not v1.is_staff(u,cid,true) then raise exception 'FORBIDDEN';end if;
  return jsonb_build_object(
   'customers',coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'source',r.source,
    'addresses',coalesce((select jsonb_agg(to_jsonb(a)-'user_id' order by a.label,a.id) from v1.addresses a where a.user_id=p.id),'[]'::jsonb)
   ) order by p.name,p.id) from v1.relationships r join v1.profiles p on p.id=r.user_id where r.caterer_id=cid),'[]'::jsonb),
   'packages',coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.offer->>'name','days',(p.offer->>'days')::int,'areas',c.areas,'meal',p.offer->>'meal'
   ) order by p.offer->>'name',p.id) from v1.packages p join v1.caterers c on c.id=p.caterer_id where p.caterer_id=cid and p.status='published' and c.status='approved'),'[]'::jsonb)
  );
 end if;
 -- Existing resource guards run before enriching records with readable names.
 result:=public.catera_v1_read_usability_base(resource,params);
 if resource in('seller','admin') then
  result:=jsonb_set(result,'{transactions}',coalesce((select jsonb_agg(x||jsonb_build_object('customerName',p.name) order by x->>'created_at' desc)
   from jsonb_array_elements(result->'transactions') x left join v1.profiles p on p.id=(x->>'user_id')::uuid),'[]'::jsonb));
 end if;
 if resource='admin' then
  result:=jsonb_set(result,'{audit}',coalesce((select jsonb_agg(x||jsonb_build_object('actorName',p.name) order by x->>'created_at' desc)
   from jsonb_array_elements(result->'audit') x left join v1.profiles p on p.id=(x->>'actor_id')::uuid),'[]'::jsonb));
  result:=jsonb_set(result,'{payouts}',coalesce((select jsonb_agg(x||jsonb_build_object('catererName',c.name))
   from jsonb_array_elements(result->'payouts') x left join v1.caterers c on c.id=(x->>'caterer_id')::uuid),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;
