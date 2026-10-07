-- Review fix for 20261008113000_caterer_whatsapp.sql (that file stays as committed).
-- The caterer's WhatsApp number is a convenience on the customer's own deliveries. If the
-- role running the read cannot see auth.users (insufficient_privilege) or the table is gone
-- (undefined_table), the customer read must still succeed and simply show no number, rather
-- than failing the whole Beranda/Jadwal read.

create or replace function v1.caterer_whatsapp(cid uuid) returns text language plpgsql stable set search_path='' as $$
declare p text;
begin
 if to_regclass('auth.users') is null then return null;end if;
 begin
  execute 'select u.phone from auth.users u join v1.staff st on st.user_id=u.id
   where st.caterer_id=$1 and st.role=''owner'' and u.phone is not null and u.phone_confirmed_at is not null
   order by u.id limit 1' into p using cid;
 exception when insufficient_privilege or undefined_table then
  return null;
 end;
 p:=regexp_replace(coalesce(p,''),'\D','','g');
 if p like '0%' then p:='62'||substr(p,2);end if;
 p:='+'||p;
 return case when p ~ '^\+62[0-9]{8,13}$' then p end;
end $$;
revoke all on function v1.caterer_whatsapp(uuid) from public, anon, authenticated;
