-- Synthetic data conversion only. Deliberately not a hosted schema migration.
-- Caller owns a transaction and explicitly opts into demo storage.
do $$ begin
 if current_setting('catera.demo',true) is distinct from 'true'
  or not exists(select 1 from v1.policies where synthetic and approved)
  or not (exists(select 1 from v1.profiles where id='00000000-0000-4000-8000-000000000002' and role='owner')
          or exists(select 1 from v1.profiles where name='Demo Pemilik' and role='owner'))
 then raise exception 'SYNTHETIC_DEMO_REQUIRED'; end if;
end $$;

create or replace function pg_temp.demo_category(cid uuid, label text) returns text language plpgsql as $$
declare ident text;
begin
 label:=coalesce(nullif(trim(label),''),'Hidangan');
 select id into ident from v1.dish_categories where lower(name)=lower(label) and (caterer_id is null or caterer_id=cid) order by caterer_id nulls first limit 1;
 if ident is null then
  ident:='demo-'||md5(cid::text||':'||lower(label));
  insert into v1.dish_categories(id,caterer_id,name) values(ident,cid,label);
 end if;
 return ident;
end $$;
create or replace function pg_temp.demo_menu(m jsonb,cid uuid,as_template boolean) returns jsonb language plpgsql as $$
declare groups jsonb:='[]';items jsonb:='[]';g jsonb;i jsonb;cat text;label text;gid text;source uuid;source_version int;dish_details jsonb;raw_items jsonb;
begin
 if m->>'contentModel'='slots' then return m;end if;
 raw_items:=coalesce(m->'items','[]');
 if jsonb_array_length(raw_items)=0 and coalesce(trim(m->>'name'),'')<>'' then
  raw_items:=jsonb_build_array(jsonb_build_object('id','legacy-menu','name',m->>'name','description',coalesce(m->>'description',''),'image',coalesce(m->>'image',''),'serving',''));
 end if;
 for i in select * from jsonb_array_elements(raw_items) loop
  select value into g from jsonb_array_elements(coalesce(m->'composition','[]')) where value->>'id'=i->>'groupId';
  -- Explicit fixture IDs, never fuzzy classification of dish names.
  label:=coalesce(g->>'name',case i->>'id'
   when 'nasi' then 'Nasi' when 'sayur' then 'Sayur' when 'lalapan' then 'Sayur'
   when 'salmon' then 'Lauk' when 'ayam' then 'Lauk' when 'tempe' then 'Lauk'
   when 'lauk' then 'Lauk' when 'sup' then 'Sup' when 'buah' then 'Buah'
   else 'Hidangan' end);
  cat:=pg_temp.demo_category(cid,label);gid:=cat;
  select name into label from v1.dish_categories where id=cat;
  if not exists(select 1 from jsonb_array_elements(groups) x where x->>'id'=gid) then
   groups:=groups||jsonb_build_array(jsonb_build_object('id',gid,'categoryId',cat,'name',label,'slots',1));
  else
   select jsonb_agg(case when x->>'id'=gid then x||jsonb_build_object('slots',(x->>'slots')::int+1) else x end) into groups from jsonb_array_elements(groups)x;
  end if;
  if coalesce(trim(i->>'name'),'')='' then continue;end if;
  dish_details:=jsonb_build_object('name',i->>'name','description',coalesce(i->>'description',''),'image',coalesce(i->>'image',''),'serving',coalesce(i->>'serving',''),'categoryId',cat);
  select d.id into source from v1.dishes d where d.caterer_id=cid and not d.archived and d.details->>'name'=dish_details->>'name' and d.details->>'serving'=dish_details->>'serving' and (d.details->>'categoryId' is null or d.details->>'categoryId'=cat) order by d.id limit 1;
  if source is null then source:=md5(cid::text||':'||dish_details::text)::uuid;end if;
  insert into v1.dishes(id,caterer_id,details) values(source,cid,dish_details) on conflict(id) do nothing;
  update v1.dishes d set details=d.details||jsonb_build_object('categoryId',cat) where d.id=source and d.details->>'categoryId' is null;
  select version into source_version from v1.dishes where id=source;
  items:=items||jsonb_build_array((i-'sourceDishId'-'sourceDishVersion'-'sourceServing')||dish_details||jsonb_build_object('groupId',gid,'sourceDishId',source,'sourceDishVersion',source_version,'sourceServing',dish_details->>'serving'));
 end loop;
 -- Preserve reviewed counts for a composition-only legacy draft.
 if jsonb_array_length(groups)=0 then
  for g in select * from jsonb_array_elements(coalesce(m->'composition','[]')) loop
   cat:=pg_temp.demo_category(cid,g->>'name');
   groups:=groups||jsonb_build_array(g||jsonb_build_object('id',cat,'categoryId',cat));
  end loop;
 end if;
 return (m-'source')||jsonb_build_object('contentModel','slots','composition',groups,'items',case when as_template then '[]'::jsonb else items end,
  'nutrition',case when as_template then 'null'::jsonb else coalesce(m->'nutrition','null') end,
  'name',case when as_template then '' else coalesce(m->>'name','') end,'description',coalesce(m->>'description',''),'image',case when as_template then '' else coalesce(m->>'image','') end);
end $$;
create or replace function pg_temp.demo_offer(o jsonb,cid uuid,as_template boolean) returns jsonb language plpgsql as $$
declare menus jsonb;
begin
 select coalesce(jsonb_agg(pg_temp.demo_menu(m,cid,as_template)),'[]') into menus from jsonb_array_elements(coalesce(o->'menus','[]'))m;
 return o||jsonb_build_object('packageType',coalesce(o->>'packageType','nasi_box'),'menus',menus);
end $$;

-- Guarded, transactional normalization includes synthetic purchase graphs so
-- every selectable revision uses one editor. Production paths never call this.
alter table v1.content_revisions disable trigger content_revisions_immutable;
alter table v1.subscriptions disable trigger subscription_terms;
alter table v1.production disable trigger production_immutable;
do $$
declare r record;recipe jsonb;dt date;next_offer jsonb;
begin
 for r in select cr.*,p.caterer_id from v1.content_revisions cr join v1.packages p on p.id=cr.package_id
  where exists(select 1 from jsonb_array_elements(cr.contents->'menus') m where m->>'contentModel' is distinct from 'slots') loop
  -- Move actual recipe fixtures to dated menus for their existing deliveries.
  for recipe in select * from jsonb_array_elements(r.contents->'menus') loop
   for dt in select distinct d.service_date from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.package_id=r.package_id and coalesce((s.snapshot->'offer'->>'contentRevision')::int,0)=r.revision loop
    if coalesce(jsonb_array_length(recipe->'items'),0)>0 or coalesce(recipe->>'name','')<>'' then
     insert into v1.menus(package_id,content_revision,service_date,meal,details,version)
      values(r.package_id,r.revision,dt,recipe->>'meal',pg_temp.demo_menu(recipe,r.caterer_id,false),1) on conflict do nothing;
    end if;
   end loop;
  end loop;
  update v1.content_revisions set contents=pg_temp.demo_offer(r.contents,r.caterer_id,true) where package_id=r.package_id and revision=r.revision;
 end loop;
 for r in select * from v1.packages where exists(select 1 from jsonb_array_elements(offer->'menus')m where m->>'contentModel' is distinct from 'slots') loop
  update v1.packages set offer=pg_temp.demo_offer(r.offer,r.caterer_id,true),version=version+1 where id=r.id;
 end loop;
 for r in select m.*,p.caterer_id from v1.menus m join v1.packages p on p.id=m.package_id where m.details->>'contentModel' is distinct from 'slots' loop
  update v1.menus set details=pg_temp.demo_menu(r.details,r.caterer_id,false) where package_id=r.package_id and content_revision=r.content_revision and service_date=r.service_date and meal=r.meal;
 end loop;
 for r in select c.id,c.quote,p.caterer_id from v1.checkouts c join v1.packages p on p.id=c.package_id where exists(select 1 from jsonb_array_elements(c.quote->'offer'->'menus')m where m->>'contentModel' is distinct from 'slots') loop
  update v1.checkouts set quote=jsonb_set(r.quote,'{offer}',pg_temp.demo_offer(r.quote->'offer',r.caterer_id,true)) where id=r.id;
 end loop;
 for r in select s.id,s.snapshot,p.caterer_id from v1.subscriptions s join v1.packages p on p.id=s.package_id where exists(select 1 from jsonb_array_elements(s.snapshot->'offer'->'menus')m where m->>'contentModel' is distinct from 'slots') loop
  update v1.subscriptions set snapshot=jsonb_set(r.snapshot,'{offer}',pg_temp.demo_offer(r.snapshot->'offer',r.caterer_id,true)) where id=r.id;
 end loop;
 for r in select * from v1.production where exists(select 1 from jsonb_array_elements(entries)e,jsonb_array_elements(e->'offer'->'menus')m where m->>'contentModel' is distinct from 'slots') loop
  update v1.production set entries=(select coalesce(jsonb_agg(jsonb_set(e,'{offer}',pg_temp.demo_offer(e->'offer',r.caterer_id,false))),'[]') from jsonb_array_elements(r.entries)e) where id=r.id;
 end loop;
end $$;
alter table v1.content_revisions enable trigger content_revisions_immutable;
alter table v1.subscriptions enable trigger subscription_terms;
alter table v1.production enable trigger production_immutable;
