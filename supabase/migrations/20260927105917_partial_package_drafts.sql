-- Persist unentered commercial fields only in editable drafts. No rows are rewritten.
create or replace function v1.valid_offer(o jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare w jsonb;t jsonb;k text;lo int;complete boolean;capacity_unset boolean;shared_capacity numeric;
begin
 if o is null or jsonb_typeof(o) is distinct from 'object' or not(o ?& array['name','description','price','days','meal','flexible','weekdays','status','capacity','tiers','menus','image','windows','tags','trialPrice','trialMax']) then return false;end if;
 if jsonb_typeof(o->'status') is distinct from 'string' or o->>'status' not in('draft','published','suspended','retired')
  or jsonb_typeof(o->'meal') is distinct from 'string' or o->>'meal' not in('lunch','dinner','both')
  or jsonb_typeof(o->'flexible') is distinct from 'boolean' then return false;end if;
 complete:=o->>'status'<>'draft';
 foreach k in array array['name','description','image'] loop
  if jsonb_typeof(o->k) is distinct from 'string' then return false;end if;
  lo:=case k when 'name' then 3 when 'description' then 10 else 1 end;
  if (complete or length(trim(o->>k))>0) and length(trim(o->>k))<lo then return false;end if;
  if length(o->>k)>(case k when 'name' then 100 when 'description' then 1500 else 500 end) then return false;end if;
 end loop;
 foreach k in array array['price','days'] loop
  -- JSON null is an explicit unentered draft price, never a numeric fallback.
  if k='price' and not complete and o->k='null'::jsonb then continue;end if;
  if jsonb_typeof(o->k) is distinct from 'number' then return false;end if;
  if (o->>k)::numeric<>trunc((o->>k)::numeric) or (o->>k)::numeric not between (case k when 'price' then 1000 else 1 end) and (case k when 'price' then 10000000 else 60 end) then return false;end if;
 end loop;
 foreach k in array array['trialPrice','trialMax'] loop
  if o->k<>'null'::jsonb and (jsonb_typeof(o->k) is distinct from 'number' or (o->>k)::numeric<>trunc((o->>k)::numeric) or (o->>k)::numeric<(case k when 'trialPrice' then 1000 else 1 end)) then return false;end if;
 end loop;
 if jsonb_typeof(o->'windows') is distinct from 'object' or jsonb_typeof(o->'windows'->'lunch') is distinct from 'string' or jsonb_typeof(o->'windows'->'dinner') is distinct from 'string' or length(o->'windows'->>'lunch')<3 or length(o->'windows'->>'dinner')<3 then return false;end if;
 if jsonb_typeof(o->'capacity') is distinct from 'object' or jsonb_typeof(o->'weekdays') is distinct from 'array' then return false;end if;
 if jsonb_array_length(o->'weekdays') not between (case when complete then 1 else 0 end) and 7 then return false;end if;
 capacity_unset:=not complete and o->'capacity'='{}'::jsonb;
 for w in select value from jsonb_each(o->'capacity') loop
  if jsonb_typeof(w) is distinct from 'number' or w::text::numeric<0 or w::text::numeric<>trunc(w::text::numeric) then return false;end if;
 end loop;
 for w in select * from jsonb_array_elements(o->'weekdays') loop
  if jsonb_typeof(w) is distinct from 'number' or w::text::numeric not between 0 and 6 or w::text::numeric<>trunc(w::text::numeric) then return false;end if;
  if capacity_unset then continue;end if;
  if not(o->'capacity' ? w::text) then return false;end if;
  if shared_capacity is null then shared_capacity:=(o->'capacity'->>(w::text))::numeric;
  elsif shared_capacity is distinct from (o->'capacity'->>(w::text))::numeric then return false;end if;
 end loop;
 if jsonb_typeof(o->'tiers') is distinct from 'array' or jsonb_typeof(o->'tags') is distinct from 'array' or jsonb_typeof(o->'menus') is distinct from 'array' or jsonb_array_length(o->'menus')>2 then return false;end if;
 for t in select * from jsonb_array_elements(o->'tiers') loop
  if jsonb_typeof(t->'min') is distinct from 'number' or (t->>'min')::numeric<1 or (t->>'min')::numeric<>trunc((t->>'min')::numeric) or jsonb_typeof(t->'percent') is distinct from 'number' or (t->>'percent')::numeric not between 0 and 90 then return false;end if;
 end loop;
 for t in select * from jsonb_array_elements(o->'tags') loop if jsonb_typeof(t) is distinct from 'string' or length(t#>>'{}')>40 then return false;end if;end loop;
 if v1.valid_nutrition(o->'nutrition') is distinct from true then return false;end if;
 return coalesce(v1.valid_contents(o,complete),false);
 exception when others then return false;
end $$;

create or replace function v1.partial_package_drafts_version() returns integer language sql immutable set search_path='' as 'select 1';
revoke all on function v1.partial_package_drafts_version() from public,anon,authenticated;
