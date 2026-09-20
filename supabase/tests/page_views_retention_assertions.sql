-- Page-view retention catalog assertions.
-- Read-only and safe to run on staging and production after 20260920001000.

do $$
declare
  job_command text;
begin
  select command
    into job_command
    from cron.job
   where jobname = 'page_views_cleanup_90d'
     and schedule = '0 19 * * *';

  if not found then
    raise exception 'PAGE VIEWS RETENTION ASSERTIONS FAILED: cleanup cron job is missing or has the wrong schedule';
  end if;
  if coalesce(job_command, '') not like '%aggregate_daily_views%' or coalesce(job_command, '') not like '%interval ''90 days''%' then
    raise exception 'PAGE VIEWS RETENTION ASSERTIONS FAILED: cleanup job does not aggregate before applying the 90-day retention window';
  end if;
end $$;

select 'ALL PAGE VIEWS RETENTION ASSERTIONS PASSED' as result;
