-- Customers see their caterer's WhatsApp number (Plan 3a, customer app rebuild).
-- The app's "Chat katering" opens WhatsApp with the caterer. The number is the owner's
-- phone that Supabase Auth verified by SMS when the caterer signed up (auth.users.phone,
-- digits only, no plus sign). There is no separate caterer contact column.
--   * It is shown only on a delivery of a subscription the signed-in user bought, never to
--     staff, admins, signed-out readers or other customers, and never for an unverified phone.
--   * It is read dynamically so a database without auth.users (the local demo) still works
--     and simply shows no number.

create or replace function v1.caterer_whatsapp(cid uuid) returns text language plpgsql stable set search_path='' as $$
declare p text;
begin
 if to_regclass('auth.users') is null then return null;end if;
 execute 'select u.phone from auth.users u join v1.staff st on st.user_id=u.id
  where st.caterer_id=$1 and st.role=''owner'' and u.phone is not null and u.phone_confirmed_at is not null
  order by u.id limit 1' into p using cid;
 p:=regexp_replace(coalesce(p,''),'\D','','g');
 if p like '0%' then p:='62'||substr(p,2);end if;
 p:='+'||p;
 return case when p ~ '^\+62[0-9]{8,13}$' then p end;
end $$;

-- Same definition as 20261008100000_customer_arrival.sql plus the catererPhone key.
create or replace function v1.delivery(d v1.delivery_days) returns jsonb language sql stable set search_path='' as $$
 select v1.delivery_pilot_base(d)||jsonb_build_object('meals',(select jsonb_agg(jsonb_build_object(
 'meal',f.meal,'status',f.status,'departed_at',f.departed_at,'confirmed_at',f.confirmed_at,
 'reaction',(select r.reaction from v1.delivery_reactions r where r.day_id=f.day_id and r.meal=f.meal),
 'issue',(select jsonb_build_object('id',i.id,'status',i.status) from v1.delivery_issues i
  where i.day_id=f.day_id and i.meal=f.meal and i.status in ('open','responded','escalated')
  order by i.created_at desc, i.id desc limit 1)
 ) order by f.meal desc) from v1.fulfillments f where f.day_id=d.id))
 ||jsonb_build_object('catererPhone',case when auth.uid() is not null and s.user_id=auth.uid()
  then v1.caterer_whatsapp((s.snapshot->'offer'->>'catererId')::uuid) end)
 ||case when v1.is_staff(auth.uid(),(s.snapshot->'offer'->>'catererId')::uuid) then jsonb_build_object('customer',jsonb_build_object(
 'id',coalesce(s.user_id,s.customer_record_id),'name',coalesce(cr.name,p.name)), 'customerRecordId',s.customer_record_id) else '{}'::jsonb end
 from v1.subscriptions s left join v1.customer_records cr on cr.id=s.customer_record_id left join v1.profiles p on p.id=s.user_id where s.id=d.subscription_id
$$;

-- The number is not part of what the kitchen produces: it must never count as a production
-- change. Frozen snapshots made before this key existed lack it, so strip it from both sides.
create or replace function v1.beta_production_signature(entries jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(
  case when jsonb_typeof(x->'meals')='array' then jsonb_set(x-'canChange'-'catererPhone','{meals}',
   coalesce((select jsonb_agg(m-'departed_at'-'confirmed_at'-'reaction'-'issue' order by o) from jsonb_array_elements(x->'meals') with ordinality t(m,o)),'[]'))
  else x-'canChange'-'catererPhone' end
  order by x->>'id'),'[]') from jsonb_array_elements(entries)x
$$;
revoke all on all functions in schema v1 from public,anon,authenticated;
