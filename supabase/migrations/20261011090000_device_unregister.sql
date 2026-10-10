-- device.unregister: the app removes this phone's push token when a person signs out (Phase F).
-- device.register moves a token to whoever registered it last, so a phone handed to another person
-- keeps working; unregister is the opposite half. It deletes the token only while it still belongs
-- to the caller, so a token that has since moved to another account is never touched, and a repeat
-- (or a token this account never held) answers { removed: 0 }. It needs no receipt: running it
-- twice leaves the same rows. device.remove stays the system-only action push dispatch uses.
-- The current command body names its own receipt lookup with the function name
-- (catera_v1_command.request_id), so the base is re-created under its new name, as
-- 20261010090000_pilot_jakarta_day.sql does.
do $$ declare d text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into d;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_unregister_base;
 execute replace(replace(d,'public.catera_v1_command(','public.catera_v1_command_unregister_base('),
   'catera_v1_command.request_id','catera_v1_command_unregister_base.request_id');
end $$;
revoke all on function public.catera_v1_command_unregister_base(text,jsonb,uuid) from public,anon,authenticated;

create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); gone int;
begin
 if action<>'device.unregister' then
  return public.catera_v1_command_unregister_base(action,payload,request_id);
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if jsonb_typeof(payload) is distinct from 'object' or (payload - 'token')<>'{}'::jsonb
  or jsonb_typeof(payload->'token') is distinct from 'string' or payload->>'token'='' then raise exception 'INVALID_INPUT';end if;
 -- The delete is the check: a token owned by someone else matches no row and stays where it is.
 delete from v1.devices where token=payload->>'token' and user_id=u;
 get diagnostics gone=row_count;
 return jsonb_build_object('removed',gone);
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
