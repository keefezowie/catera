-- Explicit synthetic local operating-day fixture. Never applied to Supabase.
do $$ declare u uuid:='00000000-0000-4000-8000-000000000001'; ad uuid:='30000000-0000-4000-8000-000000000005';p v1.packages;o jsonb;q jsonb;ch uuid;sub uuid;day uuid;dt date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 if exists(select 1 from v1.payments where provider_id='demo-operating-fixture') then return;end if;
 insert into v1.addresses(id,user_id,label,line,area,city,instructions) values(ad,u,'Kantor','Gedung Contoh, Jl. Sintetis No. 5','Jakarta Selatan','Jakarta','Data sintetis untuk demonstrasi operasional.');
 select * into p from v1.packages where id='20000000-0000-4000-8000-000000000003';o:=v1.offer(p);q:=jsonb_build_object('packageId',p.id,'portions',2,'trial',true,'dates',jsonb_build_array(dt),'subtotal',138000,'discount',0,'discountPercent',0,'promotion',0,'serviceFee',2500,'total',140500,'perDay',69000,'sellerFee',11040,'source','marketplace','offer',o,'address',(select to_jsonb(a)-'user_id' from v1.addresses a where id=ad));
 insert into v1.checkouts(user_id,package_id,address_id,quote,state,expires_at) values(u,p.id,ad,q,'paid',now()-interval '1 day') returning id into ch;
 insert into v1.subscriptions(checkout_id,user_id,package_id,snapshot,portions,starts_on,ends_on) values(ch,u,p.id,q,2,dt,dt) returning id into sub;
 update v1.checkouts set subscription_id=sub where id=ch;
 insert into v1.reservations values(ch,p.id,dt,2,'confirmed');insert into v1.capacity values(p.id,dt,100,false) on conflict do nothing;
 insert into v1.delivery_days(subscription_id,service_date,address) values(sub,dt,q->'address') returning id into day;insert into v1.fulfillments(day_id,meal) values(day,'lunch'),(day,'dinner');
 insert into v1.relationships values(u,p.caterer_id,'marketplace') on conflict do nothing;insert into v1.payments(checkout_id,provider_id,amount,state) values(ch,'demo-operating-fixture',140500,'paid');insert into v1.allocations(checkout_id,caterer_id,amount) values(ch,p.caterer_id,126960);
 insert into v1.audit(action,details) values('demo.synthetic_fixture',jsonb_build_object('customerId',u,'date',dt));
end $$;
