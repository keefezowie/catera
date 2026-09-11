-- Reusable defaults only. Embedded package and purchase values stay authoritative.
create table v1.dishes (
 id uuid primary key default gen_random_uuid(), caterer_id uuid not null references v1.caterers,
 details jsonb not null, version int not null default 1 check(version>0), archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index dishes_caterer on v1.dishes(caterer_id,archived);
alter table v1.dishes enable row level security;
create function v1.library_dish(d v1.dishes) returns jsonb language sql stable set search_path='' as $$
 select d.details||jsonb_build_object('id',d.id,'catererId',d.caterer_id,'version',d.version,'archived',d.archived)
$$;
create function v1.valid_dish(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 return coalesce(jsonb_typeof(d)='object' and jsonb_typeof(d->'name')='string' and length(trim(d->>'name')) between 1 and 120
 and jsonb_typeof(d->'description')='string' and length(d->>'description')<=600
 and jsonb_typeof(d->'image')='string' and length(d->>'image')<=500
 and jsonb_typeof(d->'serving')='string' and length(d->>'serving')<=100,false);
end $$;
alter table v1.dishes add constraint valid_dish_details check(v1.valid_dish(details));
create function v1.check_dish_sources(cid uuid,menus jsonb,previous jsonb default '[]') returns void language plpgsql set search_path='' as $$
declare m jsonb;i jsonb;d v1.dishes;
begin
 for m in select * from jsonb_array_elements(menus) loop
  for i in select * from jsonb_array_elements(coalesce(m->'items','[]')) loop
   if i ? 'sourceDishId' or i ? 'sourceDishVersion' or i ? 'sourceServing' then
    if jsonb_typeof(i->'sourceDishId') is distinct from 'string' or jsonb_typeof(i->'sourceDishVersion') is distinct from 'number'
     or (i->>'sourceDishVersion')::numeric<>trunc((i->>'sourceDishVersion')::numeric) or (i->>'sourceDishVersion')::numeric<1
     or (i ? 'sourceServing' and (jsonb_typeof(i->'sourceServing')<>'string' or length(i->>'sourceServing')>100)) then raise exception 'INVALID_INPUT';end if;
    select * into d from v1.dishes where id=(i->>'sourceDishId')::uuid and caterer_id=cid for share;
    if not found then raise exception 'FORBIDDEN';end if;
    if (i->>'sourceDishVersion')::numeric>d.version then raise exception 'CONFLICT';end if;
    if d.archived and not exists(select 1 from jsonb_array_elements(coalesce(previous,'[]')) pm cross join lateral jsonb_array_elements(coalesce(pm->'items','[]')) pi where pi->>'id'=i->>'id' and pi->>'sourceDishId'=i->>'sourceDishId' and pi->>'sourceDishVersion'=i->>'sourceDishVersion') then raise exception 'INVALID_INPUT';end if;
   end if;
  end loop;
 end loop;
end $$;
