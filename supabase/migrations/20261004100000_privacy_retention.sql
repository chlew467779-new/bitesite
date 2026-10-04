-- =====================================================================
-- Privacy policy retention (SYNC-071, CH decisions 2026-10-04): what /privacy promises is deleted
-- automatically, every night at 03:30 Malaysia time (19:30 UTC), next to page_views_cleanup_90d.
--
--   site_feedback      status 'done',                    decided_at older than 12 months
--   public_reports     status 'resolved' or 'dismissed', decided_at older than 12 months
--   merchant_feedback  status 'resolved',                last updated more than 12 months ago
--   site_errors        status 'resolved',                resolved_at older than 30 days
--
-- New / unhandled items are never deleted. private.privacy_retention_cleanup() returns how many
-- rows it removed per table; only the cron job (postgres) runs it.
-- =====================================================================
begin;

create or replace function private.privacy_retention_cleanup()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_site_feedback     integer;
  v_public_reports    integer;
  v_merchant_feedback integer;
  v_site_errors       integer;
begin
  delete from public.site_feedback
   where status = 'done' and decided_at < now() - interval '12 months';
  get diagnostics v_site_feedback = row_count;

  delete from public.public_reports
   where status in ('resolved', 'dismissed') and decided_at < now() - interval '12 months';
  get diagnostics v_public_reports = row_count;

  delete from public.merchant_feedback
   where status = 'resolved' and updated_at < now() - interval '12 months';
  get diagnostics v_merchant_feedback = row_count;

  delete from public.site_errors
   where status = 'resolved' and resolved_at < now() - interval '30 days';
  get diagnostics v_site_errors = row_count;

  return jsonb_build_object(
    'site_feedback', v_site_feedback,
    'public_reports', v_public_reports,
    'merchant_feedback', v_merchant_feedback,
    'site_errors', v_site_errors);
end;
$$;
revoke all on function private.privacy_retention_cleanup() from public, anon, authenticated, service_role;

do $migration$
declare
  existing_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron must be enabled before scheduling privacy retention';
  end if;
  for existing_job_id in select jobid from cron.job where jobname = 'privacy_retention_cleanup' loop
    perform cron.unschedule(existing_job_id);
  end loop;
  perform cron.schedule('privacy_retention_cleanup', '30 19 * * *', 'select private.privacy_retention_cleanup();');
  if not exists (select 1 from cron.job where jobname = 'privacy_retention_cleanup' and schedule = '30 19 * * *') then
    raise exception 'privacy retention cron job was not registered';
  end if;
end $migration$;

commit;
