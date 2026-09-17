-- Additive synthetic scenarios for hosted Catera V1 (ygzfdqrljunngfrdygzt).
-- Run unchanged for commit; replace final COMMIT with ROLLBACK for validation.
-- No account creation, provider requests, notifications, or existing-row updates.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$
declare
 batch constant text := 'live-scenarios-20260917-v1';
 today date := (now() at time zone 'Asia/Jakarta')::date;
 p v1.packages; o jsonb; ad jsonb; q jsonb; ds date[]; dt date;
 uid uuid; adid uuid; coid uuid; sid uuid; aid uuid; did uuid; conv uuid; ownerid uuid;
 n int := 0; j int; k int; qty int; days int; startday date; st text; src text;
 subtotal int; discount int; pct int; net int; fee int; rate int; servicefee int;
 trial boolean; created timestamptz; t record; lost bigint; jobs bigint;
 names text[] := array['Nadia Putri','Rizky Maulana','Sari Wulandari','Arif Nugroho','Dewi Anggraini','Fajar Ramadhan','Ratna Puspita','Bayu Saputra','Maya Kusuma','Dian Pratama','Rina Kurnia','Taufik Hidayat','Laras Permata','Andi Setiawan','Wulan Safitri','Yoga Pranata','Nina Kartika','Reza Firmansyah','Putri Handayani','Agus Santoso','Vina Maharani','Doni Wijaya','Sekar Lestari','Ilham Fauzi','Tika Ananda','Hadi Gunawan','Anisa Rahma','Rangga Prakoso','Niken Sari','Dedi Irawan','Cahya Pertiwi','Bagas Wicaksono','Melati Utami','Yusuf Hakim','Rani Oktavia','Indra Permana'];
begin
 perform pg_advisory_xact_lock(hashtext(batch));
 if exists(select 1 from v1.audit where action='demo.scenarios.add' and details->>'batch'=batch) then return; end if;
 if not exists(select 1 from v1.policies where approved and synthetic)
 or not exists(select 1 from v1.purchase_features where id and not automatic_payouts)
 or exists(select 1 from v1.settlement_policies where enabled or not synthetic)
 then raise exception 'Requires synthetic policy and disabled payouts';end if;
 if (select count(*) from v1.packages where id::text like 'c9160002-%' and status='published' and offer->>'menuSelectionMode'='caterer')<>6
 then raise exception 'Unexpected catalog';end if;
 -- Capture hashes only, so every original row can be checked without exporting personal data.
 create temporary table scenario_before(table_name text, row_hash text) on commit drop;
 for t in select table_name from information_schema.tables where table_schema='v1' and table_type='BASE TABLE' loop
  execute format('insert into scenario_before select %L,md5(to_jsonb(x)::text) from v1.%I x',t.table_name,t.table_name);
 end loop;
 select count(*) into jobs from v1.outbox;
 select service_fee into servicefee from v1.policies where id;
 for p in select * from v1.packages where id::text like 'c9160002-%' and status='published' and offer->>'menuSelectionMode'='caterer' order by id loop
  perform 1 from v1.packages where id=p.id for update;
  o:=v1.offer(p);
  select user_id into strict ownerid from v1.staff where caterer_id=p.caterer_id and role='owner';
  for k in 1..6 loop
   n:=n+1;uid:=gen_random_uuid();adid:=gen_random_uuid();coid:=gen_random_uuid();sid:=gen_random_uuid();aid:=gen_random_uuid();
   qty:=case k when 1 then 1 when 2 then 2 when 3 then 3 when 4 then 5 when 5 then 2 else 1 end;
   trial:=k=6;days:=case when trial then 1 else (o->>'days')::int end;
   startday:=today+case k when 1 then -14 when 2 then -2 when 3 then -1 when 4 then 0 when 5 then 4 else 8 end;
   select array_agg(x.d order by x.d) into ds from (select d::date d from generate_series(startday,startday+30,interval '1 day') d where o->'weekdays' @> to_jsonb(array[extract(dow from d)::int]) order by d limit days)x;
   if cardinality(ds)<>days then raise exception 'Invalid schedule';end if;
   created:=least((ds[1]-2+time '09:00') at time zone 'Asia/Jakarta',now()-interval '2 hours');
   src:=case when k%3=0 then 'invited' else 'marketplace' end;
   select case when src='invited' then invited_percent else marketplace_percent end into rate from v1.policies where id;
   subtotal:=(case when trial then o->>'trialPrice' else o->>'price' end)::int*qty*days;
   select case when trial then 0 else coalesce(max((x->>'percent')::int),0) end into pct from jsonb_array_elements(o->'tiers') x where (x->>'min')::int<=qty;
   discount:=round(subtotal*pct/100.0);net:=subtotal-discount;fee:=round(net*rate/100.0);
   insert into v1.profiles(id,name,role) values(uid,'SAMPLE - '||names[n],'customer');
   insert into v1.addresses(id,user_id,label,line,area,city,instructions)
   values(adid,uid,case when qty>=3 then 'Kantor contoh' else 'Rumah contoh' end,'Alamat simulasi '||n||' (bukan tujuan pengantaran nyata)',o->'areas'->>0,case when o->'areas'->>0='Bandung' then 'Bandung' else 'Jakarta' end,'DATA CONTOH. '||case when qty>=3 then 'Titip di resepsionis lantai dasar; kemasan diberi nama penerima.' else 'Sambal terpisah; konfirmasi lewat pesan saat tiba.' end);
   select to_jsonb(a)-'user_id' into ad from v1.addresses a where id=adid;
   insert into v1.relationships values(uid,p.caterer_id,src);
   if src='invited' then insert into v1.invites(caterer_id,code,role,used_by) values(p.caterer_id,'SAMPLE-20260917-'||n,'customer',uid);end if;
   q:=jsonb_build_object('mockBatch',batch,'synthetic',true,'pricingVersion',2,'currency','IDR','packageId',p.id,'portions',qty,'trial',trial,'cycles',1,'daysPerCycle',(o->>'days')::int,'deliveryDays',days,'dates',to_jsonb(ds),'bookingThrough',ds[1]+366,'bookingPolicyVersion',1,'durationPricing',v1.duration_pricing(p.id),'durationOption','{"cycles":1,"discountPercent":0}'::jsonb,'subtotal',subtotal,'discount',discount,'discountPercent',pct,'durationDiscount',0,'durationDiscountPercent',0,'packageNet',net,'promotion',0,'promotionSnapshot',null,'serviceFee',servicefee,'total',net+servicefee,'sellerFee',fee,'sellerFeePercent',rate,'sellerNet',net-fee,'perDay',round(net::numeric/qty/days),'source',src,'offer',o,'address',ad,'pricingPolicy',jsonb_build_object('approved',true,'synthetic',true,'serviceFee',servicefee,'marketplacePercent',8,'invitedPercent',3),'settlementModel','delivery_earned_v1','settlementRounding','original_schedule_first_remainder','settlementPolicy',jsonb_build_object('synthetic',true,'schedule','weekly_monday_0900_Asia_Jakarta'),'renewedFrom',null);
   insert into v1.checkouts(id,user_id,package_id,address_id,quote,state,expires_at,provider_id,created_at) values(coid,uid,p.id,adid,q,'paid',created+interval '15 minutes','sample-order-'||coid,created);
   insert into v1.subscriptions(id,checkout_id,user_id,package_id,snapshot,portions,starts_on,ends_on,status) values(sid,coid,uid,p.id,q,qty,ds[1],ds[days],case when ds[days]<today then 'completed' else 'active' end);
   update v1.checkouts set subscription_id=sid where id=coid;
   insert into v1.payments(checkout_id,provider_id,amount,state,created_at) values(coid,'sample-payment-'||coid,net+servicefee,'paid',created+interval '3 minutes');
   insert into v1.allocations(id,checkout_id,caterer_id,amount) values(aid,coid,p.caterer_id,net-fee);
   for j in 1..days loop
    dt:=ds[j];did:=gen_random_uuid();
    st:=case when dt<today then 'delivered' when dt>today then 'scheduled' when k=2 then 'out_for_delivery' when k=3 then 'issue' else 'preparing' end;
    insert into v1.reservations values(coid,p.id,dt,qty,'confirmed');
    insert into v1.delivery_days(id,subscription_id,service_date,address) values(did,sid,dt,ad);
    insert into v1.fulfillments(day_id,meal,status) select did,m->>'meal',st from jsonb_array_elements(o->'menus') m;
    insert into v1.settlement_day_allocations values(did,aid,j,(net-fee)/days+case when j<=(net-fee)%days then 1 else 0 end);
    update v1.delivery_days set status=st where id=did;
   end loop;
   -- Synthetic conversation history, explicitly labelled; no notification command is called.
   conv:=gen_random_uuid();
   insert into v1.conversations(id,customer_id,caterer_id) values(conv,uid,p.caterer_id);
   insert into v1.messages(conversation_id,sender_id,body,created_at) values
    (conv,uid,'[DATA CONTOH] '||case when qty>=3 then 'Untuk pesanan kantor, mohon kemasan diberi nama dan sambal dipisah.' else 'Mohon sambal dipisah. Penerima ada di rumah saat jadwal antar.' end,created+interval '10 minutes'),
    (conv,ownerid,'[DATA CONTOH] Baik, catatan sudah masuk ke dapur. Pengantaran mengikuti jadwal paket.',created+interval '15 minutes'),
    (conv,uid,'[DATA CONTOH] Terima kasih, alamat dan jumlah porsi sudah sesuai.',created+interval '20 minutes');
   if k in(3,4) then
    select id into did from v1.delivery_days where subscription_id=sid order by abs(service_date-today),service_date limit 1;
    insert into v1.support_cases(user_id,caterer_id,delivery_id,subscription_id,checkout_id,subject,description,status,resolution,created_at)
    values(uid,p.caterer_id,did,sid,coid,'[SAMPLE] '||case when k=3 then 'Kurir membutuhkan petunjuk lokasi' else 'Permintaan kemasan terpisah' end,'Data simulasi: '||case when k=3 then 'Pintu masuk utama ditutup. Mohon gunakan pintu samping dan perbarui status pengantaran.' else 'Tiga penerima makan pada jam berbeda; mohon lauk dan sambal dikemas terpisah.' end,
    case when k=3 then case when ((n-1)/6)%2=0 then 'escalated' else 'open' end else case when ((n-1)/6)%2=0 then 'resolved' else 'responded' end end,
    case when k=4 then 'Dapur mengonfirmasi setiap porsi dikemas terpisah tanpa biaya tambahan.' end,now()-interval '1 hour');
   end if;
   if k=6 then
    -- Terminal abandoned attempt, no capacity hold or charge.
    insert into v1.checkouts(user_id,package_id,address_id,quote,state,expires_at,provider_id,created_at) values(uid,p.id,adid,q,case when n%4=0 then 'failed' else 'expired' end,created-interval '1 hour','sample-abandoned-'||coid,created-interval '2 hours');
   end if;
  end loop;
 end loop;
 -- All original rows must still exist with exactly the same values.
 for t in select distinct table_name from scenario_before loop
  execute format('select count(*) from (select row_hash from scenario_before where table_name=%L except all select md5(to_jsonb(x)::text) from v1.%I x) z',t.table_name,t.table_name) into lost;
  if lost<>0 then raise exception 'Changed original rows in %',t.table_name;end if;
 end loop;
 if jobs<>(select count(*) from v1.outbox) then raise exception 'External jobs created';end if;
 if exists(select 1 from v1.reservations r join v1.packages pkg on pkg.id=r.package_id left join v1.capacity c on c.package_id=pkg.id and c.service_date=r.service_date where r.state<>'released' group by pkg.id,r.service_date,c.slots,c.closed having sum(r.portions)>case when c.closed then 0 else coalesce(c.slots,(pkg.offer->'capacity'->>(extract(dow from r.service_date)::int)::text)::int,0) end) then raise exception 'Capacity exceeded';end if;
 if exists(select 1 from v1.allocations a join v1.checkouts c on c.id=a.checkout_id where c.quote->>'mockBatch'=batch and a.amount<>(select sum(amount) from v1.settlement_day_allocations where allocation_id=a.id)) then raise exception 'Settlement mismatch';end if;
 if exists(select 1 from v1.subscriptions s where s.snapshot->>'mockBatch'=batch and (s.snapshot is distinct from (select quote from v1.checkouts where id=s.checkout_id) or (select count(*) from v1.delivery_days where subscription_id=s.id)<>(s.snapshot->>'deliveryDays')::int)) then raise exception 'Snapshot or schedule mismatch';end if;
 if exists(select 1 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.snapshot->>'mockBatch'=batch and d.status='delivered' and not exists(select 1 from v1.settlement_entries where day_id=d.id and kind='earned')) then raise exception 'Missing earned settlement';end if;
 insert into v1.audit(actor_id,action,details) select id,'demo.scenarios.add',jsonb_build_object('batch',batch,'anchor',today,'synthetic',true,'customers',n,'subscriptions',n,'noExternalJobs',true,'originalRowsPreserved',true) from v1.profiles where role='platform_admin' order by id limit 1;
end $$;
select jsonb_build_object('customers',(select count(*) from v1.profiles where name like 'SAMPLE - %'),'checkouts',(select count(*) from v1.checkouts where quote->>'mockBatch'='live-scenarios-20260917-v1'),'subscriptions',(select count(*) from v1.subscriptions where snapshot->>'mockBatch'='live-scenarios-20260917-v1'),'deliveries',(select count(*) from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.snapshot->>'mockBatch'='live-scenarios-20260917-v1'),'conversations',(select count(*) from v1.conversations c join v1.profiles p on p.id=c.customer_id where p.name like 'SAMPLE - %'),'messages',(select count(*) from v1.messages where body like '[DATA CONTOH]%'),'supportCases',(select count(*) from v1.support_cases where subject like '[SAMPLE]%')) as added;
commit;
