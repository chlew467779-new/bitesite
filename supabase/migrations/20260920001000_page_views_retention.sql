-- Retain detailed, IP-bearing analytics logs for 90 days. Aggregated analytics
-- remain in merchant_daily_views and merchant_monthly_views indefinitely.
begin;

do $migration$
declare
  existing_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron must be enabled before scheduling page_views retention';
  end if;

  -- A migration runs once, but remove any manually-created job with this name
  -- so the final schedule is unambiguous and has no duplicate cleanup.
  for existing_job_id in
    select jobid from cron.job where jobname = 'page_views_cleanup_90d'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  -- 03:00 Malaysia Time (19:00 UTC): aggregate first, then prune raw logs.
  perform cron.schedule(
    'page_views_cleanup_90d',
    '0 19 * * *',
    $command$DO $cleanup$
    BEGIN
      PERFORM public.aggregate_daily_views();
      DELETE FROM public.page_views
      WHERE created_at < now() - interval '90 days';
    END
    $cleanup$;$command$
  );

  if not exists (
    select 1 from cron.job
    where jobname = 'page_views_cleanup_90d'
      and schedule = '0 19 * * *'
  ) then
    raise exception 'page_views retention cron job was not registered';
  end if;
end $migration$;

commit;
