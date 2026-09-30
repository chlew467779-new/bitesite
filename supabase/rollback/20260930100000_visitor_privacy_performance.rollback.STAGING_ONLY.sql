-- =====================================================================
-- ROLLBACK of 20260930100000_visitor_privacy_performance.sql — STAGING ONLY.
-- =====================================================================
-- Drops the performance summary and the "hashed IP / no user agent" constraints. Stored IPs stay
-- hashed: the originals were never kept, so they cannot come back (by design).
-- Roll the application back first (Admin Performance panel, /api/admin/performance).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.admin_performance_summary(integer);
alter table public.page_views drop constraint if exists page_views_ip_hashed;
alter table public.page_views drop constraint if exists page_views_no_user_agent;
drop index if exists public.page_views_created_event_idx;

commit;
