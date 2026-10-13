-- Every delivery stage change tells the customer (Phase G, FB4), in the kamu register.
--   Dimasak          scheduled -> preparing           "Makan siangmu sedang dimasak di {dapur}"
--   Berangkat        -> out_for_delivery               same body and dedupe as delivery.depart
--   Gagal diantar    -> issue                          "Makan siangmu dari {dapur} gagal diantar." (opens that day)
--   Pindah tanggal   a caterer moves a delivery day   "Katering memindahkan pengantaranmu dari 14 Okt ke 16 Okt."
-- Sampai waiting for confirmation is queued by delivery.arrive (20261014090000), unchanged.
-- The pushes are queued by triggers, so every command that reaches the stage queues them, and a
-- stage repeated or a customer with two packages gets one push: the dedupe is customer, caterer,
-- date, meal and stage, plus the trip. A failed trip that sets out again is a new trip, so the
-- customer hears Berangkat again (and Gagal diantar if it fails again): the trip number is how many
-- Gagal diantar pushes the group already has, and the first trip keeps the bare key delivery.depart
-- uses. A failure while the latest failed trip has not set out again belongs to that trip.
-- A customer without an account is skipped. The web dispatcher sends them
-- right after the command and /api/jobs/push retries what failed.

create function v1.fulfillment_status_push() returns trigger
language plpgsql set search_path='' as $$
declare uid uuid; dt date; cid uuid; cname text; who text; body text; key text; href text:='/today'; tail text; trips int; k int;
begin
 if new.status is not distinct from old.status or new.status not in ('preparing','out_for_delivery','issue') then return new;end if;
 if new.status='preparing' and old.status is distinct from 'scheduled' then return new;end if;
 select s.user_id,d.service_date,p.caterer_id,c.name into uid,dt,cid,cname
  from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id
  join v1.packages p on p.id=s.package_id left join v1.caterers c on c.id=p.caterer_id
  where d.id=new.day_id;
 if uid is null then return new;end if;
 who:=case new.meal when 'lunch' then 'Makan siangmu' else 'Makan malammu' end;
 tail:=uid||':'||cid||':'||dt||':'||new.meal;
 if new.status<>'preparing' then
  select count(*) into trips from v1.outbox where dedupe='failed:'||tail or dedupe like 'failed:'||tail||':%';
 end if;
 if new.status='preparing' then
  body:=who||' sedang dimasak di '||coalesce(cname,'dapur');key:='cooking:'||tail;
 elsif new.status='out_for_delivery' then
  body:=who||' sedang diantar dari '||coalesce(cname,'dapur');key:='depart:'||tail||case when trips>0 then ':'||trips else '' end;
 else
  k:=case when trips>0 and not exists(select 1 from v1.outbox where dedupe='depart:'||tail||':'||trips) then trips-1 else trips end;
  -- delivery.status takes past dates, so the push opens the day it is about.
  body:=who||' dari '||coalesce(cname,'dapur')||' gagal diantar.';key:='failed:'||tail||case when k>0 then ':'||k else '' end;
  href:='/deliveries/'||new.day_id;
 end if;
 perform v1.notify(uid,'delivery',body,href,key);
 return new;
end $$;
create trigger fulfillments_status_push after update of status on v1.fulfillments
 for each row execute function v1.fulfillment_status_push();

-- A caterer moving a customer's day (customer.deliveryChange, delivery.reschedule) tells the customer.
-- A customer moving their own day tells nobody. The version is part of the key, so each move is its own push.
create function v1.delivery_day_moved_push() returns trigger
language plpgsql set search_path='' as $$
declare uid uuid; cid uuid; actor uuid:=auth.uid(); months text[]:=array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
begin
 if new.service_date is not distinct from old.service_date or actor is null then return new;end if;
 select s.user_id,p.caterer_id into uid,cid from v1.subscriptions s join v1.packages p on p.id=s.package_id where s.id=new.subscription_id;
 if uid is null or actor=uid or not v1.is_staff(actor,cid) then return new;end if;
 perform v1.notify(uid,'change',
  'Katering memindahkan pengantaranmu dari '||extract(day from old.service_date)::int||' '||months[extract(month from old.service_date)::int]
  ||' ke '||extract(day from new.service_date)::int||' '||months[extract(month from new.service_date)::int]||'.',
  '/deliveries/'||new.id,'moved:'||new.id||':'||new.version);
 return new;
end $$;
create trigger delivery_days_moved_push after update of service_date on v1.delivery_days
 for each row execute function v1.delivery_day_moved_push();

revoke all on function v1.fulfillment_status_push() from public, anon, authenticated;
revoke all on function v1.delivery_day_moved_push() from public, anon, authenticated;

-- The older generic pushes would now repeat the stage pushes in the "Anda" register, so each command
-- body that holds them is re-created without them: the status notice goes (the triggers cover every
-- stage it announced; delivery.status can no longer close a meal), and a caterer's change notice
-- keeps only the address case (the only other change it makes), reworded, because a date move now sends "Pindah tanggal".
do $$ declare f record; d text; old_status constant text:='perform v1.notify(s.user_id,''delivery'',case when nextstatus=''delivered'' then ''Makanan sudah terkirim. Selamat menikmati!'' else ''Status pengantaran Anda diperbarui.'' end,''/deliveries/''||d.id);';
 old_change constant text:='perform v1.notify(s.user_id,''change'',''Katerer memperbarui pengantaran sesuai permintaan Anda.'',''/deliveries/''||d.id);';
 new_change constant text:='if not (payload ? ''date'') then perform v1.notify(s.user_id,''change'',''Katering mengubah alamat pengantaranmu sesuai permintaanmu.'',''/deliveries/''||d.id);end if;';
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (p.prosrc like '%Status pengantaran Anda diperbarui.%' or p.prosrc like '%Katerer memperbarui pengantaran sesuai permintaan Anda.%')
 loop
  d:=pg_get_functiondef(f.oid);
  d:=replace(replace(d,old_status,'null;'),old_change,new_change);
  if position('Status pengantaran Anda' in d)>0 or position('permintaan Anda' in d)>0 then raise exception 'PUSH_ANCHOR_MISSING';end if;
  execute d;
 end loop;
end $$;
