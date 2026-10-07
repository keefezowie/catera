-- Import assistant spend cap (final review of the caterer app, Oct 8 2026).
-- Any phone sign-up can become a kitchen owner, and every assistant read is a
-- paid model call, so each kitchen gets 20 reads per Jakarta day.
create table v1.import_assistant_usage(
 caterer_id uuid not null references v1.caterers,
 day date not null,
 calls integer not null default 0,
 primary key(caterer_id, day)
);
revoke all on v1.import_assistant_usage from public, anon, authenticated;

create function v1.import_assistant_consume(cid uuid, p_day date, p_limit integer default 20) returns integer
language plpgsql security definer set search_path='' as $$
declare used integer;
begin
 insert into v1.import_assistant_usage as u(caterer_id, day, calls) values (cid, p_day, 1)
 on conflict (caterer_id, day) do update set calls = u.calls + 1 where u.calls < p_limit
 returning calls into used;
 if used is null then raise exception 'QUOTA'; end if;
 return used;
end $$;
revoke all on function v1.import_assistant_consume(uuid,date,integer) from public, anon, authenticated;

alter function public.catera_v1_system(text,jsonb) rename to catera_v1_system_importquota_base;
create function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='importAssistant.consume' then
  if payload->>'catererId' is null or payload->>'day' is null then raise exception 'INVALID_INPUT';end if;
  return to_jsonb(v1.import_assistant_consume((payload->>'catererId')::uuid,(payload->>'day')::date));
 end if;
 return public.catera_v1_system_importquota_base(action,payload);
end $$;
revoke all on function public.catera_v1_system_importquota_base(text,jsonb) from public,anon,authenticated;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;
