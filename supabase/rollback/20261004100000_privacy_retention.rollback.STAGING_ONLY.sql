-- =====================================================================
-- ROLLBACK of 20261004100000_privacy_retention.sql - STAGING ONLY.
-- =====================================================================
-- Stops the nightly deletion of old handled feedback, reports and fixed site errors. Deleted rows
-- do not come back. While this is rolled back, /privacy promises deletions that no longer happen:
-- change the policy text or restore the job.
-- =====================================================================
begin;
do $$
declare
  existing_job_id bigint;
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
  for existing_job_id in select jobid from cron.job where jobname = 'privacy_retention_cleanup' loop
    perform cron.unschedule(existing_job_id);
  end loop;
end $$;
drop function if exists private.privacy_retention_cleanup();
commit;
