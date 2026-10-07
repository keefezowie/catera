-- Review fix: the daily maintenance renewal reminder (catera_v1_system 'maintenance') checked
-- for its 'renew-'||id key and then inserted it. subscription.remindRenewal
-- (20261008111000_push_report_renewal_dedupe.sql) uses the same key, so if it committed the
-- key between that check and the insert, the insert raised a unique violation and aborted the
-- whole maintenance run (expiring checkouts, tomorrow reminders and all).
-- The record is now claimed first with ON CONFLICT DO NOTHING, and the customer is notified
-- only when this run claimed it. Only that statement changes: the function holding it is
-- rewritten from its own current definition, as 20260917131119_beta_operations.sql does.

do $$
declare f record; def text; changed integer:=0;
 old_text constant text:='if not exists(select 1 from v1.outbox where dedupe=''renew-''||item.id) then perform v1.notify(item.user_id,''renewal'',''Paket hampir selesai. Pilih makanan untuk hari-hari berikutnya.'',''/renew/''||item.id);insert into v1.outbox(kind,payload,dedupe,processed_at) values(''reminder.record'',''{}'',''renew-''||item.id,now());end if;';
 new_text constant text:='insert into v1.outbox(kind,payload,dedupe,processed_at) values(''reminder.record'',''{}'',''renew-''||item.id,now()) on conflict (dedupe) do nothing;if found then perform v1.notify(item.user_id,''renewal'',''Paket hampir selesai. Pilih makanan untuk hari-hari berikutnya.'',''/renew/''||item.id);end if;';
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'catera_v1_system%' and position(old_text in p.prosrc)>0 loop
  def:=replace(pg_get_functiondef(f.oid),old_text,new_text);
  execute def;
  changed:=changed+1;
 end loop;
 if changed=0 and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'catera_v1_system%' and position(new_text in p.prosrc)>0) then
  raise exception 'maintenance renewal reminder not found';
 end if;
end $$;
