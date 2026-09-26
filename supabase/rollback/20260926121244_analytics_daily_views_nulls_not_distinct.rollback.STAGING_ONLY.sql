-- =====================================================================
-- ROLLBACK of 20260926121244_analytics_daily_views_nulls_not_distinct.sql — STAGING ONLY.
-- =====================================================================
-- WARNING: this re-opens OQ-AnalyticsNulls. With the old NULLS DISTINCT key,
-- every hourly aggregate run adds another row for buckets with a NULL key
-- column, and Admin analytics over-count again. Prefer a forward fix.
--
-- It only restores the old constraint. It does NOT move archived rows back:
-- they are over-counting duplicates. The archive table is kept (not dropped)
-- so nothing is lost; dropping it needs CH approval.
-- The migration ledger (supabase_migrations.schema_migrations) is left
-- unchanged, as in the other rollbacks.
--
-- Set the switch below to 'yes' deliberately before running.
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

lock table public.merchant_daily_views in access exclusive mode;

alter table public.merchant_daily_views drop constraint merchant_daily_views_bucket_key;

alter table public.merchant_daily_views
  add constraint merchant_daily_views_slug_page_type_view_date_device_type_c_key
  unique (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type);

commit;
