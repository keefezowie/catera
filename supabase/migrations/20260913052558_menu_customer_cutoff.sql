-- Use the customer ordering cutoff for both calendar reads and menu writes.
create or replace function v1.menu_editable(pid uuid,rev int,dt date,meal_name text)
returns boolean language sql stable set search_path='' as $$
 select clock_timestamp() < v1.cutoff(v1.offer(p),dt)
 and not exists (
  select 1 from v1.delivery_days d
  join v1.subscriptions s on s.id=d.subscription_id
  join v1.fulfillments f on f.day_id=d.id
  where s.package_id=pid
   and coalesce((s.snapshot->'offer'->>'contentRevision')::int,0)=rev
   and d.service_date=dt and f.meal=meal_name
   and (f.status='delivered' or
    (d.status<>'cancelled' and clock_timestamp() >= v1.cutoff(s.snapshot->'offer',dt)))
 )
 from v1.packages p where p.id=pid
$$;
