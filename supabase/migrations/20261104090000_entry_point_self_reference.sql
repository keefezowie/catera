-- A renamed entry point whose body still names its parameters with the old function name
-- (catera_v1_command.request_id) fails at run time: "missing FROM-clause entry for table catera_v1_command".
-- 20260920154045_direct_payments.sql renamed the beta_operations wrapper that way, so on a database migrated in
-- version order deliveryIssue.* and attention.choiceHandled failed. Each such body is re-created with its own name.
do $r$
declare f record;
begin
 for f in select p.oid,p.proname,e from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
  unnest(array['catera_v1_command','catera_v1_read','catera_v1_system']) e
  where n.nspname='public' and p.proname<>e and p.prosrc ~ ('\m'||e||'\.')
 loop
  execute replace(pg_get_functiondef(f.oid),f.e||'.',f.proname||'.');
 end loop;
end $r$;
