-- First-party usage counts (Phase C, native daily loop).
-- One row per Jakarta day, app and event name, holding how many times it happened. The table has
-- no user, caterer, device, session or request column, so a count can never be traced back to a
-- person (Ruling C12). Callers must be signed in, so an anonymous request cannot inflate it.
-- The names are allowlisted here, including the ones Phase D will send; adding a name is one edit
-- to the list below in a later migration.
create table v1.usage_daily(
 day date not null,
 app text not null check (app in ('customer','dapur')),
 name text not null,
 n integer not null default 0,
 primary key (day, app, name)
);
alter table v1.usage_daily enable row level security;
revoke all on v1.usage_daily from public, anon, authenticated;

create function public.catera_v1_usage(name text, app text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 if name is null or app is null
  or name not in ('app_open','tomorrow_story_viewed','journey_viewed','plan_sheet_opened','renew_started','purchase_confirmed_viewed','cook_started','depart_tapped')
  or app not in ('customer','dapur') then raise exception 'INVALID_INPUT';end if;
 -- One statement, so twenty parallel calls from one phone still end at n = 20.
 insert into v1.usage_daily as u(day,app,name,n) values ((now() at time zone 'Asia/Jakarta')::date,app,name,1)
 on conflict on constraint usage_daily_pkey do update set n=u.n+1;
 return '{}'::jsonb;
end $$;
revoke all on function public.catera_v1_usage(text,text) from public, anon;
grant execute on function public.catera_v1_usage(text,text) to authenticated;
