-- Customer menus are private delivery commitments; package options are independently versioned.
create table v1.package_dishes (
 id uuid primary key default gen_random_uuid(), package_id uuid not null references v1.packages,
 source_dish_id uuid not null references v1.dishes, version int not null default 1 check(version>0),
 archived boolean not null default false, details jsonb not null,
 unique(package_id,source_dish_id)
);
create table v1.package_dish_versions (
 option_id uuid not null references v1.package_dishes, version int not null,
 details jsonb not null, primary key(option_id,version)
);
create table v1.customer_menus (
 day_id uuid not null references v1.delivery_days, meal text not null check(meal in('lunch','dinner')),
 version int not null check(version>0), details jsonb, primary key(day_id,meal)
);
alter table v1.package_dishes enable row level security;
alter table v1.package_dish_versions enable row level security;
alter table v1.customer_menus enable row level security;
revoke all on v1.package_dishes,v1.package_dish_versions,v1.customer_menus from public,anon,authenticated;

create function v1.package_options(pid uuid, include_archived boolean default false) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(d.details||jsonb_build_object('id',d.id,'packageId',d.package_id,'catererId',p.caterer_id,'sourceDishId',d.source_dish_id,'version',d.version,'archived',d.archived) order by d.details->>'name',d.id),'[]')
 from v1.package_dishes d join v1.packages p on p.id=d.package_id where d.package_id=pid and (include_archived or not d.archived)
$$;
create function v1.check_package_options(pid uuid,o jsonb) returns void language plpgsql set search_path='' as $$
declare m jsonb; g jsonb; begin
 if o->>'menuSelectionMode' is distinct from 'customer' then return;end if;
 for m in select * from jsonb_array_elements(o->'menus') loop
  if m->>'contentModel' is distinct from 'slots' then raise exception 'INVALID_INPUT';end if;
  for g in select * from jsonb_array_elements(m->'composition') loop
   if (select count(*) from v1.package_dishes d where d.package_id=pid and not d.archived and d.details->>'categoryId'=g->>'categoryId') < (g->>'slots')::int then raise exception 'INSUFFICIENT_OPTIONS';end if;
  end loop;
 end loop;
end $$;
create function v1.choice_option_save(pid uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$
declare p v1.packages; src v1.dishes; opt v1.package_dishes; data jsonb; begin
 select * into p from v1.packages where id=pid for update;
 if p.offer->>'menuSelectionMode' is distinct from 'customer' or p.status='retired' then raise exception 'INVALID_STATE';end if;
 if a ? 'id' then
  select * into opt from v1.package_dishes where id=(a->>'id')::uuid and package_id=pid for update;
  if not found then raise exception 'FORBIDDEN';end if;
  if jsonb_typeof(a->'version') is distinct from 'number' or (a->>'version')::numeric<>opt.version then raise exception 'CONFLICT';end if;
  if a ? 'archived' and jsonb_typeof(a->'archived')<>'boolean' then raise exception 'INVALID_INPUT';end if;
  data:=opt.details;
  if coalesce((a->>'refresh')::boolean,false) then
   select * into src from v1.dishes where id=opt.source_dish_id and caterer_id=p.caterer_id and not archived;
   if not found then raise exception 'INVALID_INPUT';end if;
   data:=src.details||jsonb_build_object('sourceDishVersion',src.version,'sourceServing',src.details->>'serving');
  end if;
  update v1.package_dishes set details=data,version=version+1,archived=coalesce((a->>'archived')::boolean,archived) where id=opt.id returning * into opt;
 else
  select * into src from v1.dishes where id=(a->>'sourceDishId')::uuid and caterer_id=p.caterer_id and not archived;
  if not found or nullif(src.details->>'categoryId','') is null then raise exception 'INVALID_INPUT';end if;
  insert into v1.package_dishes(package_id,source_dish_id,details) values(pid,src.id,src.details||jsonb_build_object('sourceDishVersion',src.version,'sourceServing',src.details->>'serving')) returning * into opt;
 end if;
 if not exists(select 1 from jsonb_array_elements(p.offer->'menus') m cross join lateral jsonb_array_elements(m->'composition') g where g->>'categoryId'=opt.details->>'categoryId') then raise exception 'INVALID_CATEGORY';end if;
 insert into v1.package_dish_versions values(opt.id,opt.version,opt.details);
 return jsonb_build_object('id',opt.id,'version',opt.version);
end $$;

create function v1.customer_menu_editable(d v1.delivery_days,s v1.subscriptions,meal_name text) returns boolean language sql stable set search_path='' as $$
 select s.status='active' and s.snapshot->'offer'->>'menuSelectionMode'='customer' and d.status='scheduled'
 and clock_timestamp()<v1.cutoff(s.snapshot->'offer',d.service_date)
 and exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal=meal_name and f.status='scheduled')
$$;
create function v1.customer_menu_save(u uuid,a jsonb,reset_menu boolean default false) returns jsonb language plpgsql set search_path='' as $$
declare s v1.subscriptions; p v1.packages; d v1.delivery_days; prev v1.customer_menus; target jsonb; pick jsonb; g jsonb; opt v1.package_dishes; item jsonb; items jsonb; template jsonb; details jsonb; n int; expected int; seen text[]; slot_ids text[]; result jsonb:='[]';
begin
 select * into s from v1.subscriptions where id=(a->>'subscriptionId')::uuid and user_id=u;
 if not found then raise exception 'FORBIDDEN';end if;
 select * into p from v1.packages where id=s.package_id for update;
 select * into s from v1.subscriptions where id=s.id;
 if coalesce(a->>'meal','') not in('lunch','dinner') then raise exception 'INVALID_INPUT';end if;
 select m into template from jsonb_array_elements(s.snapshot->'offer'->'menus') m where m->>'meal'=a->>'meal';
 if template is null or s.snapshot->'offer'->>'menuSelectionMode' is distinct from 'customer' then raise exception 'INVALID_INPUT';end if;
 if jsonb_typeof(a->'days') is distinct from 'array' or jsonb_array_length(a->'days') not between 1 and 31 then raise exception 'INVALID_INPUT';end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(a->'days') x)<>jsonb_array_length(a->'days') then raise exception 'INVALID_INPUT';end if;
 if not reset_menu and jsonb_typeof(a->'choices') is distinct from 'array' then raise exception 'INVALID_INPUT';end if;
 for target in select * from jsonb_array_elements(a->'days') order by value->>'id' loop
  select * into d from v1.delivery_days where id=(target->>'id')::uuid and subscription_id=s.id for update;
  if not found then raise exception 'FORBIDDEN';end if;
  if not coalesce(v1.customer_menu_editable(d,s,a->>'meal'),false) then raise exception 'CUTOFF';end if;
  -- Date/version guard prevents a stale editor from selecting for a rescheduled delivery.
  if target->>'date' is distinct from d.service_date::text or jsonb_typeof(target->'deliveryVersion') is distinct from 'number' or (target->>'deliveryVersion')::numeric<>d.version then raise exception 'CONFLICT';end if;
  select * into prev from v1.customer_menus where day_id=d.id and meal=a->>'meal';
  if jsonb_typeof(target->'version') is distinct from 'number' or (target->>'version')::numeric<>coalesce(prev.version,0) then raise exception 'CONFLICT';end if;
  details:=null;
  if not reset_menu then
   items:='[]';seen:=array[]::text[];slot_ids:=array[]::text[];
   select sum((x->>'slots')::int) into expected from jsonb_array_elements(template->'composition') x;
   if jsonb_array_length(a->'choices')<>expected then raise exception 'INVALID_INPUT';end if;
   for pick in select * from jsonb_array_elements(a->'choices') loop
    if coalesce(pick->>'optionId','')='' or coalesce(pick->>'slotId','')='' or pick->>'optionId'=any(seen) or pick->>'slotId'=any(slot_ids) then raise exception 'INVALID_INPUT';end if;
    if jsonb_typeof(pick->'optionVersion') is distinct from 'number' or (pick->>'optionVersion')::numeric<>trunc((pick->>'optionVersion')::numeric) then raise exception 'INVALID_INPUT';end if;
    seen:=array_append(seen,pick->>'optionId');slot_ids:=array_append(slot_ids,pick->>'slotId');
 select grp into g from jsonb_array_elements(template->'composition') grp cross join lateral generate_series(0,(grp->>'slots')::int-1) pos where pick->>'slotId'=(grp->>'id')||':'||pos::text;
    if g is null then raise exception 'INVALID_INPUT';end if;
    item:=null;
    -- Historical options are grandfathered only in the same saved slot, never in batch copies.
    if jsonb_array_length(a->'days')=1 then
     select old into item from jsonb_array_elements(coalesce(prev.details->'items','[]')) old where old->>'id'=pick->>'slotId' and old->>'optionId'=pick->>'optionId' and old->>'optionVersion'=pick->>'optionVersion';
    end if;
    if item is null then
     select * into opt from v1.package_dishes where id=(pick->>'optionId')::uuid and package_id=p.id and not archived;
     if not found or opt.version<>(pick->>'optionVersion')::int then raise exception 'OPTION_CHANGED';end if;
     if opt.details->>'categoryId' is distinct from g->>'categoryId' then raise exception 'INVALID_CATEGORY';end if;
     item:=opt.details||jsonb_build_object('id',pick->>'slotId','groupId',g->>'id','categoryId',g->>'categoryId','optionId',opt.id,'optionVersion',opt.version,'sourceDishId',opt.source_dish_id);
    end if;
    items:=items||jsonb_build_array(item);
   end loop;
   details:=template||jsonb_build_object('items',items,'nutrition',null,'selectionStatus','selected');
   details:=details||jsonb_build_object('name',v1.contents_summary(details));
  end if;
  insert into v1.customer_menus(day_id,meal,version,details) values(d.id,a->>'meal',coalesce(prev.version,0)+1,details)
  on conflict(day_id,meal) do update set version=excluded.version,details=excluded.details;
  result:=result||jsonb_build_array(jsonb_build_object('id',d.id,'version',coalesce(prev.version,0)+1));
 end loop;
 return jsonb_build_object('days',result);
end $$;

create function v1.delivery_choice_contents(d v1.delivery_days,s v1.subscriptions) returns jsonb language sql stable set search_path='' as $$
 select case when s.snapshot->'offer'->>'menuSelectionMode'='customer' then
  (select coalesce(jsonb_agg(coalesce(c.details,m||jsonb_build_object('items','[]'::jsonb,'name',case when clock_timestamp()<v1.cutoff(s.snapshot->'offer',d.service_date) then 'Pilih menu sendiri' else 'Katerer memilih' end,'selectionStatus',case when clock_timestamp()<v1.cutoff(s.snapshot->'offer',d.service_date) then 'pending' else 'caterer_choice' end)) order by ord),'[]')
   from jsonb_array_elements(s.snapshot->'offer'->'menus') with ordinality x(m,ord) left join v1.customer_menus c on c.day_id=d.id and c.meal=m->>'meal')
 else v1.resolve_contents(s.package_id,d.service_date,s.snapshot->'offer'->'menus',coalesce((s.snapshot->'offer'->>'contentRevision')::int,0)) end
$$;
do $$ declare definition text; begin
 select pg_get_functiondef('v1.delivery(v1.delivery_days)'::regprocedure) into definition;
 if position('v1.resolve_contents(s.package_id,d.service_date,s.snapshot->''offer''->''menus'',coalesce((s.snapshot->''offer''->>''contentRevision'')::int,0))' in definition)=0 then raise exception 'DELIVERY_ANCHOR_MISSING';end if;
 definition:=replace(definition,'v1.resolve_contents(s.package_id,d.service_date,s.snapshot->''offer''->''menus'',coalesce((s.snapshot->''offer''->>''contentRevision'')::int,0))','v1.delivery_choice_contents(d,s)');
 execute definition;
end $$;

alter function public.catera_v1_read(text,jsonb) rename to catera_v1_read_choice_base;
revoke all on function public.catera_v1_read_choice_base(text,jsonb) from public,anon,authenticated;
create function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p v1.packages;s v1.subscriptions;dt date;result jsonb;begin
 if resource='package-options' then
  select * into p from v1.packages where id=(params->>'packageId')::uuid;
  if not found or not (v1.is_staff(u,p.caterer_id) or (p.status='published' and exists(select 1 from v1.caterers where id=p.caterer_id and status='approved')) or exists(select 1 from v1.subscriptions where package_id=p.id and user_id=u)) then raise exception 'FORBIDDEN';end if;
  return v1.package_options(p.id,coalesce(v1.is_staff(u,p.caterer_id),false));
 elsif resource='customer-menu-month' then
  if u is null then raise exception 'UNAUTHORIZED';end if;
  select * into s from v1.subscriptions where id=(params->>'subscriptionId')::uuid and user_id=u;
  if not found then raise exception 'FORBIDDEN';end if;
  dt:=(params->>'month')::date;
  if dt is null or dt<>date_trunc('month',dt)::date or coalesce(params->>'meal','') not in('lunch','dinner') or s.snapshot->'offer'->>'menuSelectionMode' is distinct from 'customer' then raise exception 'INVALID_INPUT';end if;
  return jsonb_build_object('categories',v1.categories((s.snapshot->'offer'->>'catererId')::uuid),'options',v1.package_options(s.package_id),'dates',coalesce((
   select jsonb_agg(jsonb_build_object('date',d.service_date,'dayId',d.id,'deliveryVersion',d.version,'version',coalesce(c.version,0),'details',c.details,'cutoffAt',v1.cutoff(s.snapshot->'offer',d.service_date),'editable',v1.customer_menu_editable(d,s,params->>'meal'),'selectionStatus',case when c.details is not null then 'selected' when clock_timestamp()<v1.cutoff(s.snapshot->'offer',d.service_date) then 'pending' else 'caterer_choice' end) order by d.service_date)
   from v1.delivery_days d left join v1.customer_menus c on c.day_id=d.id and c.meal=params->>'meal'
   where d.subscription_id=s.id and d.status<>'cancelled' and d.service_date>=dt and d.service_date<dt+interval '1 month' and exists(select 1 from v1.fulfillments f where f.day_id=d.id and f.meal=params->>'meal')
  ),'[]'));
 end if;
 return public.catera_v1_read_choice_base(resource,params);
end $$;
revoke all on function public.catera_v1_read(text,jsonb) from public;
grant execute on function public.catera_v1_read(text,jsonb) to anon,authenticated;

-- Keep the prior command's qualified receipt references correct after renaming.
do $$ declare definition text;begin
 select pg_get_functiondef('public.catera_v1_command(text,jsonb,uuid)'::regprocedure) into definition;
 alter function public.catera_v1_command(text,jsonb,uuid) rename to catera_v1_command_choice_base;
 definition:=replace(replace(definition,'public.catera_v1_command(','public.catera_v1_command_choice_base('),'catera_v1_command.request_id','catera_v1_command_choice_base.request_id');execute definition;
end $$;
revoke all on function public.catera_v1_command_choice_base(text,jsonb,uuid) from public,anon,authenticated;
create function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old v1.receipts;fingerprint text:=md5(action||payload::text);result jsonb;p v1.packages;sid jsonb;opt v1.package_dishes;begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if request_id is null then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts r where r.actor_id=u and r.request_id=catera_v1_command.request_id;
 if found then if old.hash<>fingerprint then raise exception 'CONFLICT';end if;return old.result;end if;
 if action='package.save' then
  if payload->'offer' ? 'menuSelectionMode' and coalesce(payload->'offer'->>'menuSelectionMode','') not in('caterer','customer') then raise exception 'INVALID_INPUT';end if;
  result:=public.catera_v1_command_choice_base(action,payload,request_id);
  select * into p from v1.packages where id=(result->>'id')::uuid for update;
  if p.offer->>'menuSelectionMode'='customer' then
   if payload ? 'choiceDishIds' then
    if jsonb_typeof(payload->'choiceDishIds') is distinct from 'array' or jsonb_array_length(payload->'choiceDishIds')>200 then raise exception 'INVALID_INPUT';end if;
    for sid in select * from jsonb_array_elements(payload->'choiceDishIds') loop
     select * into opt from v1.package_dishes where package_id=p.id and source_dish_id=(sid#>>'{}')::uuid;
     if not found then perform v1.choice_option_save(p.id,jsonb_build_object('sourceDishId',sid));
     elsif opt.archived then perform v1.choice_option_save(p.id,jsonb_build_object('id',opt.id,'version',opt.version,'archived',false));end if;
    end loop;
    for opt in select * from v1.package_dishes where package_id=p.id and not archived and not (payload->'choiceDishIds' @> to_jsonb(array[source_dish_id::text])) loop
     perform v1.choice_option_save(p.id,jsonb_build_object('id',opt.id,'version',opt.version,'archived',true));
    end loop;
   end if;
   if p.status='published' then perform v1.check_package_options(p.id,p.offer);end if;
  end if;
  return result;
 elsif action='packageOption.save' then
  select * into p from v1.packages where id=(payload->>'packageId')::uuid for update;
  if not found or not v1.is_staff(u,p.caterer_id,true) then raise exception 'FORBIDDEN';end if;
  result:=v1.choice_option_save(p.id,payload);
  if p.status<>'draft' then perform v1.check_package_options(p.id,p.offer);end if;
 elsif action in('customerMenu.saveBatch','customerMenu.resetBatch') then
  result:=v1.customer_menu_save(u,payload,action='customerMenu.resetBatch');
 else
  -- Serialize production capture against menu commits using the existing package-first lock order.
  if action='production.freeze' then
   if not v1.is_staff(u,(payload->>'catererId')::uuid) then raise exception 'FORBIDDEN';end if;
   perform id from v1.packages where caterer_id=(payload->>'catererId')::uuid order by id for update;
  end if;
  if action in('menu.save','menu.saveBatch') and exists(select 1 from v1.packages where id=(payload->>'packageId')::uuid and offer->>'menuSelectionMode'='customer') then raise exception 'INVALID_ACTION';end if;
  return public.catera_v1_command_choice_base(action,payload,request_id);
 end if;
 insert into v1.audit(actor_id,action,details) values(u,action,payload||jsonb_build_object('requestId',request_id));
 insert into v1.receipts values(u,request_id,fingerprint,result);
 return result;
end $$;
revoke all on function public.catera_v1_command(text,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_command(text,jsonb,uuid) to authenticated;

create function v1.choice_activation_notice() returns trigger language plpgsql set search_path='' as $$
begin
 if new.snapshot->'offer'->>'menuSelectionMode'='customer' then
  perform v1.notify(new.user_id,'menu','Pilih menu untuk pengantaran Anda sebelum batas waktu. Jika belum memilih, katerer menentukan hidangannya.','/subscriptions/'||new.id||'/menu');
 end if;return new;
end $$;
create trigger choice_activation_notice after insert on v1.subscriptions for each row execute function v1.choice_activation_notice();
create function v1.choice_notices() returns void language plpgsql set search_path='' as $$
declare r record;key text;inserted int;owner_id uuid;begin
 for r in select d.id,d.service_date,s.id subscription_id,s.user_id,p.id package_id,p.caterer_id,f.meal,v1.cutoff(s.snapshot->'offer',d.service_date) cutoff_at
 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id join v1.fulfillments f on f.day_id=d.id
 left join v1.customer_menus c on c.day_id=d.id and c.meal=f.meal
 where s.snapshot->'offer'->>'menuSelectionMode'='customer' and s.status='active' and d.status not in('cancelled','delivered') and f.status<>'delivered' and c.details is null
 and clock_timestamp()>=v1.cutoff(s.snapshot->'offer',d.service_date)-interval '24 hours' order by p.id,d.id,f.meal loop
  perform id from v1.packages where id=r.package_id for update;
  perform id from v1.delivery_days where id=r.id for update;
  if not exists(select 1 from v1.delivery_days where id=r.id and service_date=r.service_date and status not in('cancelled','delivered')) or exists(select 1 from v1.customer_menus where day_id=r.id and meal=r.meal and details is not null) then continue;end if;
  key:='choice-'||r.id||'-'||r.meal||'-'||r.service_date||case when clock_timestamp()<r.cutoff_at then '-reminder' else '-fallback' end;
  insert into v1.outbox(kind,payload,dedupe,processed_at) values('reminder.record','{}',key,now()) on conflict(dedupe) do nothing;
  get diagnostics inserted=row_count;
  if inserted>0 then
   perform v1.notify(r.user_id,'menu',r.service_date||' · '||case when r.meal='lunch' then 'Siang: ' else 'Malam: ' end||case when clock_timestamp()<r.cutoff_at then 'Pilih menu sebelum batas waktu; jika belum memilih, katerer menentukan hidangannya.' else 'Batas waktu telah lewat. Katerer memilih hidangan Anda; pengantaran tetap berjalan.' end,'/subscriptions/'||r.subscription_id||'/menu');
   if clock_timestamp()>=r.cutoff_at then
    for owner_id in select user_id from v1.staff where caterer_id=r.caterer_id loop
     perform v1.notify(owner_id,'menu',r.service_date||' · '||r.meal||': Pelanggan belum memilih menu. Tentukan hidangan dan komunikasikan kepada pelanggan.','/seller/calendar?date='||r.service_date);
    end loop;
   end if;
  end if;
 end loop;
end $$;
-- Extend the existing maintenance transaction; no separate notification service.
do $$ declare definition text;begin
 select pg_get_functiondef('public.catera_v1_system(text,jsonb)'::regprocedure) into definition;
 if position('action=''maintenance'' then' in definition)=0 then raise exception 'MAINTENANCE_ANCHOR_MISSING';end if;
 definition:=replace(definition,'action=''maintenance'' then','action=''maintenance'' then perform v1.choice_notices();');execute definition;
end $$;
revoke all on all functions in schema v1 from public,anon,authenticated;
