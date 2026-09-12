-- Package-level nutrition supports either a fixed value or an inclusive range.
-- Existing menu-level values remain readable in immutable historical snapshots.
create or replace function v1.valid_nutrition(nutrition jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare metric record;bounds jsonb;
begin
 if nutrition is null or nutrition='null'::jsonb then return true;end if;
 if jsonb_typeof(nutrition)<>'object' then return false;end if;
 for metric in select * from jsonb_each(nutrition) loop
  if metric.key not in('caloriesKcal','proteinG','carbsG','fatG') then return false;end if;
  if jsonb_typeof(metric.value)='number' then
   if metric.value::text::numeric<0 then return false;end if;
  elsif jsonb_typeof(metric.value)='object' then
   bounds:=metric.value;
   if not(bounds ?& array['min','max']) or (select count(*) from jsonb_object_keys(bounds))<>2
    or jsonb_typeof(bounds->'min')<>'number' or jsonb_typeof(bounds->'max')<>'number'
    or (bounds->>'min')::numeric<0 or (bounds->>'max')::numeric<(bounds->>'min')::numeric then return false;end if;
  else return false;
  end if;
 end loop;
 return true;
exception when others then return false;
end $$;

-- Backfill editable package records from legacy menu estimates. Immutable
-- checkout and subscription snapshots are deliberately left untouched.
with nutrient_values as (
 select p.id,metric.key,(metric.value#>>'{}')::numeric as minimum,(metric.value#>>'{}')::numeric as maximum
 from v1.packages p
 cross join lateral jsonb_array_elements(coalesce(p.offer->'menus','[]')) menu
 cross join lateral jsonb_each(coalesce(menu->'nutrition','{}')) metric
 where not(p.offer ? 'nutrition') and jsonb_typeof(metric.value)='number'
 union all
 select p.id,metric.key,(metric.value#>>'{}')::numeric,(metric.value#>>'{}')::numeric
 from v1.packages p join v1.menus m on m.package_id=p.id and m.content_revision=coalesce((p.offer->>'contentRevision')::int,0)
 cross join lateral jsonb_each(coalesce(m.details->'nutrition','{}')) metric
 where not(p.offer ? 'nutrition') and jsonb_typeof(metric.value)='number'
), nutrient_bounds as (
 select id,key,min(minimum) minimum,max(maximum) maximum from nutrient_values group by id,key
), package_values as (
 select id,jsonb_object_agg(key,case when minimum=maximum then to_jsonb(minimum) else jsonb_build_object('min',minimum,'max',maximum) end) nutrition
 from nutrient_bounds group by id
)
update v1.packages p set offer=jsonb_set(p.offer,'{nutrition}',v.nutrition,true),version=p.version+1
from package_values v where p.id=v.id;

create or replace function v1.valid_offer(o jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare w jsonb;t jsonb;k text;lo int;complete boolean;shared_capacity numeric;
begin
 if o is null or jsonb_typeof(o)<>'object' or not(o ?& array['name','description','price','days','meal','flexible','weekdays','status','capacity','tiers','menus','image','windows','tags','trialPrice','trialMax']) then return false;end if;
 complete:=o->>'status'<>'draft';
 if o->>'status' not in('draft','published','suspended','retired') or o->>'meal' not in('lunch','dinner','both') or jsonb_typeof(o->'flexible')<>'boolean' then return false;end if;
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
 if not v1.valid_nutrition(o->'nutrition') then return false;end if;
 return coalesce(v1.valid_contents(o,complete),false);
exception when others then return false;
end $$;
