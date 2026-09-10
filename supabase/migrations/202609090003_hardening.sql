-- Additive local upgrade and shared service functions. No demo seed.
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

create or replace function v1.import_quote(u uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$
declare p v1.packages; o jsonb; ad v1.addresses; pol v1.policies; qty int:=(a->>'portions')::int; trial boolean:=coalesce((a->>'trial')::boolean,false); dates jsonb:='[]'; d date:=(a->>'startDate')::date; needed int; counter int:=0; sub int; dis int; pct numeric:=0; promo int:=0; fee int; src text; sellerfee int;
begin
 select * into p from v1.packages where id=(a->>'packageId')::uuid; if not found then raise exception 'NOT_FOUND';end if; o:=v1.offer(p);
 if p.status<>'published' or o->>'sellerStatus'<>'approved' then raise exception 'NOT_AVAILABLE';end if;
 select * into ad from v1.addresses where id=(a->>'addressId')::uuid and user_id=u; if not found then raise exception 'FORBIDDEN';end if;
 if not (o->'areas' ? ad.area) then raise exception 'COVERAGE';end if;
 if d is null or needed<1 or qty is null or qty not between 1 and 100 then raise exception 'INVALID_INPUT';end if;
 if trial and (o->>'trialPrice' is null or (o->>'trialMax' is not null and qty>(o->>'trialMax')::int)) then raise exception 'INVALID_INPUT';end if;
 if trial and exists(select 1 from v1.checkouts x join v1.packages k on k.id=x.package_id where x.user_id=u and k.caterer_id=p.caterer_id and (x.quote->>'trial')::boolean and (x.state in('paid','refunded','partially_refunded','payment_exception') or (x.state='pending' and x.expires_at>clock_timestamp()))) then raise exception 'TRIAL_USED';end if;
 if (a->>'remainingDays')::int not between 1 and (o->>'days')::int or a->>'remainingDays' is null or coalesce(length(a->>'externalReference'),0)<3 then raise exception 'INVALID_INPUT';end if;needed:=(a->>'remainingDays')::int;
 while jsonb_array_length(dates)<needed and counter<730 loop
  if o->'weekdays' @> to_jsonb(extract(dow from d)::int) and not exists(select 1 from v1.capacity where package_id=p.id and service_date=d and closed) then
   if v1.cutoff(o,d)<=clock_timestamp() then raise exception 'CUTOFF';end if;
   if v1.slots(p.id,d)-v1.demand(p.id,d)<qty then raise exception 'CAPACITY';end if;
   dates:=dates||to_jsonb(d::text);
  end if;d:=d+1;counter:=counter+1;
 end loop;
 if jsonb_array_length(dates)<>needed then raise exception 'INVALID_DATE';end if;
 if exists(select 1 from v1.subscriptions s where s.user_id=u and s.package_id=p.id and s.status='active' and s.starts_on<=(dates->>-1)::date and s.ends_on>=(dates->>0)::date) or exists(select 1 from v1.checkouts c where c.user_id=u and c.package_id=p.id and c.state='pending' and c.expires_at>clock_timestamp() and (c.quote->'dates'->>0)::date<=(dates->>-1)::date and (c.quote->'dates'->>-1)::date>=(dates->>0)::date) then raise exception 'OVERLAP';end if;
 select * into pol from v1.policies where id; if not found or not pol.approved or (pol.synthetic and coalesce(current_setting('catera.demo',true),'false')<>'true') then raise exception 'NOT_CONFIGURED';end if;
 sub:=case when trial then (o->>'trialPrice')::int*qty else (o->>'price')::int*qty*needed end;
 if not trial then select coalesce(max((t->>'percent')::numeric),0) into pct from jsonb_array_elements(o->'tiers') t where (t->>'min')::int<=qty;end if;
 dis:=round(sub*pct/100);select round((sub-dis)*percent/100.0)::int into promo from v1.promotions where code=upper(a->>'promo') and active;promo:=coalesce(promo,0);
 select source into src from v1.relationships where user_id=u and caterer_id=p.caterer_id;
 if src is null then src:=case when exists(select 1 from v1.invites where code=a->>'invite' and caterer_id=p.caterer_id and role='customer' and (used_by is null or used_by=u)) then 'invited' else 'marketplace' end;end if;
 src:='legacy';fee:=0;sellerfee:=round((sub-dis)*case when src='marketplace' then pol.marketplace_percent else pol.invited_percent end/100);
 return jsonb_build_object('packageId',p.id,'portions',qty,'trial',trial,'dates',dates,'subtotal',sub,'discount',dis,'discountPercent',pct,'promotion',promo,'serviceFee',fee,'total',sub-dis-promo+fee,'perDay',round((sub-dis)/qty/needed),'sellerFee',0,'externalReference',a->>'externalReference','purchaseKind','legacy_import','source',src,'offer',o,'address',to_jsonb(ad)-'user_id');
end $$;

create or replace function v1.is_admin(u uuid) returns boolean language sql stable set search_path='' as $$ select exists(select 1 from v1.profiles where id=u and role='platform_admin') $$;
create or replace function v1.is_staff(u uuid,c uuid,owner_only boolean default false) returns boolean language sql stable set search_path='' as $$ select exists(select 1 from v1.staff where user_id=u and caterer_id=c and (not owner_only or role='owner')) $$;
create or replace function v1.offer(p v1.packages) returns jsonb language sql stable set search_path='' as $$ select p.offer || jsonb_build_object('id',p.id,'slug',p.slug,'version',p.version,'status',p.status,'catererId',c.id,'caterer',c.name,'catererSlug',c.slug,'sellerStatus',c.status,'areas',c.areas,'cutoff',c.cutoff,'timezone',c.timezone,'rating',(select round(avg(r.rating),1) from v1.reviews r where r.package_id=p.id and not hidden),'reviewCount',(select count(*) from v1.reviews r where r.package_id=p.id and not hidden)) from v1.caterers c where c.id=p.caterer_id $$;
create or replace function v1.demand(p uuid,d date) returns int language sql stable set search_path='' as $$ select coalesce(sum(r.portions),0)::int from v1.reservations r join v1.checkouts c on c.id=r.checkout_id where r.package_id=p and r.service_date=d and (r.state='confirmed' or (r.state='held' and c.expires_at>clock_timestamp())) $$;
create or replace function v1.slots(p uuid,d date) returns int language sql stable set search_path='' as $$ select coalesce((select case when closed then 0 else slots end from v1.capacity where package_id=p and service_date=d),(select (offer->'capacity'->>extract(dow from d)::int::text)::int from v1.packages where id=p),0) $$;
create or replace function v1.cutoff(o jsonb,d date) returns timestamptz language sql immutable set search_path='' as $$ select ((d-1)+(o->>'cutoff')::time) at time zone (o->>'timezone') $$;
create or replace function v1.quote(u uuid,a jsonb) returns jsonb language plpgsql set search_path='' as $$
declare p v1.packages; o jsonb; ad v1.addresses; pol v1.policies; qty int:=(a->>'portions')::int; trial boolean:=coalesce((a->>'trial')::boolean,false); dates jsonb:='[]'; d date:=(a->>'startDate')::date; needed int; counter int:=0; sub int; dis int; pct numeric:=0; promo int:=0; fee int; src text; sellerfee int;
begin
 select * into p from v1.packages where id=(a->>'packageId')::uuid; if not found then raise exception 'NOT_FOUND';end if; o:=v1.offer(p);
 if p.status<>'published' or o->>'sellerStatus'<>'approved' then raise exception 'NOT_AVAILABLE';end if;
 select * into ad from v1.addresses where id=(a->>'addressId')::uuid and user_id=u; if not found then raise exception 'FORBIDDEN';end if;
 if not (o->'areas' ? ad.area) then raise exception 'COVERAGE';end if;
 if d is null or needed<1 or qty is null or qty not between 1 and 100 then raise exception 'INVALID_INPUT';end if;
 if trial and (o->>'trialPrice' is null or (o->>'trialMax' is not null and qty>(o->>'trialMax')::int)) then raise exception 'INVALID_INPUT';end if;
 if trial and exists(select 1 from v1.checkouts x join v1.packages k on k.id=x.package_id where x.user_id=u and k.caterer_id=p.caterer_id and (x.quote->>'trial')::boolean and (x.state in('paid','refunded','partially_refunded','payment_exception') or (x.state='pending' and x.expires_at>clock_timestamp()))) then raise exception 'TRIAL_USED';end if;
 needed:=case when trial then 1 else (o->>'days')::int end;
 while jsonb_array_length(dates)<needed and counter<730 loop
  if o->'weekdays' @> to_jsonb(extract(dow from d)::int) and not exists(select 1 from v1.capacity where package_id=p.id and service_date=d and closed) then
   if v1.cutoff(o,d)<=clock_timestamp() then raise exception 'CUTOFF';end if;
   if v1.slots(p.id,d)-v1.demand(p.id,d)<qty then raise exception 'CAPACITY';end if;
   dates:=dates||to_jsonb(d::text);
  end if;d:=d+1;counter:=counter+1;
 end loop;
 if jsonb_array_length(dates)<>needed then raise exception 'INVALID_DATE';end if;
 if exists(select 1 from v1.subscriptions s where s.user_id=u and s.package_id=p.id and s.status='active' and s.starts_on<=(dates->>-1)::date and s.ends_on>=(dates->>0)::date) or exists(select 1 from v1.checkouts c where c.user_id=u and c.package_id=p.id and c.state='pending' and c.expires_at>clock_timestamp() and (c.quote->'dates'->>0)::date<=(dates->>-1)::date and (c.quote->'dates'->>-1)::date>=(dates->>0)::date) then raise exception 'OVERLAP';end if;
 select * into pol from v1.policies where id; if not found or not pol.approved or (pol.synthetic and coalesce(current_setting('catera.demo',true),'false')<>'true') then raise exception 'NOT_CONFIGURED';end if;
 sub:=case when trial then (o->>'trialPrice')::int*qty else (o->>'price')::int*qty*needed end;
 if not trial then select coalesce(max((t->>'percent')::numeric),0) into pct from jsonb_array_elements(o->'tiers') t where (t->>'min')::int<=qty;end if;
 dis:=round(sub*pct/100);select round((sub-dis)*percent/100.0)::int into promo from v1.promotions where code=upper(a->>'promo') and active;promo:=coalesce(promo,0);
 select source into src from v1.relationships where user_id=u and caterer_id=p.caterer_id;
 if src is null then src:=case when exists(select 1 from v1.invites where code=a->>'invite' and caterer_id=p.caterer_id and role='customer' and (used_by is null or used_by=u)) then 'invited' else 'marketplace' end;end if;
 fee:=pol.service_fee;sellerfee:=round((sub-dis)*case when src='marketplace' then pol.marketplace_percent else pol.invited_percent end/100);
 return jsonb_build_object('packageId',p.id,'portions',qty,'trial',trial,'dates',dates,'subtotal',sub,'discount',dis,'discountPercent',pct,'promotion',promo,'serviceFee',fee,'total',sub-dis-promo+fee,'perDay',round((sub-dis)/qty/needed),'sellerFee',sellerfee,'source',src,'offer',o,'address',to_jsonb(ad)-'user_id');
end $$;
create or replace function v1.delivery(d v1.delivery_days) returns jsonb language sql stable set search_path='' as $$ select to_jsonb(d)||jsonb_build_object('portions',s.portions,'trial',s.snapshot->'trial','offer',jsonb_set(s.snapshot->'offer','{menus}',v1.delivery_menu(s.package_id,d.service_date,s.snapshot->'offer'->'menus')),'cutoff_at',v1.cutoff(s.snapshot->'offer',d.service_date),'canChange',(s.snapshot->'offer'->>'flexible')::boolean and d.status='scheduled' and v1.cutoff(s.snapshot->'offer',d.service_date)>clock_timestamp(),'meals',(select jsonb_agg(jsonb_build_object('meal',f.meal,'status',f.status) order by f.meal desc) from v1.fulfillments f where f.day_id=d.id)) from v1.subscriptions s where s.id=d.subscription_id $$;
create or replace function v1.notify(u uuid,k text,b text,h text) returns void language plpgsql set search_path='' as $$ declare n uuid;begin insert into v1.notifications(user_id,kind,body,href) values(u,k,b,h) returning id into n;insert into v1.outbox(kind,payload,dedupe) values('push',jsonb_build_object('userId',u,'body',b,'href',h),n::text);end $$;
create or replace function v1.activate(cid uuid) returns uuid language plpgsql set search_path='' as $$
declare c v1.checkouts;p v1.packages;s uuid;d text;did uuid;m text;ad jsonb;
begin
 select * into c from v1.checkouts where id=cid for update;if c.subscription_id is not null then return c.subscription_id;end if;if c.state='payment_exception' then return null;end if;
 select * into p from v1.packages where id=c.package_id for update;
 for d in select jsonb_array_elements_text(c.quote->'dates') loop
  if v1.cutoff(c.quote->'offer',d::date)<=clock_timestamp() or v1.slots(p.id,d::date)-v1.demand(p.id,d::date)+coalesce((select portions from v1.reservations where checkout_id=cid and service_date=d::date and (state='confirmed' or (state='held' and c.expires_at>clock_timestamp()))),0)<(c.quote->>'portions')::int then
   update v1.checkouts set state='payment_exception' where id=cid;update v1.reservations set state='released' where checkout_id=cid;
   insert into v1.support_cases(user_id,caterer_id,checkout_id,subject,description,status) values(c.user_id,p.caterer_id,cid,'Pembayaran perlu ditinjau','Pembayaran diterima setelah jadwal tidak lagi tersedia. Pengembalian ditinjau Catera.','escalated');return null;
  end if;
 end loop;
 if exists(select 1 from v1.subscriptions x where x.user_id=c.user_id and x.package_id=c.package_id and x.status='active' and x.starts_on<=(c.quote->'dates'->>-1)::date and x.ends_on>=(c.quote->'dates'->>0)::date) or ((c.quote->>'trial')::boolean and exists(select 1 from v1.subscriptions x join v1.packages k on k.id=x.package_id where x.user_id=c.user_id and k.caterer_id=p.caterer_id and (x.snapshot->>'trial')::boolean)) then
 update v1.checkouts set state='payment_exception' where id=cid;update v1.reservations set state='released' where checkout_id=cid;insert into v1.support_cases(user_id,caterer_id,checkout_id,subject,description,status) values(c.user_id,p.caterer_id,cid,'Pembayaran perlu ditinjau','Pembayaran bertabrakan dengan langganan atau trial yang telah aktif.','escalated');return null;end if;
 insert into v1.subscriptions(checkout_id,user_id,package_id,snapshot,portions,starts_on,ends_on) values(cid,c.user_id,p.id,c.quote,(c.quote->>'portions')::int,(c.quote->'dates'->>0)::date,(c.quote->'dates'->>-1)::date) returning id into s;
 ad:=coalesce(c.quote->'address',(select to_jsonb(a)-'user_id' from v1.addresses a where a.id=c.address_id));
 for d in select jsonb_array_elements_text(c.quote->'dates') loop
  insert into v1.delivery_days(subscription_id,service_date,address) values(s,d::date,ad) returning id into did;
  foreach m in array case when c.quote->'offer'->>'meal'='both' then array['lunch','dinner'] else array[c.quote->'offer'->>'meal'] end loop insert into v1.fulfillments(day_id,meal) values(did,m);end loop;
 end loop;
 update v1.reservations set state='confirmed' where checkout_id=cid;update v1.checkouts set state='paid',subscription_id=s where id=cid;
 insert into v1.relationships values(c.user_id,p.caterer_id,c.quote->>'source') on conflict do nothing;
 insert into v1.allocations(checkout_id,caterer_id,amount) values(cid,p.caterer_id,(c.quote->>'subtotal')::int-(c.quote->>'discount')::int-(c.quote->>'sellerFee')::int);
 perform v1.notify(c.user_id,'purchase','Paket Anda sudah aktif. Lihat jadwal makanan berikutnya.','/subscriptions/'||s);
 perform v1.notify(st.user_id,'subscription','Langganan baru: '||(c.quote->'offer'->>'name'),'/seller') from v1.staff st where st.caterer_id=p.caterer_id;
 return s;
end $$;
create or replace function public.catera_v1_read(resource text,params jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();result jsonb;seller_id uuid;dt date;lim int:=least(greatest(coalesce((params->>'limit')::int,50),1),100);offst int:=greatest(coalesce((params->>'offset')::int,0),0);
begin
 if resource='catalog' then
  select jsonb_build_object('items',coalesce(jsonb_agg(x.o),'[]'),'nextCursor',case when count(*)=lim then (offst+lim)::text else null end) into result from (select v1.offer(p) o from v1.packages p join v1.caterers c on c.id=p.caterer_id where p.status='published' and c.status='approved' order by case when c.areas @> array[params->>'area'] then 0 else 1 end,p.slug limit lim offset offst)x;return result;
 elsif resource='reviews' then return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('customer',p.name)) from v1.reviews r join v1.profiles p on p.id=r.user_id where r.package_id=(params->>'id')::uuid and not hidden),'[]');
 end if;
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if resource='actor' then return (select to_jsonb(p)||jsonb_build_object('catererId',(select caterer_id from v1.staff where user_id=u limit 1)) from v1.profiles p where p.id=u);
 elsif resource='availability' then return v1.availability(u,params);
 elsif resource='quote' then return v1.quote(u,params);
 elsif resource='checkout' then return (select to_jsonb(x) from v1.checkouts x where id=(params->>'id')::uuid and user_id=u);
 elsif resource='customer' then
  return jsonb_build_object('subscriptions',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('remaining',(select count(*) from v1.delivery_days d where d.subscription_id=s.id and d.status not in('delivered','cancelled')))) from v1.subscriptions s where s.user_id=u),'[]'),'deliveries',coalesce((select jsonb_agg(v1.delivery(d) order by d.service_date) from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.user_id=u and ((params->>'deliveryId' is not null and d.id=(params->>'deliveryId')::uuid) or (params->>'deliveryId' is null and d.service_date between coalesce((params->>'from')::date,current_date-7) and coalesce((params->>'to')::date,current_date+60)))),'[]'),'addresses',coalesce((select jsonb_agg(to_jsonb(a)-'user_id') from v1.addresses a where user_id=u),'[]'),'notifications',coalesce((select jsonb_agg(to_jsonb(n)) from (select * from v1.notifications where user_id=u order by created_at desc limit 50)n),'[]'),'cases',coalesce((select jsonb_agg(to_jsonb(s)) from v1.support_cases s where user_id=u),'[]'));
 elsif resource='conversations' then
  return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('caterer',k.name,'customer',p.name,'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from (select * from v1.messages where conversation_id=c.id order by created_at desc limit 100)m),'[]'))) from v1.conversations c join v1.caterers k on k.id=c.caterer_id join v1.profiles p on p.id=c.customer_id where c.customer_id=u or v1.is_staff(u,c.caterer_id)),'[]');
 elsif resource='seller' then
  seller_id:=(params->>'id')::uuid;dt:=coalesce((params->>'date')::date,current_date);if not v1.is_staff(u,seller_id) then raise exception 'FORBIDDEN';end if;
  return jsonb_build_object('caterer',(select to_jsonb(k)||jsonb_build_object('area',k.areas) from v1.caterers k where id=seller_id),'offers',coalesce((select jsonb_agg(v1.offer(p)) from v1.packages p where caterer_id=seller_id),'[]'),'deliveries',coalesce((select jsonb_agg(v1.delivery(d)) from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=seller_id and d.service_date=dt),'[]'),'cases',coalesce((select jsonb_agg(to_jsonb(x)) from v1.support_cases x where caterer_id=seller_id),'[]'),'customers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'source',r.source)) from v1.relationships r join v1.profiles p on p.id=r.user_id where r.caterer_id=seller_id),'[]'),'transactions',case when v1.is_staff(u,seller_id,true) then coalesce((select jsonb_agg(to_jsonb(x)) from (select ch.* from v1.checkouts ch join v1.packages p on p.id=ch.package_id where p.caterer_id=seller_id order by created_at desc limit 100)x),'[]') else '[]'::jsonb end,'staff',case when v1.is_staff(u,seller_id,true) then coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('name',p.name)) from v1.staff s join v1.profiles p on p.id=s.user_id where s.caterer_id=seller_id),'[]') else '[]'::jsonb end,'payouts',case when v1.is_staff(u,seller_id,true) then coalesce((select jsonb_agg(to_jsonb(p)) from v1.payouts p where caterer_id=seller_id),'[]') else '[]'::jsonb end);
 elsif resource='admin' then
  if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
  return jsonb_build_object('caterers',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('area',c.areas,'offers',coalesce((select jsonb_agg(v1.offer(pack)) from v1.packages pack where pack.caterer_id=c.id),'[]'))) from v1.caterers c),'[]'),'cases',coalesce((select jsonb_agg(to_jsonb(s)) from v1.support_cases s),'[]'),'transactions',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from v1.checkouts order by created_at desc limit 100)c),'[]'),'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from v1.audit order by created_at desc limit 100)a),'[]'),'promotions',coalesce((select jsonb_agg(to_jsonb(p)) from v1.promotions p),'[]'),'payouts',coalesce((select jsonb_agg(to_jsonb(p)) from v1.payouts p),'[]'),'refunds',coalesce((select jsonb_agg(to_jsonb(r)) from v1.refunds r),'[]'),'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from v1.reviews r),'[]'));
 end if;raise exception 'NOT_FOUND';
end $$;
create or replace function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();a jsonb:=payload;r jsonb:='{}';old v1.receipts;hash text:=md5(action||payload::text);p v1.packages;o jsonb;c v1.checkouts;s v1.subscriptions;d v1.delivery_days;ad v1.addresses;cs v1.support_cases;ident uuid;cid uuid;target date;qty int;amt int;nextstatus text;mealstatus text;mealkey text;dt text;rowdata jsonb;rev int;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into old from v1.receipts where actor_id=u and receipts.request_id=catera_v1_command.request_id;
 if found then if old.hash<>hash then raise exception 'CONFLICT';end if;return old.result;end if;
 if action='profile.ensure' then insert into v1.profiles(id,name) values(u,coalesce(nullif(a->>'name',''),'Pelanggan')) on conflict do nothing;r:=jsonb_build_object('id',u);
 elsif action='address.save' then
  if length(a->>'line')<5 or coalesce(a->>'area','')='' then raise exception 'INVALID_INPUT';end if;
  ident:=(a->>'id')::uuid;
  if ident is null then insert into v1.addresses(user_id,label,line,area,city,instructions) values(u,a->>'label',a->>'line',a->>'area',a->>'city',coalesce(a->>'instructions','')) returning id into ident;
  else update v1.addresses set label=a->>'label',line=a->>'line',area=a->>'area',city=a->>'city',instructions=coalesce(a->>'instructions',''),version=version+1 where id=ident and user_id=u and version=(a->>'version')::int;if not found then raise exception 'CONFLICT';end if;end if;r:=jsonb_build_object('id',ident);
 elsif action='checkout.create' then
  select * into p from v1.packages where id=(a->>'packageId')::uuid for update;o:=v1.quote(u,a);if a ? 'expectedQuote' and a->'expectedQuote'<>o then raise exception 'PRICE_CHANGED';end if;
  insert into v1.checkouts(user_id,package_id,address_id,quote,expires_at) values(u,p.id,(a->>'addressId')::uuid,o,least(clock_timestamp()+interval '15 minutes',v1.cutoff(o->'offer',(o->'dates'->>0)::date))) returning * into c;
  for dt in select jsonb_array_elements_text(o->'dates') loop insert into v1.reservations values(c.id,p.id,dt::date,(a->>'portions')::int,'held');end loop;
  insert into v1.relationships values(u,p.caterer_id,o->>'source') on conflict do nothing;
  update v1.invites set used_by=u where code=a->>'invite' and caterer_id=p.caterer_id and role='customer' and used_by is null;
  insert into v1.outbox(kind,payload,dedupe) values('payment.create',jsonb_build_object('checkoutId',c.id),c.id::text);
  r:=to_jsonb(c);
 elsif action='checkout.demo_pay' then
  if coalesce(current_setting('catera.demo',true),'false')<>'true' then raise exception 'FORBIDDEN';end if;
  select * into c from v1.checkouts where id=(a->>'id')::uuid and user_id=u for update;if not found then raise exception 'FORBIDDEN';end if;
  insert into v1.payments(checkout_id,provider_id,amount,state) values(c.id,'demo-'||c.id,(c.quote->>'total')::int,'paid') on conflict(checkout_id) do nothing;
  ident:=v1.activate(c.id);r:=jsonb_build_object('id',c.id,'subscriptionId',ident);
 elsif action in('delivery.reschedule','delivery.address','delivery.status') then
  select * into d from v1.delivery_days where id=(a->>'id')::uuid;if not found then raise exception 'NOT_FOUND';end if;select * into s from v1.subscriptions where id=d.subscription_id;select * into p from v1.packages where id=s.package_id for update;
  select * into d from v1.delivery_days where id=d.id for update;
  if s.user_id<>u and not v1.is_staff(u,p.caterer_id) then raise exception 'FORBIDDEN';end if;
  if d.version is distinct from (a->>'version')::int then raise exception 'CONFLICT';end if;
  if action='delivery.status' then
   if not v1.is_staff(u,p.caterer_id) then raise exception 'FORBIDDEN';end if;if d.service_date>(clock_timestamp() at time zone (s.snapshot->'offer'->>'timezone'))::date then raise exception 'INVALID_DATE';end if;nextstatus:=a->>'status';
   mealkey:=a->>'meal';if mealkey is null then if (select count(*) from v1.fulfillments where day_id=d.id)>1 then raise exception 'INVALID_INPUT';end if;select meal into mealkey from v1.fulfillments where day_id=d.id;end if;
   select status into mealstatus from v1.fulfillments where day_id=d.id and meal=mealkey;if not found then raise exception 'INVALID_INPUT';end if;
   if not ((mealstatus='scheduled' and nextstatus='preparing') or (mealstatus='preparing' and nextstatus='out_for_delivery') or (mealstatus='out_for_delivery' and nextstatus in('delivered','issue')) or (mealstatus='issue' and nextstatus='out_for_delivery')) then raise exception 'INVALID_STATE';end if;
   update v1.fulfillments set status=nextstatus where day_id=d.id and meal=mealkey;
   if not exists(select 1 from v1.fulfillments where day_id=d.id and status<>'delivered') then nextstatus:='delivered';elsif exists(select 1 from v1.fulfillments where day_id=d.id and status='issue') then nextstatus:='issue';elsif exists(select 1 from v1.fulfillments where day_id=d.id and status='out_for_delivery') then nextstatus:='out_for_delivery';else nextstatus:='preparing';end if;
   update v1.delivery_days set status=nextstatus,version=version+1 where id=d.id;
   if not exists(select 1 from v1.delivery_days where subscription_id=s.id and status not in('delivered','cancelled')) then update v1.subscriptions set status='completed' where id=s.id;end if;
   perform v1.notify(s.user_id,'delivery',case when nextstatus='delivered' then 'Makanan sudah terkirim. Selamat menikmati!' else 'Status pengantaran Anda diperbarui.' end,'/deliveries/'||d.id);
  else
   if d.status<>'scheduled' or v1.cutoff(s.snapshot->'offer',d.service_date)<=clock_timestamp() then raise exception 'CUTOFF';end if;
   if action='delivery.address' then
    select * into ad from v1.addresses where id=(a->>'addressId')::uuid and user_id=s.user_id;if not found then raise exception 'FORBIDDEN';end if;
    if not (v1.offer(p)->'areas' ? ad.area) then raise exception 'COVERAGE';end if;
    update v1.delivery_days set address=to_jsonb(ad)-'user_id',version=version+1 where id=d.id;
   else
    if not (s.snapshot->'offer'->>'flexible')::boolean then raise exception 'FIXED_PACKAGE';end if;target:=(a->>'date')::date;
    if v1.cutoff(s.snapshot->'offer',target)<=clock_timestamp() then raise exception 'CUTOFF';end if;
    if not(s.snapshot->'offer'->'weekdays' @> to_jsonb(extract(dow from target)::int)) then raise exception 'INVALID_DATE';end if;
    if exists(select 1 from v1.delivery_days where subscription_id=s.id and service_date=target) then raise exception 'DUPLICATE_DATE';end if;
    if v1.slots(p.id,target)-v1.demand(p.id,target)<s.portions then raise exception 'CAPACITY';end if;
    if exists(select 1 from v1.subscriptions x where x.user_id=s.user_id and x.package_id=p.id and x.id<>s.id and x.status='active' and x.starts_on<=greatest(s.ends_on,target) and x.ends_on>=least(s.starts_on,target)) then raise exception 'OVERLAP';end if;
    if exists(select 1 from v1.checkouts pending where pending.user_id=s.user_id and pending.package_id=p.id and pending.id<>s.checkout_id and pending.state='pending' and pending.expires_at>clock_timestamp() and (pending.quote->'dates'->>0)::date<=greatest(s.ends_on,target) and (pending.quote->'dates'->>-1)::date>=least(s.starts_on,target)) then raise exception 'OVERLAP';end if;
    insert into v1.reservations(checkout_id,package_id,service_date,portions,state) values(s.checkout_id,p.id,target,s.portions,'confirmed') on conflict(checkout_id,service_date) do update set portions=excluded.portions,state='confirmed';
    update v1.reservations set state='released' where checkout_id=s.checkout_id and service_date=d.service_date;
    update v1.delivery_days set service_date=target,version=version+1 where id=d.id;
    update v1.subscriptions set starts_on=(select min(service_date) from v1.delivery_days where subscription_id=s.id),ends_on=(select max(service_date) from v1.delivery_days where subscription_id=s.id) where id=s.id;
   end if;perform v1.notify(s.user_id,'change','Perubahan pengantaran sudah tersimpan.','/deliveries/'||d.id);
  end if;r:=jsonb_build_object('id',d.id);
 elsif action='support.create' then
  if a->>'deliveryId' is not null then select * into d from v1.delivery_days where id=(a->>'deliveryId')::uuid;select * into s from v1.subscriptions where id=d.subscription_id;else select * into s from v1.subscriptions where id=(a->>'subscriptionId')::uuid;end if;
  if s.user_id is distinct from u then raise exception 'FORBIDDEN';end if;select * into p from v1.packages where id=s.package_id;
  insert into v1.support_cases(user_id,caterer_id,delivery_id,subscription_id,checkout_id,subject,description) values(u,p.caterer_id,d.id,s.id,s.checkout_id,a->>'subject',a->>'description') returning id into ident;
  update v1.allocations set held=greatest(held,amount-paid_out) where checkout_id=s.checkout_id;
  perform v1.notify(st.user_id,'support','Ada permintaan bantuan baru.','/seller/support') from v1.staff st where st.caterer_id=p.caterer_id;r:=jsonb_build_object('id',ident);
 elsif action in('support.respond','support.escalate','support.resolve') then
  select * into cs from v1.support_cases where id=(a->>'id')::uuid for update;if not found then raise exception 'NOT_FOUND';end if;
  if cs.status='resolved' then raise exception 'CONFLICT';end if;
  if action='support.respond' then if not v1.is_staff(u,cs.caterer_id) then raise exception 'FORBIDDEN';end if;update v1.support_cases set status='responded',resolution=a->>'response' where id=cs.id;
  elsif action='support.escalate' then if cs.user_id<>u and not v1.is_staff(u,cs.caterer_id) then raise exception 'FORBIDDEN';end if;update v1.support_cases set status='escalated' where id=cs.id;
  else
   if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;if cs.status='resolved' then raise exception 'CONFLICT';end if;if coalesce(length(a->>'reason'),0)<5 then raise exception 'INVALID_INPUT';end if;
   select * into c from v1.checkouts where id=cs.checkout_id for update;amt:=coalesce((a->>'amount')::int,0);
   if amt<0 or amt>(c.quote->>'total')::int-coalesce((select sum(amount) from v1.refunds where checkout_id=c.id and state<>'failed'),0) then raise exception 'AMOUNT_INVALID';end if;
   if amt>0 then insert into v1.refunds(case_id,checkout_id,amount) values(cs.id,c.id,amt) returning id into ident;insert into v1.outbox(kind,payload,dedupe) values('refund.create',jsonb_build_object('refundId',ident),ident::text);end if;
   if coalesce((a->>'cancelRemaining')::boolean,false) then
    select * into p from v1.packages where id=c.package_id for update;
    update v1.reservations set state='released' where checkout_id=c.id and service_date in(select service_date from v1.delivery_days where subscription_id=c.subscription_id and status in('scheduled','preparing','issue'));
    update v1.fulfillments set status='cancelled' where day_id in(select id from v1.delivery_days where subscription_id=c.subscription_id and status in('scheduled','preparing','issue'));
    update v1.delivery_days set status='cancelled',version=version+1 where subscription_id=c.subscription_id and status in('scheduled','preparing','issue');update v1.subscriptions set status='cancelled' where id=c.subscription_id;
   end if;
   update v1.support_cases set status='resolved',resolution=a->>'reason',amount=amt where id=cs.id;
   if amt=0 and not exists(select 1 from v1.support_cases where checkout_id=c.id and status<>'resolved') then update v1.allocations set held=0 where checkout_id=c.id;end if;
  end if;perform v1.notify(cs.user_id,'support','Permintaan bantuan Anda diperbarui.','/support');r:=jsonb_build_object('id',cs.id);
 elsif action='message.send' then
  cid:=(a->>'catererId')::uuid;ident:=(a->>'conversationId')::uuid;
  if ident is null then if not exists(select 1 from v1.caterers where id=cid and status='approved') then raise exception 'NOT_FOUND';end if;insert into v1.conversations(customer_id,caterer_id) values(u,cid) on conflict(customer_id,caterer_id) do update set customer_id=excluded.customer_id returning id into ident;
  else if not exists(select 1 from v1.conversations where id=ident and (customer_id=u or v1.is_staff(u,caterer_id))) then raise exception 'FORBIDDEN';end if;end if;
  insert into v1.messages(conversation_id,sender_id,body) values(ident,u,trim(a->>'body'));
  perform v1.notify(v.customer_id,'message','Pesan baru dari katerer.','/messages') from v1.conversations v where v.id=ident and v.customer_id<>u;
  perform v1.notify(st.user_id,'message','Pesan baru dari pelanggan.','/seller/support') from v1.staff st join v1.conversations v on v.caterer_id=st.caterer_id where v.id=ident and v.customer_id=u;
  r:=jsonb_build_object('id',ident);
 elsif action='review.save' then
  select * into s from v1.subscriptions where id=(a->>'subscriptionId')::uuid and user_id=u;if not found or not exists(select 1 from v1.delivery_days where subscription_id=s.id and status='delivered') then raise exception 'FORBIDDEN';end if;
  insert into v1.reviews(subscription_id,user_id,package_id,rating,food,delivery,value,body) values(s.id,u,s.package_id,(a->>'rating')::int,(a->>'food')::int,(a->>'delivery')::int,(a->>'value')::int,a->>'body') on conflict(subscription_id) do update set rating=excluded.rating,food=excluded.food,delivery=excluded.delivery,value=excluded.value,body=excluded.body returning id into ident;r:=jsonb_build_object('id',ident);
 elsif action='review.reply' then
  if not exists(select 1 from v1.reviews review join v1.packages pack on pack.id=review.package_id where review.id=(a->>'id')::uuid and v1.is_staff(u,pack.caterer_id)) then raise exception 'FORBIDDEN';end if;update v1.reviews set reply=a->>'reply' where id=(a->>'id')::uuid;
 elsif action='seller.create' then
  insert into v1.caterers(slug,name,description,areas) values(a->>'slug',a->>'name',a->>'description',array(select jsonb_array_elements_text(a->'areas'))) returning id into ident;insert into v1.staff values(ident,u,'owner');update v1.profiles set role='owner' where id=u;r:=jsonb_build_object('id',ident);
 elsif action in('seller.save','seller.submit','staff.invite','package.save','capacity.save','menu.save','production.freeze','import.preview','import.commit') then
  cid:=(a->>'catererId')::uuid;if not v1.is_staff(u,cid,action<>'production.freeze') then raise exception 'FORBIDDEN';end if;
  if action='seller.save' then update v1.caterers set name=a->>'name',description=a->>'description',areas=array(select jsonb_array_elements_text(a->'areas')),cutoff=(a->>'cutoff')::time,version=version+1 where id=cid and version=(a->>'version')::int;if not found then raise exception 'CONFLICT';end if;
  elsif action='seller.submit' then if not exists(select 1 from v1.packages where caterer_id=cid) then raise exception 'INVALID_INPUT';end if;update v1.caterers set status='submitted',version=version+1 where id=cid and status in('draft','corrections');if not found then raise exception 'CONFLICT';end if;
  elsif action='staff.invite' then insert into v1.invites(caterer_id,role) values(cid,'staff') returning id into ident;r:=(select to_jsonb(i) from v1.invites i where id=ident);
  elsif action='package.save' then
   if not v1.valid_offer(a->'offer') then raise exception 'INVALID_INPUT';end if;
   ident:=(a->>'id')::uuid;
   if ident is null then insert into v1.packages(caterer_id,slug,offer,status) values(cid,a->>'slug',a->'offer',a->'offer'->>'status') returning id into ident;
   else select * into p from v1.packages where id=ident and caterer_id=cid for update;if not found then raise exception 'FORBIDDEN';end if;
    for target in select distinct service_date from v1.reservations where package_id=ident and state<>'released' and service_date>=current_date loop
     if not exists(select 1 from v1.capacity where package_id=ident and service_date=target) and coalesce((a->'offer'->'capacity'->>extract(dow from target)::int::text)::int,0)<v1.demand(ident,target) then raise exception 'CAPACITY';end if;
    end loop;
    update v1.packages set offer=a->'offer',status=a->'offer'->>'status',version=version+1 where id=ident and caterer_id=cid and version=(a->>'version')::int;if not found then raise exception 'CONFLICT';end if;
   end if;r:=jsonb_build_object('id',ident);
  elsif action='capacity.save' then
   select * into p from v1.packages where id=(a->>'packageId')::uuid and caterer_id=cid for update;if not found then raise exception 'FORBIDDEN';end if;target:=(a->>'date')::date;qty:=(a->>'slots')::int;
   if qty<v1.demand(p.id,target) or (coalesce((a->>'closed')::boolean,false) and v1.demand(p.id,target)>0) then raise exception 'CAPACITY';end if;
   insert into v1.capacity values(p.id,target,qty,coalesce((a->>'closed')::boolean,false)) on conflict(package_id,service_date) do update set slots=excluded.slots,closed=excluded.closed;
  elsif action='menu.save' then
   if not exists(select 1 from v1.packages where id=(a->>'packageId')::uuid and caterer_id=cid) then raise exception 'FORBIDDEN';end if;
   insert into v1.menus values((a->>'packageId')::uuid,(a->>'date')::date,a->>'meal',a->'details') on conflict(package_id,service_date,meal) do update set details=excluded.details;
   perform v1.notify(sub.user_id,'menu','Menu pengantaran Anda diperbarui.','/calendar') from v1.subscriptions sub join v1.delivery_days day on day.subscription_id=sub.id where sub.package_id=(a->>'packageId')::uuid and day.service_date=(a->>'date')::date;
  elsif action='production.freeze' then
   perform 1 from v1.caterers where id=cid for update;target:=(a->>'date')::date;select coalesce(max(revision),0)+1 into rev from v1.production where caterer_id=cid and service_date=target;
   insert into v1.production(caterer_id,service_date,revision,entries) values(cid,target,rev,coalesce((select jsonb_agg(v1.delivery(day)) from v1.delivery_days day join v1.subscriptions sub on sub.id=day.subscription_id join v1.packages pack on pack.id=sub.package_id where pack.caterer_id=cid and day.service_date=target and day.status<>'cancelled'),'[]')) returning id into ident;r:=jsonb_build_object('id',ident,'revision',rev);
  elsif action='import.preview' then
   if jsonb_array_length(a->'rows')>100 then raise exception 'INVALID_INPUT';end if;
   o:='[]';for rowdata in select * from jsonb_array_elements(a->'rows') loop
    if not exists(select 1 from v1.packages where id=(rowdata->>'packageId')::uuid and caterer_id=cid) or not exists(select 1 from v1.profiles where id=(rowdata->>'customerId')::uuid) then raise exception 'INVALID_INPUT';end if;
    r:=v1.import_quote((rowdata->>'customerId')::uuid,rowdata);o:=o||jsonb_build_object('customerId',rowdata->>'customerId','addressId',rowdata->>'addressId','packageId',rowdata->>'packageId','portions',rowdata->'portions','startDate',rowdata->>'startDate','remainingDays',rowdata->'remainingDays','externalReference',rowdata->>'externalReference','preview',r);
   end loop;insert into v1.imports(caterer_id,created_by,rows) values(cid,u,o) returning id into ident;r:=jsonb_build_object('id',ident,'rows',o);
  else
   select rows into o from v1.imports where id=(a->>'id')::uuid and caterer_id=cid and state='preview' for update;if not found then raise exception 'CONFLICT';end if;
   perform 1 from v1.packages where id in(select (j->>'packageId')::uuid from jsonb_array_elements(o) j) order by id for update;
   for rowdata in select * from jsonb_array_elements(o) loop
    select * into p from v1.packages where id=(rowdata->>'packageId')::uuid for update;
    insert into v1.relationships values((rowdata->>'customerId')::uuid,cid,'legacy') on conflict do nothing;
    rowdata:=rowdata||jsonb_build_object('trial',false,'promo','','invite','');
    r:=v1.import_quote((rowdata->>'customerId')::uuid,rowdata);
    insert into v1.checkouts(user_id,package_id,address_id,quote,expires_at) values((rowdata->>'customerId')::uuid,p.id,(rowdata->>'addressId')::uuid,r,now()+interval '15 minutes') returning id into ident;
    for dt in select jsonb_array_elements_text(r->'dates') loop insert into v1.reservations values(ident,p.id,dt::date,(r->>'portions')::int,'held');end loop;
    ident:=v1.activate(ident);update v1.subscriptions set legacy=true where id=ident;delete from v1.allocations where checkout_id=(select checkout_id from v1.subscriptions where id=ident);
   end loop;update v1.imports set state='committed' where id=(a->>'id')::uuid;r:=jsonb_build_object('id',a->>'id');
  end if;
 elsif action in('admin.verify','promotion.save','review.moderate','payout.approve') then
  if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;
  if action in('admin.verify','review.moderate','payout.approve') and coalesce(length(a->>'reason'),0)<5 then raise exception 'INVALID_INPUT';end if;
  if action='admin.verify' then update v1.caterers set status=a->>'status',review_note=a->>'reason',version=version+1 where id=(a->>'id')::uuid and version=(a->>'version')::int;if not found then raise exception 'CONFLICT';end if;
  elsif action='promotion.save' then insert into v1.promotions(code,percent,active) values(upper(a->>'code'),(a->>'percent')::int,(a->>'active')::boolean) on conflict(code) do update set percent=excluded.percent,active=excluded.active;
  elsif action='review.moderate' then update v1.reviews set hidden=(a->>'hidden')::boolean where id=(a->>'id')::uuid;
  else
   cid:=(a->>'catererId')::uuid;perform 1 from v1.caterers where id=cid for update;select coalesce(sum(amount-held-paid_out),0) into amt from v1.allocations where caterer_id=cid;
   if amt<=0 then raise exception 'AMOUNT_INVALID';end if;insert into v1.payouts(caterer_id,amount) values(cid,amt) returning id into ident;
   insert into v1.payout_items select ident,id,amount-held-paid_out from v1.allocations where caterer_id=cid and amount-held-paid_out>0;
   update v1.allocations set paid_out=amount-held where caterer_id=cid;insert into v1.outbox(kind,payload,dedupe) values('payout.create',jsonb_build_object('payoutId',ident),ident::text);r:=jsonb_build_object('id',ident);
  end if;
 elsif action='notification.read' then update v1.notifications set read_at=now() where user_id=u and id=(a->>'id')::uuid;
 elsif action='device.register' then insert into v1.devices(user_id,token) values(u,a->>'token') on conflict(token) do update set user_id=u;
 elsif action='invite.accept' then
  select caterer_id into cid from v1.invites where code=a->>'code' and role='staff' and used_by is null for update;if not found then raise exception 'NOT_FOUND';end if;
  insert into v1.staff values(cid,u,'staff') on conflict do nothing;update v1.invites set used_by=u where code=a->>'code';update v1.profiles set role='staff' where id=u and role='customer';
 else raise exception 'INVALID_ACTION';end if;
 insert into v1.audit(actor_id,action,details) values(u,action,jsonb_build_object('id',coalesce(r->>'id',a->>'id'),'requestId',request_id,'reason',coalesce(a->>'reason',a->>'response'),'dateBefore',d.service_date,'dateAfter',a->>'date','versionBefore',d.version,'amount',a->>'amount','status',a->>'status','catererId',coalesce(cid,p.caterer_id),'customerId',s.user_id));
 insert into v1.receipts values(u,request_id,hash,r);return r;
end $$;
create or replace function v1.immutable() returns trigger language plpgsql as $$ begin raise exception 'IMMUTABLE_HISTORY';end $$;
create or replace function v1.snapshot_guard() returns trigger language plpgsql as $$ begin if new.snapshot<>old.snapshot or new.portions<>old.portions then raise exception 'IMMUTABLE_TERMS';end if;return new;end $$;
create or replace function public.catera_v1_system(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=payload;c v1.checkouts;r jsonb:='{}';rf v1.refunds;ident uuid;oldhash text;amt int;item record;
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if action='payment.attach' then update v1.checkouts set provider_id=a->>'providerId',payment_url=a->>'url' where id=(a->>'id')::uuid and state='pending' and provider_id is null;
 elsif action='payment.lookup' then return (select to_jsonb(ch) from v1.checkouts ch where id=(a->>'id')::uuid);
 elsif action='payment.event' then
  select * into c from v1.checkouts where id=(a->>'checkoutId')::uuid;perform pg_advisory_xact_lock(hashtext(c.user_id::text));select * into c from v1.checkouts where id=(a->>'checkoutId')::uuid for update;if not found then raise exception 'NOT_FOUND';end if;
  select payload_hash into oldhash from v1.payment_events where id=a->>'eventId';if found then if oldhash<>md5(a::text) then raise exception 'CONFLICT';end if;return jsonb_build_object('duplicate',true);end if;
  if a->>'currency' is distinct from 'IDR' or (a->>'amount')::int is distinct from (c.quote->>'total')::int or a->>'providerId' is distinct from c.provider_id then raise exception 'AMOUNT_INVALID';end if;
  insert into v1.payment_events(id,checkout_id,payload_hash) values(a->>'eventId',c.id,md5(a::text));
  if a->>'status'='paid' then
   insert into v1.payments(checkout_id,provider_id,amount,state) values(c.id,a->>'paymentRequestId',(a->>'amount')::int,'paid') on conflict(checkout_id) do update set state='paid';ident:=v1.activate(c.id);r:=jsonb_build_object('subscriptionId',ident);
  elsif c.subscription_id is null and c.state='pending' then update v1.checkouts set state=case when a->>'status'='expired' then 'expired' else 'failed' end where id=c.id;update v1.reservations set state='released' where checkout_id=c.id;end if;
 elsif action='refund.lookup' then return (select to_jsonb(f)||jsonb_build_object('payment',(select to_jsonb(p) from v1.payments p where checkout_id=f.checkout_id)) from v1.refunds f where id=(a->>'id')::uuid);
 elsif action='refund.update' then
  select * into rf from v1.refunds where id=(a->>'id')::uuid for update;if not found then raise exception 'NOT_FOUND';end if;
  if rf.state='succeeded' then return jsonb_build_object('duplicate',true);end if;
  update v1.refunds set state=a->>'state',provider_id=a->>'providerId' where id=rf.id;
  if a->>'state'='succeeded' then
   select * into c from v1.checkouts where id=rf.checkout_id for update;select coalesce(sum(amount),0) into amt from v1.refunds where checkout_id=c.id and state='succeeded';
   update v1.checkouts set state=case when amt=(c.quote->>'total')::int then 'refunded' else 'partially_refunded' end where id=c.id;
   -- Provider splits require independent reversal: keep seller funds held for reconciliation.
   insert into v1.outbox(kind,payload,dedupe) values('split.reconcile',jsonb_build_object('refundId',rf.id,'checkoutId',c.id),'reconcile-'||rf.id) on conflict do nothing;
   perform v1.notify(c.user_id,'refund','Pengembalian dana sudah diproses.','/support');
  end if;
 elsif action='payout.lookup' then return (select to_jsonb(p) from v1.payouts p where id=(a->>'id')::uuid);
 elsif action='payout.update' then update v1.payouts set status=a->>'status',provider_id=a->>'providerId' where id=(a->>'id')::uuid;
 elsif action='push.ticket' then insert into v1.push_tickets(id,token,job_id) values(a->>'id',a->>'token',(a->>'jobId')::uuid) on conflict do nothing;
 elsif action='push.receipts' then return coalesce((select jsonb_agg(to_jsonb(t)) from (select * from v1.push_tickets where checked_at is null and created_at<now()-interval '15 minutes' order by created_at limit 100)t),'[]');
 elsif action='push.checked' then update v1.push_tickets set checked_at=now() where id=a->>'id';if coalesce((a->>'remove')::boolean,false) then delete from v1.devices where token=(select token from v1.push_tickets where id=a->>'id');end if;
 elsif action='devices' then return coalesce((select jsonb_agg(token) from v1.devices where user_id=(a->>'userId')::uuid),'[]');
 elsif action='device.remove' then delete from v1.devices where token=a->>'token';
 elsif action='outbox.claim' then
  return coalesce((with jobs as(select id from v1.outbox where processed_at is null and available_at<=clock_timestamp() order by available_at for update skip locked limit 20),claimed as(update v1.outbox set attempts=attempts+1,available_at=clock_timestamp()+interval '5 minutes' where id in(select id from jobs) returning *) select jsonb_agg(to_jsonb(claimed)) from claimed),'[]');
 elsif action='outbox.complete' then update v1.outbox set processed_at=now() where id=(a->>'id')::uuid;
 elsif action='outbox.retry' then update v1.outbox set last_error=left(a->>'error',150),available_at=now()+least(attempts,60)*interval '1 minute' where id=(a->>'id')::uuid;
 elsif action='maintenance' then
  update v1.checkouts set state='expired' where state='pending' and expires_at<=clock_timestamp();update v1.reservations r set state='released' from v1.checkouts expired where expired.id=r.checkout_id and expired.state='expired' and r.state='held';
  for item in select d.id,d.service_date,s.user_id,s.id sid from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where d.service_date=current_date+1 and d.status='scheduled' loop
   if not exists(select 1 from v1.outbox where dedupe='tomorrow-'||item.id) then perform v1.notify(item.user_id,'tomorrow','Besok ada makanan untuk Anda. Periksa menu dan alamatnya.','/deliveries/'||item.id);insert into v1.outbox(kind,payload,dedupe,processed_at) values('reminder.record','{}','tomorrow-'||item.id,now());end if;
  end loop;
  for item in select s.id,s.user_id from v1.subscriptions s where s.status='active' and (select count(*) from v1.delivery_days d where d.subscription_id=s.id and d.status not in('delivered','cancelled'))<=2 loop
   if not exists(select 1 from v1.outbox where dedupe='renew-'||item.id) then perform v1.notify(item.user_id,'renewal','Paket hampir selesai. Pilih makanan untuk hari-hari berikutnya.','/subscriptions/'||item.id);insert into v1.outbox(kind,payload,dedupe,processed_at) values('reminder.record','{}','renew-'||item.id,now());end if;
  end loop;
 elsif action='health' then return jsonb_build_object('failedJobs',(select count(*) from v1.outbox where processed_at is null and attempts>=5),'paymentExceptions',(select count(*) from v1.checkouts where state='payment_exception'),'oversold',(select count(*) from (select distinct package_id,service_date from v1.reservations where state<>'released')r where v1.demand(r.package_id,r.service_date)>v1.slots(r.package_id,r.service_date)));
 else raise exception 'INVALID_ACTION';end if;
 insert into v1.audit(action,details) values('system.'||action,jsonb_build_object('id',a->>'id','eventId',a->>'eventId'));return r;
end $$;
revoke all on function public.catera_v1_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.catera_v1_system(text,jsonb) to service_role;

create or replace function public.catera_v1_manifest(version_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare p v1.production;begin select * into p from v1.production where id=version_id;if not found then raise exception 'NOT_FOUND';end if;if not v1.is_staff(auth.uid(),p.caterer_id) then raise exception 'FORBIDDEN';end if;return to_jsonb(p);end $$;
revoke all on function public.catera_v1_manifest(uuid) from public,anon;
grant execute on function public.catera_v1_manifest(uuid) to authenticated;

alter table v1.allocations add column if not exists refund_deducted int not null default 0;
alter table v1.refunds add column if not exists reconciliation jsonb;
create table if not exists v1.push_tickets(id text primary key,token text not null,job_id uuid references v1.outbox,checked_at timestamptz,created_at timestamptz not null default now());
alter table v1.push_tickets enable row level security;
revoke all on v1.push_tickets from public,anon,authenticated;

-- Manual financial reconciliation is an explicit admin decision with provider evidence.
create or replace function public.catera_v1_reconcile(kind text,identifier uuid,details jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r v1.refunds;c v1.checkouts;pay v1.payouts;amt int;prev v1.receipts;h text:=md5(kind||identifier::text||details::text);
begin
 if not v1.is_admin(u) then raise exception 'FORBIDDEN';end if;perform pg_advisory_xact_lock(hashtext(u::text));
 select * into prev from v1.receipts where actor_id=u and receipts.request_id=catera_v1_reconcile.request_id;if found then if prev.hash<>h then raise exception 'CONFLICT';end if;return prev.result;end if;
 if coalesce(length(details->>'reason'),0)<5 or coalesce(length(details->>'reference'),0)<3 then raise exception 'INVALID_INPUT';end if;
 if kind='refund' then
  select * into r from v1.refunds where id=identifier for update;if not found or r.state<>'succeeded' or r.reconciliation is not null then raise exception 'CONFLICT';end if;
  select * into c from v1.checkouts where id=r.checkout_id for update;amt:=(details->>'sellerDeduction')::int;
  if amt is null or amt<0 or amt>r.amount or amt>coalesce((select amount-paid_out from v1.allocations where checkout_id=c.id),0) then raise exception 'AMOUNT_INVALID';end if;
  update v1.allocations set amount=amount-amt,refund_deducted=refund_deducted+amt where checkout_id=c.id;
  update v1.refunds set reconciliation=details||jsonb_build_object('actor',u,'at',now()) where id=r.id;
  if not exists(select 1 from v1.support_cases where checkout_id=c.id and status<>'resolved') and not exists(select 1 from v1.refunds where checkout_id=c.id and state<>'failed' and reconciliation is null) then update v1.allocations set held=0 where checkout_id=c.id;else update v1.allocations set held=least(held,amount-paid_out) where checkout_id=c.id;end if;
  update v1.outbox ob set processed_at=now() where ob.kind='split.reconcile' and payload->>'refundId'=r.id::text;
 elsif kind='payout' then
  select * into pay from v1.payouts where id=identifier for update;if not found or pay.status in('succeeded','failed') then raise exception 'CONFLICT';end if;
  if details->>'status' not in('succeeded','failed') then raise exception 'INVALID_INPUT';end if;
  update v1.payouts set status=details->>'status',provider_id=details->>'reference' where id=identifier;
  if details->>'status'='failed' then update v1.allocations a set paid_out=paid_out-i.amount from v1.payout_items i where i.payout_id=identifier and a.id=i.allocation_id;end if;
  update v1.outbox set processed_at=now() where kind='payout.create' and payload->>'payoutId'=identifier::text;
 else raise exception 'INVALID_INPUT';end if;
 insert into v1.audit(actor_id,action,details) values(u,'reconcile.'||kind,details||jsonb_build_object('id',identifier,'requestId',request_id));
 insert into v1.receipts values(u,request_id,h,jsonb_build_object('id',identifier));return jsonb_build_object('id',identifier);
end $$;
revoke all on function public.catera_v1_reconcile(text,uuid,jsonb,uuid) from public,anon;
grant execute on function public.catera_v1_reconcile(text,uuid,jsonb,uuid) to authenticated;

revoke all on all functions in schema v1 from public,anon,authenticated;
