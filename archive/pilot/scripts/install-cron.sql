-- Run as the database owner on hosted Supabase after pg_cron is enabled.
-- Safe to repeat: replace only jobs belonging to Catera.
create extension if not exists pg_cron;
do $$ declare j record; begin
 for j in select jobid from cron.job where jobname in ('catera-freeze','catera-integrity') loop
 perform cron.unschedule(j.jobid);
 end loop;
end $$;
select cron.schedule('catera-freeze','* * * * *','select public.run_due_freezes()');
select cron.schedule('catera-integrity','*/15 * * * *','select public.check_integrity()');
