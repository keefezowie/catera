-- The database enforces the same text limits as the API (security audit 2026-11-04, M4).
--   public.catera_v1_command is granted to every signed-in user, so a client can call it through PostgREST and skip the
--   Next.js route's zod checks. Money, dates and statuses were already checked here; these free-text fields were not.
--   Limits match the route and the forms (packages/domain addressSchema; the review, reply and help text areas), with
--   room to spare where a form is shorter than the stored column needs. Over-long or missing text is INVALID_INPUT
--   before anything else runs, instead of being stored or failing later as an unhandled error.
--   profile.ensure keeps its forgiving behaviour (sign-in must not fail on a long display name): the name is trimmed
--   and cut to 100 characters, as the API and the apps already do.

create function v1.text_within(v jsonb,low int,high int,optional boolean default false) returns boolean
language sql immutable set search_path='' as $$
 select case
  when v is null or v='null'::jsonb then optional
  when jsonb_typeof(v)<>'string' then false
  else char_length(trim(v#>>'{}')) between low and high end
$$;
revoke all on function v1.text_within(jsonb,int,int,boolean) from public,anon,authenticated;

-- The current command body names its own receipt lookup with the function name, so the base is
-- re-created under its new name, as 20261014100000_profile_update.sql does.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_limits_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_limits_base('),
   'catera_v1_command.request_id','catera_v1_command_limits_base.request_id');
end $$;
revoke all on function public.catera_v1_command_limits_base(text,jsonb,uuid) from public,anon,authenticated;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare name text;
begin
 if jsonb_typeof(payload) is distinct from 'object' then
  return public.catera_v1_command_limits_base(action,payload,request_id);
 end if;
 if action='address.save' and not (
   v1.text_within(payload->'label',1,40) and v1.text_within(payload->'line',5,240)
   and v1.text_within(payload->'area',1,100) and v1.text_within(payload->'city',1,100)
   and v1.text_within(payload->'instructions',0,400,true)) then
  raise exception 'INVALID_INPUT';
 end if;
 if action='review.save' and not v1.text_within(payload->'body',0,2000,true) then raise exception 'INVALID_INPUT';end if;
 if action='review.reply' and not v1.text_within(payload->'reply',0,2000,true) then raise exception 'INVALID_INPUT';end if;
 if action='support.create' and not (v1.text_within(payload->'subject',1,200)
   and v1.text_within(payload->'description',1,4000)) then
  raise exception 'INVALID_INPUT';
 end if;
 if action='profile.ensure' then
  name:=case when jsonb_typeof(payload->'name')='string' then left(trim(payload->>'name'),100) else '' end;
  payload:=jsonb_set(payload,'{name}',to_jsonb(name));
 end if;
 return public.catera_v1_command_limits_base(action,payload,request_id);
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
