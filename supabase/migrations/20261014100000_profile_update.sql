-- Data akun (Phase G, FB5).
--   profile.update {name} -> {name}: renames the caller's own profile row. The name is trimmed and
--   must be 2 to 80 characters. The row is the caller's by construction (id = auth.uid()), so there
--   is no id to pass and no other row to reach. Setting the same name again is not an error.
--   accountRequest.create answers { id, status: 'open' }. A deletion request is created once per
--   open request: while the caller has an open one, asking again returns it (existing: true). A
--   per-user lock makes two phones asking at once end with one row. A resolved request lets a new
--   one be made. Help requests are unchanged apart from the status in the answer.
-- The current command body names its own receipt lookup with the function name, so the base is
-- re-created under its new name, as 20261011090000_device_unregister.sql does.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_profile_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_profile_base('),
   'catera_v1_command.request_id','catera_v1_command_profile_base.request_id');
end $$;
revoke all on function public.catera_v1_command_profile_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); nm text; found_id uuid; r jsonb;
begin
 if action not in('profile.update','accountRequest.create') then
  return public.catera_v1_command_profile_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action='profile.update' then
  if jsonb_typeof(payload) is distinct from 'object' or (payload - 'name')<>'{}'::jsonb
   or jsonb_typeof(payload->'name') is distinct from 'string' then raise exception 'INVALID_INPUT';end if;
  nm:=btrim(payload->>'name');
  if char_length(nm) not between 2 and 80 then raise exception 'INVALID_INPUT';end if;
  update v1.profiles set name=nm where id=u;
  if not found then raise exception 'NOT_FOUND';end if;
  return jsonb_build_object('name',nm);
 end if;
 -- accountRequest.create
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtext('account-request:'||u::text));
 if coalesce(payload->>'kind','') not in('help','deletion') or length(trim(coalesce(payload->>'body',''))) not between 5 and 2000 then raise exception 'INVALID_INPUT';end if;
 if payload->>'kind'='deletion' then
  select id into found_id from v1.account_requests where user_id=u and kind='deletion' and status='open' order by created_at limit 1;
  if found then return jsonb_build_object('id',found_id,'status','open','existing',true);end if;
 end if;
 r:=public.catera_v1_command_profile_base(action,payload,request_id);
 return r||jsonb_build_object('status','open');
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
