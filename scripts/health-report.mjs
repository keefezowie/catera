import pg from "pg";
if (!process.env.DATABASE_URL)
  throw Error("DATABASE_URL is required in a private operator environment.");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows } = await db.query(`select
 (select count(*) from (select distinct d.business_id,d.service_date,d.slot_id from public.deliveries d where d.cutoff_at<clock_timestamp()-interval '5 minutes' and not exists(select 1 from public.production_versions p where (p.business_id,p.service_date,p.slot_id)=(d.business_id,d.service_date,d.slot_id))) x)::int as overdue_freezes,
 (select count(*) from public.deliveries where status='failed')::int as unresolved_failures,
 (select count(*) from (select distinct on(business_id,service_date,slot_id) incomplete from public.production_versions order by business_id,service_date,slot_id,revision desc) p where incomplete>0)::int as incomplete_production,
 (select checked_at from public.health_checks order by checked_at desc limit 1) as last_integrity_check,
 (select jsonb_array_length(discrepancies) from public.health_checks order by checked_at desc limit 1) as discrepancy_count`);
  const health = rows[0],
    cronExists = (
      await db.query("select to_regclass('cron.job_run_details') as found")
    ).rows[0].found;
  health.failed_jobs_last_day = cronExists
    ? Number(
        (
          await db.query(
            "select count(*) n from cron.job_run_details where status='failed' and start_time>now()-interval '1 day' and jobid in(select jobid from cron.job where jobname like 'catera-%')",
          )
        ).rows[0].n,
      )
    : null;
  health.cron_history_available = !!cronExists;
  console.log(
    JSON.stringify(
      { measured_at: new Date().toISOString(), ...health },
      null,
      2,
    ),
  );
  if (
    !cronExists ||
    health.overdue_freezes ||
    health.unresolved_failures ||
    health.incomplete_production ||
    health.discrepancy_count ||
    health.failed_jobs_last_day ||
    !health.last_integrity_check ||
    Date.now() - new Date(health.last_integrity_check).getTime() >
      30 * 60 * 1000
  )
    process.exitCode = 2;
} finally {
  await db.end();
}
