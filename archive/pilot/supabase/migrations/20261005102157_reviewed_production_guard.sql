-- Preserve the existing RPC, lock order, ACLs and accounting boundary. Replace only
-- the readiness check, and fail closed if a prior deployment changed that block.
do $migration$
declare
  definition text;
  original text := $original$ if state='ready' and (item.menu_id is null or not exists(select 1 from public.production_versions where business_id=b and service_date=item.service_date and slot_id=item.slot_id)
 or (select incomplete from public.production_versions where business_id=b and service_date=item.service_date and slot_id=item.slot_id order by revision desc limit 1)>0) then raise exception 'PRODUCTION_INCOMPLETE'; end if;$original$;
  replacement text := $replacement$ if state='ready' then
 select * into rec from public.production_versions
 where business_id=b and service_date=item.service_date and slot_id=item.slot_id
 order by revision desc limit 1;
 -- ensure_freeze has already run under the tenant lock in this transaction.
 if payload->>'production_id' is not null and (payload->>'production_id')::uuid is distinct from rec.id then
 raise exception 'CONFLICT'; end if;
 if item.menu_id is null or rec.id is null or rec.incomplete>0
 or not (rec.entries @> jsonb_build_array(jsonb_build_object('id',ident))) then
 raise exception 'PRODUCTION_INCOMPLETE'; end if;
 end if;$replacement$;
begin
  definition := pg_catalog.pg_get_functiondef('public.execute_command(text,text,jsonb,uuid)'::regprocedure);
  if length(definition) - length(replace(definition, original, '')) <> length(original) then
    raise exception 'Unexpected execute_command readiness definition; migration not applied';
  end if;
  execute replace(definition, original, replacement);
end $migration$;
