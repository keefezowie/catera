create or replace function v1.valid_offer(o jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare w jsonb;t jsonb;
begin
 if o is null or jsonb_typeof(o)<>'object' or length(o->>'name') not between 3 and 100 or length(o->>'description') not between 10 and 1500 or (o->>'price')::int not between 1000 and 10000000 or (o->>'days')::int not between 1 and 60 or o->>'meal' not in('lunch','dinner','both') or jsonb_typeof(o->'flexible')<>'boolean' or jsonb_array_length(o->'weekdays') not between 1 and 7 or o->>'status' not in('draft','published','paused','retired') then return false;end if;
 if not(o ?& array['name','description','price','days','meal','flexible','weekdays','status','capacity','tiers','menus','image']) then return false;end if;
 if coalesce((o->>'trialPrice')::int,1000)<1000 or coalesce((o->>'trialMax')::int,1)<1 then return false;end if;
 for w in select * from jsonb_array_elements(o->'weekdays') loop if w::text::int not between 0 and 6 or coalesce((o->'capacity'->>w::text)::int,-1)<0 then return false;end if;end loop;
 for t in select * from jsonb_array_elements(o->'tiers') loop if (t->>'min')::int<1 or (t->>'percent')::numeric not between 0 and 90 then return false;end if;end loop;
 if jsonb_typeof(o->'menus')<>'array' or coalesce(length(o->'windows'->>'lunch'),0)<3 or coalesce(length(o->'windows'->>'dinner'),0)<3 then return false;end if;
 return true;
 exception when others then return false;
end $$;

create or replace function v1.delivery_menu(p uuid,dt date,fallback jsonb) returns jsonb language sql stable set search_path='' as $$
 select coalesce((select jsonb_agg(coalesce(m.details,item)||jsonb_build_object('meal',item->>'meal')) from jsonb_array_elements(fallback) item left join v1.menus m on m.package_id=p and m.service_date=dt and m.meal=item->>'meal'),fallback)
$$;

create or replace function v1.availability(u uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$
declare d v1.delivery_days;s v1.subscriptions;p v1.packages;day date;reason text;result jsonb:='[]';o jsonb;remaining int;
begin
 select * into d from v1.delivery_days where id=(a->>'id')::uuid;if not found then raise exception 'NOT_FOUND';end if;select * into s from v1.subscriptions where id=d.subscription_id;select * into p from v1.packages where id=s.package_id;
 if u is null or (s.user_id<>u and not v1.is_staff(u,p.caterer_id)) then raise exception 'FORBIDDEN';end if;o:=s.snapshot->'offer';
 for day in select generate_series(coalesce((a->>'from')::date,current_date),least(coalesce((a->>'to')::date,current_date+30),coalesce((a->>'from')::date,current_date)+60),'1 day')::date loop
  reason:=null;remaining:=greatest(0,v1.slots(p.id,day)-v1.demand(p.id,day));
  if not (o->>'flexible')::boolean then reason:='FIXED_PACKAGE';elsif d.status<>'scheduled' or v1.cutoff(o,d.service_date)<=clock_timestamp() or v1.cutoff(o,day)<=clock_timestamp() then reason:='CUTOFF';elsif not(o->'weekdays' @> to_jsonb(extract(dow from day)::int)) then reason:='INVALID_DATE';elsif exists(select 1 from v1.delivery_days where subscription_id=s.id and service_date=day) then reason:='DUPLICATE_DATE';elsif remaining<s.portions then reason:='CAPACITY';elsif exists(select 1 from v1.subscriptions x where x.user_id=s.user_id and x.package_id=p.id and x.id<>s.id and x.status='active' and x.starts_on<=greatest(s.ends_on,day) and x.ends_on>=least(s.starts_on,day)) then reason:='OVERLAP';elsif exists(select 1 from v1.checkouts pending where pending.user_id=s.user_id and pending.package_id=p.id and pending.id<>s.checkout_id and pending.state='pending' and pending.expires_at>clock_timestamp() and (pending.quote->'dates'->>0)::date<=greatest(s.ends_on,day) and (pending.quote->'dates'->>-1)::date>=least(s.starts_on,day)) then reason:='OVERLAP';end if;
  result:=result||jsonb_build_object('date',day,'available',reason is null,'reason',reason,'remaining',remaining);
 end loop;return result;
end $$;
