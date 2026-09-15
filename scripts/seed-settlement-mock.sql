-- Additive, repeat-safe fixture for the explicitly synthetic Demo Dapur Catera.
-- Run with an administrative SQL connection after the earned-settlement migration.
-- No Auth accounts, provider calls, outbox jobs, trigger disabling, or data resets.
begin;
do $$
declare
 batch constant text := 'settlement-demo-20260915';
 cid constant uuid := '7d2d99a7-0683-4a67-a4e2-51f5b0fde8ff';
 pid uuid := gen_random_uuid(); adminid uuid; ownerid uuid; polid uuid;
 uid uuid; adid uuid; coid uuid; sid uuid; aid uuid; did uuid; runid uuid; payoutid uuid;
 src v1.packages; o jsonb; ad jsonb; q jsonb; ds date[]; dt date; n int; j int;
 oldquotes text; oldsnapshots text; jobs bigint;
begin
 perform pg_advisory_xact_lock(hashtext(batch));
 if exists(select 1 from v1.audit where action='mock.settlement.seed' and details->>'batch'=batch) then return;end if;
 if not exists(select 1 from v1.caterers where id=cid and slug='catera-demo-workspace')
 or not exists(select 1 from v1.policies where synthetic and approved)
 or not exists(select 1 from v1.purchase_features where id and not automatic_payouts)
 or exists(select 1 from v1.settlement_policies where caterer_id=cid and (enabled or not synthetic))
 then raise exception 'Mock seed requires the synthetic demo workspace and disabled payouts';end if;
 select id into strict adminid from v1.profiles where name='Demo Admin' and role='platform_admin';
 select id into strict ownerid from v1.profiles where name='Demo Pemilik' and role='owner';
 if not v1.is_staff(ownerid,cid,true) then raise exception 'Unexpected demo owner';end if;
 select md5(string_agg(id::text||quote::text,'|' order by id)) into oldquotes from v1.checkouts;
 select md5(string_agg(id::text||snapshot::text,'|' order by id)) into oldsnapshots from v1.subscriptions;
 select count(*) into jobs from v1.outbox;
 select * into strict src from v1.packages where id='d4000000-0000-4000-8000-000000000001' and caterer_id=cid;
 -- Keep the fixture package out of public discovery. Snapshot records the simulated published terms.
 insert into v1.packages(id,caterer_id,slug,offer,status)
 values(pid,cid,'mock-settlement-20260915',src.offer||jsonb_build_object('name','MOCK - Paket 3 Periode','description','Data sintetis untuk demonstrasi pendapatan. Bukan pesanan nyata.','price',35000,'days',5,'tiers','[]'::jsonb,'menuSelectionMode','caterer'),'draft');
 insert into v1.content_revisions(package_id,revision,contents)
 select pid,revision,contents from v1.content_revisions where package_id=src.id;
 insert into v1.package_duration_revisions(package_id,revision,options,created_by)
 values(pid,1,'[{"cycles":1,"discountPercent":0},{"cycles":3,"discountPercent":5}]',ownerid);
 select v1.offer(p)||jsonb_build_object('status','published') into o from v1.packages p where id=pid;
 if not v1.valid_offer(o) then raise exception 'Invalid mock package';end if;
 insert into v1.settlement_policies(caterer_id,enabled,synthetic,actor_id,reason)
 values(cid,false,true,adminid,'MOCK settlement demonstration; no transfers authorized') returning id into polid;
 -- Five completed weekdays through today, then ten upcoming weekdays.
 select array_agg(x.d order by x.d) into ds from
 (select d::date d from generate_series((current_timestamp at time zone 'Asia/Jakarta')::date-14,(current_timestamp at time zone 'Asia/Jakarta')::date,interval '1 day') d where extract(isodow from d)<=5 order by d desc limit 5)x;
 select ds||array_agg(x.d order by x.d) into ds from
 (select d::date d from generate_series((current_timestamp at time zone 'Asia/Jakarta')::date+1,(current_timestamp at time zone 'Asia/Jakarta')::date+21,interval '1 day') d where extract(isodow from d)<=5 order by d limit 10)x;
 for n in 1..3 loop
  uid:=gen_random_uuid();coid:=gen_random_uuid();sid:=gen_random_uuid();aid:=gen_random_uuid();
  insert into v1.profiles(id,name,role) values(uid,'MOCK - '||case n when 1 then 'Saldo tersedia' when 2 then 'Dana ditahan' else 'Pencairan simulasi' end,'customer');
  insert into v1.addresses(user_id,label,line,area,city,instructions)
  values(uid,'MOCK','Alamat fiktif - jangan dikirim','Jakarta Selatan','Jakarta','Data sintetis. Tidak ada pengiriman nyata.') returning id,to_jsonb(addresses)-'user_id' into adid,ad;
  q:=jsonb_build_object('mock',true,'mockBatch',batch,'pricingVersion',2,'currency','IDR','packageId',pid,'portions',2,'trial',false,'cycles',3,'daysPerCycle',5,'deliveryDays',15,'dates',to_jsonb(ds),'bookingThrough',ds[1]+366,'bookingPolicyVersion',1,'durationPricing',o->'durationPricing','durationOption','{"cycles":3,"discountPercent":5}'::jsonb,'subtotal',1050000,'discount',0,'discountPercent',0,'durationDiscount',52500,'durationDiscountPercent',5,'packageNet',997500,'promotion',0,'promotionSnapshot',null,'serviceFee',2500,'total',1000000,'sellerFee',79800,'sellerFeePercent',8,'sellerNet',917700,'perDay',33250,'source','marketplace','offer',o,'address',ad,'pricingPolicy',jsonb_build_object('approved',true,'synthetic',true,'serviceFee',2500,'marketplacePercent',8,'invitedPercent',3),'settlementModel','delivery_earned_v1','settlementRounding','original_schedule_first_remainder','renewedFrom',null,'settlementPolicy',jsonb_build_object('id',polid,'synthetic',true,'schedule','weekly_monday_0900_Asia_Jakarta'));
  insert into v1.checkouts(id,user_id,package_id,address_id,quote,state,expires_at,provider_id,created_at)
  values(coid,uid,pid,adid,q,'paid',(ds[1]-1)::timestamp at time zone 'Asia/Jakarta','mock-'||coid,(ds[1]-2)::timestamp at time zone 'Asia/Jakarta');
  insert into v1.subscriptions(id,checkout_id,user_id,package_id,snapshot,portions,starts_on,ends_on,status)
  values(sid,coid,uid,pid,q,2,ds[1],ds[15],'active');
  update v1.checkouts set subscription_id=sid where id=coid;
  insert into v1.payments(checkout_id,provider_id,amount,state,created_at) values(coid,'mock-'||coid,1000000,'paid',(ds[1]-2)::timestamp at time zone 'Asia/Jakarta');
  insert into v1.allocations(id,checkout_id,caterer_id,amount,held,paid_out) values(aid,coid,cid,917700,case when n=2 then 305900 else 0 end,case when n=3 then 200000 else 0 end);
  for j in 1..15 loop
   dt:=ds[j];did:=gen_random_uuid();
   insert into v1.reservations values(coid,pid,dt,2,'confirmed');
   insert into v1.delivery_days(id,subscription_id,service_date,address) values(did,sid,dt,ad);
   insert into v1.fulfillments(day_id,meal) values(did,'lunch');
   insert into v1.settlement_day_allocations values(did,aid,j,61180);
   if j<=5 then
    update v1.fulfillments set status='delivered' where day_id=did;
    update v1.delivery_days set status='delivered' where id=did;
   end if;
  end loop;
  if n=3 then
   -- Terminal synthetic history only: never create a dispatchable payout or recipient.
   insert into v1.settlement_runs(caterer_id,policy_id,cutoff_at) values(cid,polid,v1.settlement_cutoff(now())) returning id into runid;
   insert into v1.payouts(caterer_id,amount,status,provider_id,settlement_run_id) values(cid,200000,'succeeded','mock-'||batch,runid) returning id into payoutid;
   insert into v1.settlement_payout_items values(payoutid,aid,200000);
   insert into v1.payout_items values(payoutid,aid,200000);
   insert into v1.payout_events(event_key,payout_id,fingerprint,status) values(batch,payoutid,'mock-no-provider-transfer','succeeded');
  end if;
 end loop;
 if oldquotes is distinct from (select md5(string_agg(id::text||quote::text,'|' order by id)) from v1.checkouts where quote->>'mockBatch' is distinct from batch)
 or oldsnapshots is distinct from (select md5(string_agg(id::text||snapshot::text,'|' order by id)) from v1.subscriptions where snapshot->>'mockBatch' is distinct from batch)
 or jobs<>(select count(*) from v1.outbox) then raise exception 'Seed changed historical terms or queued external work';end if;
 insert into v1.audit(actor_id,action,details) values(adminid,'mock.settlement.seed',jsonb_build_object('batch',batch,'packageId',pid,'purchases',3,'deliveries',45,'completedDeliveries',15,'simulatedPayout',200000,'noProviderTransfers',true));
end $$;
select v1.settlement_state('7d2d99a7-0683-4a67-a4e2-51f5b0fde8ff') - 'entries' - 'payouts' as mock_balances;
commit;
