-- Shared recurring capacity. Existing v1.capacity rows remain legacy date overrides.
create or replace function v1.valid_offer(o jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare w jsonb;t jsonb;k text;lo int;complete boolean;shared_capacity numeric;
begin
 if o is null or jsonb_typeof(o)<>'object' or not(o ?& array['name','description','price','days','meal','flexible','weekdays','status','capacity','tiers','menus','image','windows','tags','trialPrice','trialMax']) then return false;end if;
 complete:=o->>'status'<>'draft';
 if o->>'status' not in('draft','published','paused','retired') or o->>'meal' not in('lunch','dinner','both') or jsonb_typeof(o->'flexible')<>'boolean' then return false;end if;
 foreach k in array array['name','description','image'] loop
  if jsonb_typeof(o->k)<>'string' then return false;end if;
  lo:=case k when 'name' then 3 when 'description' then 10 else 1 end;
  if (complete or length(trim(o->>k))>0) and length(trim(o->>k))<lo then return false;end if;
  if length(o->>k)>(case k when 'name' then 100 when 'description' then 1500 else 500 end) then return false;end if;
 end loop;
 foreach k in array array['price','days'] loop
  if jsonb_typeof(o->k)<>'number' or (o->>k)::numeric<>trunc((o->>k)::numeric) or (o->>k)::numeric not between (case k when 'price' then 1000 else 1 end) and (case k when 'price' then 10000000 else 60 end) then return false;end if;
 end loop;
 foreach k in array array['trialPrice','trialMax'] loop
  if o->k<>'null'::jsonb and (jsonb_typeof(o->k)<>'number' or (o->>k)::numeric<>trunc((o->>k)::numeric) or (o->>k)::numeric<(case k when 'trialPrice' then 1000 else 1 end)) then return false;end if;
 end loop;
 if jsonb_typeof(o->'windows')<>'object' or jsonb_typeof(o->'windows'->'lunch') is distinct from 'string' or jsonb_typeof(o->'windows'->'dinner') is distinct from 'string' or length(o->'windows'->>'lunch')<3 or length(o->'windows'->>'dinner')<3 then return false;end if;
 if jsonb_typeof(o->'capacity')<>'object' or jsonb_typeof(o->'weekdays')<>'array' or jsonb_array_length(o->'weekdays') not between (case when complete then 1 else 0 end) and 7 then return false;end if;
 for w in select value from jsonb_each(o->'capacity') loop
  if jsonb_typeof(w)<>'number' or w::text::numeric<0 or w::text::numeric<>trunc(w::text::numeric) then return false;end if;
 end loop;
 for w in select * from jsonb_array_elements(o->'weekdays') loop
  if jsonb_typeof(w)<>'number' or w::text::numeric not between 0 and 6 or w::text::numeric<>trunc(w::text::numeric) or not(o->'capacity' ? w::text) then return false;end if;
  if shared_capacity is null then shared_capacity:=(o->'capacity'->>(w::text))::numeric;
  elsif shared_capacity is distinct from (o->'capacity'->>(w::text))::numeric then return false;end if;
 end loop;
 if jsonb_typeof(o->'tiers')<>'array' or jsonb_typeof(o->'tags')<>'array' or jsonb_typeof(o->'menus')<>'array' or jsonb_array_length(o->'menus')>2 then return false;end if;
 for t in select * from jsonb_array_elements(o->'tiers') loop
  if jsonb_typeof(t->'min') is distinct from 'number' or (t->>'min')::numeric<1 or (t->>'min')::numeric<>trunc((t->>'min')::numeric) or jsonb_typeof(t->'percent') is distinct from 'number' or (t->>'percent')::numeric not between 0 and 90 then return false;end if;
 end loop;
 for t in select * from jsonb_array_elements(o->'tags') loop if jsonb_typeof(t)<>'string' or length(t#>>'{}')>40 then return false;end if;end loop;
 return coalesce(v1.valid_contents(o,complete),false);
 exception when others then return false;
end $$;

-- Keep the already shipped command implementation intact and place the retired
-- action behind the public RPC boundary. The dynamic definition rewrite also
-- updates the function-qualified request_id reference used by PL/pgSQL.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure)
   into definition;
 if definition is null then raise exception 'COMMAND_RPC_MISSING';end if;
 execute 'alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_legacy';
 definition:=replace(definition,'public.catera_v1_command(','public.catera_v1_command_legacy(');
 definition:=replace(definition,'catera_v1_command.request_id','catera_v1_command_legacy.request_id');
 execute definition;
end $$;

create or replace function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if action='capacity.save' then raise exception 'INVALID_ACTION';end if;
 return public.catera_v1_command_legacy(action,payload,request_id);
end $$;

revoke all on function public.catera_v1_command_legacy(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;
