-- Structured meal contents. Applied only by the forward contents migration.
create table if not exists v1.content_revisions (
 package_id uuid not null references v1.packages, revision int not null check(revision>=0),
 contents jsonb not null, created_at timestamptz not null default now(), primary key(package_id,revision)
);
alter table v1.content_revisions enable row level security;
insert into v1.content_revisions(package_id,revision,contents)
 select id,0,jsonb_strip_nulls(jsonb_build_object('packageType',offer->'packageType','meal',offer->'meal','menus',offer->'menus')) from v1.packages on conflict do nothing;
create trigger content_revisions_immutable before update or delete on v1.content_revisions for each row execute function v1.immutable();
alter table v1.menus add column content_revision int not null default 0;
alter table v1.menus add column version int not null default 1;
alter table v1.menus drop constraint menus_pkey;
alter table v1.menus add primary key(package_id,content_revision,service_date,meal);
alter table v1.menus add foreign key(package_id,content_revision) references v1.content_revisions(package_id,revision);

create or replace function v1.valid_contents(o jsonb,complete boolean) returns boolean language plpgsql immutable set search_path='' as $$
declare m jsonb;i jsonb;g jsonb;n record; meals text[]; names text[];ids text[];gids text[];
begin
 if coalesce(o->>'packageType','')='' then return true;end if;
 if o->>'packageType' not in('ala_carte','nasi_box') then return false;end if;
 meals:=case when o->>'meal'='both' then array['lunch','dinner'] else array[o->>'meal'] end;
 if jsonb_typeof(o->'menus') is distinct from 'array' or jsonb_array_length(o->'menus')>2 then return false;end if;
 names:=array[]::text[];
 for m in select * from jsonb_array_elements(o->'menus') loop
  if jsonb_typeof(m->'name') is distinct from 'string' or length(m->>'name')>1500 or jsonb_typeof(m->'description') is distinct from 'string' or length(m->>'description')>1500 or jsonb_typeof(m->'image') is distinct from 'string' or length(m->>'image')>500 then return false;end if;
  if coalesce(m->>'meal','')<>all(meals) or m->>'meal'=any(names) then return false;end if; names:=array_append(names,m->>'meal');
  if jsonb_typeof(m->'items') is distinct from 'array' or jsonb_array_length(m->'items')>60 or (complete and jsonb_array_length(m->'items')=0) then return false;end if;
  if jsonb_typeof(coalesce(m->'composition','[]'))<>'array' or jsonb_array_length(coalesce(m->'composition','[]'))>20 then return false;end if;
  gids:=array[]::text[];
  for g in select * from jsonb_array_elements(coalesce(m->'composition','[]')) loop
   if jsonb_typeof(g->'id') is distinct from 'string' or length(trim(g->>'id')) not between 1 and 80 or g->>'id'=any(gids) or jsonb_typeof(g->'name') is distinct from 'string' or length(trim(g->>'name')) not between 1 and 60 or jsonb_typeof(g->'slots') is distinct from 'number' or (g->>'slots')::numeric<>trunc((g->>'slots')::numeric) or (g->>'slots')::numeric not between 1 and 30 then return false;end if;
   gids:=array_append(gids,g->>'id');
   if complete and (select count(*) from jsonb_array_elements(m->'items') x where x->>'groupId'=g->>'id')<>(g->>'slots')::int then return false;end if;
  end loop;
  if o->>'packageType'='nasi_box' and complete and cardinality(gids)=0 then return false;end if;
  if o->>'packageType'='ala_carte' and cardinality(gids)>0 then return false;end if;
  ids:=array[]::text[];
  for i in select * from jsonb_array_elements(m->'items') loop
   if jsonb_typeof(i->'id') is distinct from 'string' or length(trim(i->>'id')) not between 1 and 80 or i->>'id'=any(ids) or jsonb_typeof(i->'name') is distinct from 'string' or length(trim(i->>'name'))>120 or (complete and length(trim(i->>'name'))=0) then return false;end if;
   ids:=array_append(ids,i->>'id');
   if (i ? 'description' and (jsonb_typeof(i->'description')<>'string' or length(i->>'description')>600)) or (i ? 'image' and (jsonb_typeof(i->'image')<>'string' or length(i->>'image')>500)) or (i ? 'serving' and (jsonb_typeof(i->'serving')<>'string' or length(i->>'serving')>100)) then return false;end if;
   if o->>'packageType'='nasi_box' and not(coalesce(i->>'groupId','')=any(gids)) then return false;end if;
   if o->>'packageType'='ala_carte' and i ? 'groupId' then return false;end if;
  end loop;
  if m ? 'nutrition' and m->'nutrition'<>'null'::jsonb then
   if jsonb_typeof(m->'nutrition')<>'object' then return false;end if;
   for n in select * from jsonb_each(m->'nutrition') loop
    if n.key not in('caloriesKcal','proteinG','carbsG','fatG') or jsonb_typeof(n.value)<>'number' or n.value::text::numeric<0 then return false;end if;
   end loop;
  end if;
 end loop;
 return not complete or names @> meals;
 exception when others then return false;
end $$;

create function v1.contents_template(o jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('packageType',o->'packageType','meal',o->'meal','menus',o->'menus'))
$$;
create function v1.contents_summary(m jsonb) returns text language sql immutable set search_path='' as $$
 select case when m ? 'items' then coalesce((select string_agg(x->>'name',', ' order by ord) from jsonb_array_elements(m->'items') with ordinality t(x,ord)),'') else m->>'name' end
$$;
create function v1.resolve_contents(p uuid,dt date,fallback jsonb,revision int) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(coalesce(m.details,item)||jsonb_build_object('meal',item->>'meal','source',case when m.package_id is null then 'initial' else 'dated' end) order by ord),'[]')
 from jsonb_array_elements(fallback) with ordinality t(item,ord) left join v1.menus m on m.package_id=p and m.service_date=dt and m.meal=item->>'meal' and m.content_revision=revision
$$;
create function v1.seller_content_revisions(cid uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('packageId',p.id,'name',p.offer->>'name','revision',r.revision,'contents',r.contents) order by p.slug,r.revision desc),'[]')
 from v1.content_revisions r join v1.packages p on p.id=r.package_id where p.caterer_id=cid and
 (r.revision=coalesce((p.offer->>'contentRevision')::int,0) or exists(select 1 from v1.subscriptions s join v1.delivery_days d on d.subscription_id=s.id where s.package_id=p.id and coalesce((s.snapshot->'offer'->>'contentRevision')::int,0)=r.revision and d.status not in('delivered','cancelled')) or exists(select 1 from v1.checkouts c where c.package_id=p.id and c.state='pending' and c.expires_at>now() and coalesce((c.quote->'offer'->>'contentRevision')::int,0)=r.revision))
$$;
