-- PostgreSQL requires data-modifying CTEs at statement top level.
-- Preserve the atomic SKIP LOCKED lease and service-role guard.
do $migration$
declare definition text; updated text;
begin
 select pg_get_functiondef('public.catera_v1_system_pilot_base(text,jsonb)'::regprocedure) into definition;
 updated:=replace(definition,$old$return coalesce((with jobs as(select id from v1.outbox where processed_at is null and available_at<=clock_timestamp() order by available_at for update skip locked limit 20),claimed as(update v1.outbox set attempts=attempts+1,available_at=clock_timestamp()+interval '5 minutes' where id in(select id from jobs) returning *) select jsonb_agg(to_jsonb(claimed)) from claimed),'[]');$old$,$new$with jobs as(select id from v1.outbox where processed_at is null and available_at<=clock_timestamp() order by available_at for update skip locked limit 20),claimed as(update v1.outbox set attempts=attempts+1,available_at=clock_timestamp()+interval '5 minutes' where id in(select id from jobs) returning *) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into r from claimed;return r;$new$);
 if updated=definition and position($new$with jobs as(select id from v1.outbox where processed_at is null and available_at<=clock_timestamp() order by available_at for update skip locked limit 20),claimed as(update v1.outbox set attempts=attempts+1,available_at=clock_timestamp()+interval '5 minutes' where id in(select id from jobs) returning *) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into r from claimed;return r;$new$ in definition)=0 then raise exception 'Expected outbox claim missing';end if;
 execute updated;
end $migration$;
