export const DEMO_USERS = {
  owner: "10000000-0000-0000-0000-000000000001",
  admin: "10000000-0000-0000-0000-000000000002",
  subscriber: "10000000-0000-0000-0000-000000000003",
};
export const localBootstrap = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $fn$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
`;
export const demoSeed = `
insert into auth.users(id,email) values
('10000000-0000-0000-0000-000000000001','owner@demo.catera.test'),
('10000000-0000-0000-0000-000000000002','admin@demo.catera.test'),
('10000000-0000-0000-0000-000000000003','nadia@demo.catera.test');
do $seed$
declare b uuid; s uuid; dinner uuid; c uuid; p uuid; g uuid; purchase uuid; meal uuid; m2 uuid; m3 uuid;
d uuid; day date:=(now() at time zone 'Asia/Jakarta')::date; k integer; j integer; who uuid; names text[]:=array[
'Nadia Putri','Bima Pratama','Alya Safira','Rizky Hidayat','Dewi Lestari','Aditya Wijaya','Sinta Maharani','Fajar Ramadhan'];
begin
for k in 1..2 loop
insert into public.businesses(slug,name) values(case when k=1 then 'dapur-hijau' else 'rasa-rumah' end,
case when k=1 then 'Dapur Hijau' else 'Rasa Rumah' end) returning id into b;
insert into public.memberships values(b,'10000000-0000-0000-0000-000000000001','owner'),(b,'10000000-0000-0000-0000-000000000003','subscriber');
if k=1 then insert into public.memberships values(b,'10000000-0000-0000-0000-000000000002','admin'); end if;
insert into public.delivery_slots(business_id,name,start_time) values(b,'Makan siang','11:30') returning id into s;
insert into public.delivery_slots(business_id,name,start_time) values(b,'Makan malam','17:30') returning id into dinner;
insert into public.packages(business_id,name,deliveries,validity_days) values(b,'Paket Seimbang',26,45) returning id into p;
insert into public.packages(business_id,name,deliveries,validity_days) values(b,'Paket Coba',5,null),(b,'Paket Mingguan',10,14);
insert into public.menus(business_id,name,description) values(b,'Ayam panggang kemangi','Nasi merah, ayam panggang, tumis buncis, dan sambal terpisah.') returning id into meal;
insert into public.menus(business_id,name,description) values(b,'Dori sambal matah','Nasi putih, dori panggang, sayuran, dan sambal matah terpisah.') returning id into m2;
insert into public.menus(business_id,name,description) values(b,'Tempe teriyaki','Nasi merah, tempe teriyaki, brokoli, dan wortel.') returning id into m3;
for j in 0..14 loop
insert into public.menu_offerings values(b,day+j,s,meal,true),(b,day+j,s,m2,false),(b,day+j,s,m3,false),
(b,day+j,dinner,m2,true),(b,day+j,dinner,m3,false);
end loop;
for j in 1..8 loop
who:=case when j=1 then '10000000-0000-0000-0000-000000000003'::uuid else null end;
insert into public.customers(business_id,user_id,name,email,phone,address)
values(b,who,names[j],case when j=1 then 'nadia@demo.catera.test' else 'customer'||j||'@demo.catera.test' end,
'08000000'||j,jsonb_build_object('line','Jl. Contoh No. '||j||', Kebayoran Baru','city','Jakarta Selatan','instructions',case when j=1 then 'Titip di resepsionis. Sambal terpisah.' else 'Data alamat sintetis.' end)) returning id into c;
insert into public.purchases(business_id,customer_id,package_id,terms,external_reference,starts_on)
values(b,c,p,jsonb_build_object('name','Paket Seimbang','deliveries',26,'validity_days',45),'DEMO-'||j,day-7) returning id into purchase;
insert into public.quota_grants(business_id,customer_id,purchase_id,starts_on,expires_on) values(b,c,purchase,day-7,day+37) returning id into g;
insert into public.quota_ledger(business_id,grant_id,amount,kind) values(b,g,26,'grant');
insert into public.deliveries(business_id,customer_id,grant_id,service_date,slot_id,menu_id,menu_name,selection_source,address,cutoff_at)
select b,c,g,day,s,case when j<7 then meal else null end,case when j<7 then 'Ayam panggang kemangi' else null end,
case when j<7 then 'selected' else null end,address,catera.cutoff_for(b,day) from public.customers where id=c returning id into d;
insert into public.quota_reservations values(b,d,g);
insert into public.delivery_events(business_id,delivery_id,kind) values(b,d,'scheduled');
insert into public.deliveries(business_id,customer_id,grant_id,service_date,slot_id,menu_id,menu_name,selection_source,address,cutoff_at)
select b,c,g,day+1,s,case when j%2=0 then m2 else null end,case when j%2=0 then 'Dori sambal matah' else null end,
case when j%2=0 then 'selected' else null end,address,catera.cutoff_for(b,day+1) from public.customers where id=c returning id into d;
insert into public.quota_reservations values(b,d,g);
insert into public.delivery_events(business_id,delivery_id,kind) values(b,d,'scheduled');
end loop;
perform catera.ensure_freeze(b,day,s);
end loop;
end $seed$;
insert into public.deliveries(business_id,customer_id,grant_id,service_date,slot_id,address,cutoff_at)
select business_id,customer_id,grant_id,service_date+1,slot_id,address,catera.cutoff_for(business_id,service_date+1)
from public.deliveries where service_date=(now() at time zone 'Asia/Jakarta')::date+1;
insert into public.quota_reservations(business_id,delivery_id,grant_id)
select business_id,id,grant_id from public.deliveries d where not exists(select 1 from public.quota_reservations r where r.delivery_id=d.id);
`;
