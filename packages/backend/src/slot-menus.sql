-- Slot templates keep the existing immutable revision boundary. No listing or purchase is rewritten.
create table v1.dish_categories (
 id text primary key default gen_random_uuid()::text,
 caterer_id uuid references v1.caterers,
 name text not null check(length(trim(name)) between 1 and 60), name_en text
);
create unique index dish_categories_names on v1.dish_categories(caterer_id,lower(name));
alter table v1.dish_categories enable row level security;
insert into v1.dish_categories(id,name,name_en) values
 ('rice','Nasi','Rice'),('main','Lauk','Main dish'),('vegetable','Sayur','Vegetable'),
 ('soup','Sup','Soup'),('fruit','Buah','Fruit'),('dessert','Dessert','Dessert');
create function v1.categories(cid uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'nameEn',name_en) order by caterer_id nulls first,name),'[]')
 from v1.dish_categories where caterer_id is null or caterer_id=cid
$$;
create function v1.check_category(cid uuid,category text) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from v1.dish_categories where id=category and (caterer_id is null or caterer_id=cid)) then raise exception 'INVALID_CATEGORY';end if;
end $$;
create function v1.check_slot_categories(cid uuid,menus jsonb) returns void language plpgsql set search_path='' as $$
declare m jsonb;g jsonb;
begin
 for m in select * from jsonb_array_elements(menus) loop
  if m->>'contentModel'='slots' then
   for g in select * from jsonb_array_elements(m->'composition') loop
    perform v1.check_category(cid,g->>'categoryId');
    if not exists(select 1 from v1.dish_categories where id=g->>'categoryId' and name=g->>'name') then raise exception 'INVALID_CATEGORY';end if;
   end loop;
  end if;
 end loop;
end $$;
create function v1.valid_slot_menu(m jsonb,complete boolean,template boolean) returns boolean language plpgsql immutable set search_path='' as $$
declare g jsonb;i jsonb;ids text[]:=array[]::text[];cats text[]:=array[]::text[];count_slots int:=0;
begin
 if m->>'contentModel' is distinct from 'slots' or jsonb_typeof(m->'composition') is distinct from 'array' or jsonb_array_length(m->'composition')>20
  or jsonb_typeof(m->'items') is distinct from 'array' or jsonb_array_length(m->'items')>60 then return false;end if;
 if complete and jsonb_array_length(m->'composition')=0 then return false;end if;
 for g in select * from jsonb_array_elements(m->'composition') loop
  if jsonb_typeof(g->'id') is distinct from 'string' or length(trim(g->>'id')) not between 1 and 80 or g->>'id'=any(ids)
   or jsonb_typeof(g->'categoryId') is distinct from 'string' or length(trim(g->>'categoryId')) not between 1 and 80 or g->>'categoryId'=any(cats)
   or jsonb_typeof(g->'name') is distinct from 'string' or length(trim(g->>'name')) not between 1 and 60
   or jsonb_typeof(g->'slots') is distinct from 'number' or (g->>'slots')::numeric<>trunc((g->>'slots')::numeric) or (g->>'slots')::int not between 1 and 30 then return false;end if;
  ids:=array_append(ids,g->>'id');cats:=array_append(cats,g->>'categoryId');count_slots:=count_slots+(g->>'slots')::int;
  if not template and complete and (select count(*) from jsonb_array_elements(m->'items') x where x->>'groupId'=g->>'id')<>(g->>'slots')::int then return false;end if;
 end loop;
 if count_slots>60 then return false;end if;
 if template then return jsonb_array_length(m->'items')=0 and coalesce(m->'nutrition','null')='null'::jsonb;end if;
 -- Reuse the complete legacy dish/nutrition validator after category checks.
 for i in select * from jsonb_array_elements(m->'items') loop
  if not exists(select 1 from jsonb_array_elements(m->'composition') grp where grp->>'id'=i->>'groupId' and grp->>'categoryId'=i->>'categoryId') then return false;end if;
 end loop;
 return v1.valid_contents_legacy(jsonb_build_object('packageType','nasi_box','meal',m->'meal','menus',jsonb_build_array(m)),complete);
exception when others then return false;
end $$;
create or replace function v1.valid_contents(o jsonb,complete boolean) returns boolean language plpgsql immutable set search_path='' as $$
declare m jsonb;seen text[]:=array[]::text[];meals text[];
begin
 if not exists(select 1 from jsonb_array_elements(o->'menus') x where x ? 'contentModel') then return v1.valid_contents_legacy(o,complete);end if;
 if o->>'packageType' not in('nasi_box','ala_carte') or jsonb_array_length(o->'menus')>2 then return false;end if;
 meals:=case when o->>'meal'='both' then array['lunch','dinner'] else array[o->>'meal'] end;
 for m in select * from jsonb_array_elements(o->'menus') loop
  if coalesce(m->>'meal','')<>all(meals) or m->>'meal'=any(seen) or not v1.valid_slot_menu(m,complete,true) then return false;end if;
  if jsonb_typeof(m->'name') is distinct from 'string' or length(m->>'name')>1500 or jsonb_typeof(m->'description') is distinct from 'string' or length(m->>'description')>1500 or jsonb_typeof(m->'image') is distinct from 'string' or length(m->>'image')>500 then return false;end if;
  seen:=array_append(seen,m->>'meal');
 end loop;
 return not complete or seen @> meals;
exception when others then return false;
end $$;

create function v1.menu_editable(pid uuid,rev int,dt date,meal_name text) returns boolean language sql stable set search_path='' as $$
 select dt >= (current_timestamp at time zone c.timezone)::date and not exists(
  select 1 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.fulfillments f on f.day_id=d.id
  where s.package_id=pid and coalesce((s.snapshot->'offer'->>'contentRevision')::int,0)=rev and d.service_date=dt and f.meal=meal_name and f.status='delivered')
 from v1.packages p join v1.caterers c on c.id=p.caterer_id where p.id=pid
$$;
create function v1.save_dated_menu(cid uuid,a jsonb) returns void language plpgsql set search_path='' as $$
declare p v1.packages;rev int;template jsonb;rowdata jsonb;o jsonb;target date;qty int;item jsonb;previous jsonb;
begin
 select * into p from v1.packages where id=(a->>'packageId')::uuid and caterer_id=cid for update;if not found then raise exception 'FORBIDDEN';end if;
 rev:=coalesce((a->>'contentRevision')::int,0);target:=(a->>'date')::date;
 select contents into o from v1.content_revisions where package_id=p.id and revision=rev;if not found then raise exception 'INVALID_INPUT';end if;
 if coalesce(a->>'meal','') not in('lunch','dinner') or (o->>'meal'<>'both' and a->>'meal'<>o->>'meal') then raise exception 'INVALID_INPUT';end if;
 select x into template from jsonb_array_elements(o->'menus') x where x->>'meal'=a->>'meal';
 if not coalesce(v1.menu_editable(p.id,rev,target,a->>'meal'),false) then raise exception 'CUTOFF';end if;
 select details,version into previous,qty from v1.menus where package_id=p.id and content_revision=rev and service_date=target and meal=a->>'meal';
 if jsonb_typeof(a->'version') is distinct from 'number' or (a->>'version')::numeric<>coalesce(qty,0) then raise exception 'CONFLICT';end if;
 rowdata:=((a->'details')-'source')||jsonb_build_object('meal',a->>'meal');
 if template->>'contentModel'='slots' then
  if not v1.valid_slot_menu(rowdata,true,false) then raise exception 'INVALID_INPUT';end if;
  if template->'composition' is distinct from rowdata->'composition' then raise exception 'COMPOSITION_CHANGED';end if;
  perform v1.check_slot_categories(cid,jsonb_build_array(rowdata));
  for item in select * from jsonb_array_elements(rowdata->'items') loop
   if item ? 'sourceDishId' and not exists(select 1 from v1.dishes d where d.id=(item->>'sourceDishId')::uuid and d.caterer_id=cid and
    (d.details->>'categoryId'=item->>'categoryId' or exists(select 1 from jsonb_array_elements(coalesce(previous->'items','[]')) old where old=item))) then raise exception 'INVALID_CATEGORY';end if;
  end loop;
 elsif coalesce(o->>'packageType','')<>'' then
  if rowdata ? 'contentModel' or not v1.valid_contents_legacy(jsonb_build_object('packageType',o->'packageType','meal',a->>'meal','menus',jsonb_build_array(rowdata)),true) then raise exception 'INVALID_INPUT';end if;
  if template->'composition' is distinct from rowdata->'composition' or (o->>'packageType'='ala_carte' and jsonb_array_length(template->'items')<>jsonb_array_length(rowdata->'items')) then raise exception 'COMPOSITION_CHANGED';end if;
 else
  if jsonb_typeof(rowdata->'name') is distinct from 'string' or length(trim(rowdata->>'name')) not between 1 and 1500 or rowdata ?| array['items','nutrition','composition','contentModel'] then raise exception 'INVALID_INPUT';end if;
 end if;
 perform v1.check_dish_sources(cid,jsonb_build_array(rowdata),case when previous is null then o->'menus' else jsonb_build_array(previous) end);
 if coalesce(o->>'packageType','')<>'' then rowdata:=rowdata||jsonb_build_object('name',v1.contents_summary(rowdata));end if;
 insert into v1.menus(package_id,content_revision,service_date,meal,details,version) values(p.id,rev,target,a->>'meal',rowdata,1)
 on conflict(package_id,content_revision,service_date,meal) do update set details=excluded.details,version=v1.menus.version+1;
 perform v1.notify(s.user_id,'menu','Menu pengantaran Anda diperbarui.','/calendar') from v1.subscriptions s join v1.delivery_days d on d.subscription_id=s.id where s.package_id=p.id and coalesce((s.snapshot->'offer'->>'contentRevision')::int,0)=rev and d.service_date=target and d.status not in('delivered','cancelled');
end $$;
create function v1.save_menu_batch(cid uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$
declare d jsonb;dates jsonb:=a->'dates';
begin
 if jsonb_typeof(dates) is distinct from 'array' or jsonb_array_length(dates) not between 1 and 31
  or (select count(distinct x->>'date') from jsonb_array_elements(dates)x)<>jsonb_array_length(dates)
  or (select count(distinct date_trunc('month',(x->>'date')::date)) from jsonb_array_elements(dates)x)<>1 then raise exception 'INVALID_INPUT';end if;
 for d in select * from jsonb_array_elements(dates) order by value->>'date' loop
  perform v1.save_dated_menu(cid,(a-'dates')||d);
 end loop;
 return jsonb_build_object('saved',jsonb_array_length(dates));
end $$;
create function v1.menu_month(u uuid,a jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare p v1.packages;rev int:=(a->>'revision')::int;dt date:=(a->>'month')::date;meal_name text:=a->>'meal';o jsonb;
begin
 select * into p from v1.packages where id=(a->>'packageId')::uuid;
 if not found or not v1.is_staff(u,p.caterer_id) then raise exception 'FORBIDDEN';end if;
 select contents into o from v1.content_revisions where package_id=p.id and revision=rev;
 if not found or meal_name not in('lunch','dinner') or (o->>'meal'<>'both' and o->>'meal'<>meal_name) or dt<>date_trunc('month',dt)::date then raise exception 'INVALID_INPUT';end if;
 return jsonb_build_object('categories',v1.categories(p.caterer_id),'dates',(
  select jsonb_agg(jsonb_build_object('date',day::date,'version',coalesce(m.version,0),'details',m.details,'editable',v1.menu_editable(p.id,rev,day::date,meal_name)) order by day)
  from generate_series(dt::timestamp,(dt+interval '1 month - 1 day')::timestamp,interval '1 day') day left join v1.menus m on m.package_id=p.id and m.content_revision=rev and m.service_date=day::date and m.meal=meal_name));
end $$;
