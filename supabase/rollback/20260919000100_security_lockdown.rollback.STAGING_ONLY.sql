-- =====================================================================
-- 🔴🔴🔴  STAGING ONLY — EMERGENCY ROLLBACK OF THE SECURITY LOCKDOWN  🔴🔴🔴
-- =====================================================================
-- Running this RE-OPENS ANONYMOUS ACCESS: it turns RLS back OFF on 10 tables,
-- gives anon/authenticated full read/WRITE/DELETE/TRUNCATE again, and
-- restores the public "update settings" policy. Anyone holding the public
-- anon key could then modify or delete data.
--
--  * Use on STAGING to get back to the pre-lockdown state for re-testing.
--  * NEVER run on production, except as a documented emergency where the public
--    site is down BECAUSE of the lockdown AND CH has explicitly approved it.
--    Preferred production rollback = redeploy the previous Vercel deployment.
--    If it is ever used on production: fix the cause the same day and re-run
--    the lockdown migration + supabase/tests/lockdown_assertions.sql.
--
-- Safety catch: this script does nothing unless you deliberately change the
-- word NO to yes on the next line.
-- =====================================================================
select set_config('bitesite.confirm_staging_only', 'NO', false);

do $$
begin
  if current_setting('bitesite.confirm_staging_only', true) is distinct from 'yes' then
    raise exception 'ROLLBACK NOT CONFIRMED: this re-opens anonymous write access. Edit the word NO -> yes above only on STAGING (or in an approved emergency).';
  end if;
end $$;

begin;

-- 1) remove the lockdown read policies
drop policy if exists pub_read_merchants       on public.merchants;
drop policy if exists pub_read_categories      on public.categories;
drop policy if exists pub_read_products        on public.products;
drop policy if exists pub_read_merchant_videos on public.merchant_videos;
drop policy if exists pub_read_articles        on public.articles;
drop policy if exists pub_read_merchant_stats  on public.merchant_stats;
drop policy if exists pub_read_settings        on public.settings;

-- 2) restore the original (insecure) settings policies
drop policy if exists "Allow all read settings"   on public.settings;
drop policy if exists "Allow all update settings" on public.settings;
create policy "Allow all read settings"   on public.settings for select to public using (true);
create policy "Allow all update settings" on public.settings for all    to public using (true) with check (true);

-- 3) RLS back to the original state: OFF on 10 tables (events and settings stay ON, as in production before the lockdown)
alter table public.articles                 disable row level security;
alter table public.categories               disable row level security;
alter table public.login_attempts           disable row level security;
alter table public.merchant_daily_views     disable row level security;
alter table public.merchant_monthly_views   disable row level security;
alter table public.merchant_stats           disable row level security;
alter table public.merchant_videos          disable row level security;
alter table public.merchants                disable row level security;
alter table public.page_views               disable row level security;
alter table public.products                 disable row level security;

-- 4) privileges back to the original state
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to PUBLIC, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

commit;
select 'STAGING ROLLBACK APPLIED — anonymous write access is OPEN again' as warning;
