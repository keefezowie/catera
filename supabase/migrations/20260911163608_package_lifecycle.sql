-- Published packages are immutable; subscriptions finish before archival.
alter table v1.packages drop constraint packages_status_check;
update v1.packages set status='suspended',offer=jsonb_set(offer,'{status}','"suspended"') where status='paused';
alter table v1.packages add constraint packages_status_check check(status in('draft','published','suspended','retired'));

create function v1.package_obligations(pid uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id
   where s.package_id=pid and d.status not in('delivered','cancelled'))
 or exists(select 1 from v1.checkouts c where c.package_id=pid and c.subscription_id is null
   and (c.state='paid' or (c.state='pending' and c.expires_at>clock_timestamp())))
$$;
revoke all on function v1.package_obligations(uuid) from public,anon,authenticated;

-- Preserve operational batches and their qualified receipt lookup.
do $$ declare definition text; begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into definition;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_lifecycle_base;
 definition:=replace(definition,'public.catera_v1_command(','public.catera_v1_command_lifecycle_base(');
 definition:=replace(definition,'catera_v1_command.request_id','catera_v1_command_lifecycle_base.request_id');
 execute definition;
end $$;
revoke all on function public.catera_v1_command_lifecycle_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p v1.packages; cid uuid; old v1.receipts; fingerprint text:=md5(action||payload::text); result jsonb; next_status text;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action not in('package.save','package.suspend','package.archive') then
  return public.catera_v1_command_lifecycle_base(action,payload,request_id);
 end if;
 cid:=(payload->>'catererId')::uuid;
 if not v1.is_staff(u,cid,true) then raise exception 'FORBIDDEN';end if;
 if request_id is null then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts r where r.actor_id=u and r.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 if payload->>'id' is not null then
  select * into p from v1.packages where id=(payload->>'id')::uuid and caterer_id=cid for update;
  if not found then raise exception 'FORBIDDEN';end if;
  if jsonb_typeof(payload->'version') is distinct from 'number' or (payload->>'version')::numeric<>p.version then raise exception 'CONFLICT';end if;
 end if;
 if action='package.save' then
  if p.id is not null and p.status<>'draft' then raise exception 'PACKAGE_IMMUTABLE';end if;
  if coalesce(payload->'offer'->>'status','') not in('draft','published') then raise exception 'INVALID_STATE';end if;
  return public.catera_v1_command_lifecycle_base(action,payload,request_id);
 end if;
 if p.id is null then raise exception 'INVALID_INPUT';end if;
 if action='package.suspend' then
  if p.status<>'published' then raise exception 'INVALID_STATE';end if;
  next_status:='suspended';
 else
  if p.status<>'suspended' then raise exception 'SUSPEND_FIRST';end if;
  if v1.package_obligations(p.id) then raise exception 'PACKAGE_HAS_DELIVERIES';end if;
  next_status:='retired';
 end if;
 update v1.packages set status=next_status,offer=jsonb_set(offer,'{status}',to_jsonb(next_status)),version=version+1 where id=p.id;
 result:=jsonb_build_object('id',p.id,'status',next_status,'version',p.version+1);
 insert into v1.audit(actor_id,action,details) values(u,action,jsonb_build_object('id',p.id,'catererId',cid,'statusBefore',p.status,'status',next_status,'requestId',request_id));
 insert into v1.receipts values(u,request_id,fingerprint,result);
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

-- Eligibility is private to the seller read, never embedded in purchase quotes.
alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_lifecycle_base;
revoke all on function public.catera_v1_read_lifecycle_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 result:=public.catera_v1_read_lifecycle_base(resource,params);
 if resource='seller' then
  result:=jsonb_set(result,'{offers}',coalesce((select jsonb_agg(o||jsonb_build_object('canArchive',o->>'status'='suspended' and not v1.package_obligations((o->>'id')::uuid))) from jsonb_array_elements(result->'offers') o),'[]'));
 end if;
 return result;
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

-- Late payments after archival follow the established support exception path.
do $$ declare definition text; begin
 select pg_get_functiondef('v1.activate(uuid)'::regprocedure) into definition;
 if position('if v1.cutoff' in definition)=0 then raise exception 'ACTIVATE_GUARD_MISSING';end if;
 definition:=replace(definition,'if v1.cutoff','if p.status=''retired'' or v1.cutoff');
 execute definition;
end $$;

-- Extend the existing validator without replacing unrelated offer rules.
do $$ declare definition text; begin
 select pg_get_functiondef('v1.valid_offer(jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'''paused''','''suspended''');
 execute definition;
end $$;
