-- =====================================================================
-- BiteSite — SECURITY LOCKDOWN (minimal, branch fix/security-lockdown)
-- =====================================================================
-- Goal: the browser (anon key) can only READ public data. All writes, all
-- analytics/login tables and the counter RPCs become server-only
-- (service_role, used by lib/supabase-admin.ts).
--
-- Scope (nothing else): no owners/memberships, no admin users, no schema
-- changes to data. `authenticated` gets NO MORE than `anon` (open sign-up is
-- currently enabled in Supabase Auth, so any visitor can become `authenticated`).
--
-- ORDER OF DEPLOYMENT (important, or the admin panel breaks):
--   1) set SUPABASE_SERVICE_ROLE_KEY on the server  2) deploy the new code
--   3) verify site + admin  4) ONLY THEN run this migration.
--
-- This script is ONE TRANSACTION and ends with self-checks: if any check
-- fails it raises an exception and NOTHING is changed.
-- Validate on STAGING first (supabase/staging/*). Production only after CTO
-- review and explicit CH approval.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Row Level Security ON for every public table (idempotent)
-- ---------------------------------------------------------------------
alter table public.articles               enable row level security;
alter table public.categories             enable row level security;
alter table public.events                 enable row level security;
alter table public.login_attempts         enable row level security;
alter table public.merchant_daily_views   enable row level security;
alter table public.merchant_monthly_views enable row level security;
alter table public.merchant_stats         enable row level security;
alter table public.merchant_videos        enable row level security;
alter table public.merchants              enable row level security;
alter table public.page_views             enable row level security;
alter table public.products               enable row level security;
alter table public.settings               enable row level security;

-- ---------------------------------------------------------------------
-- 2) Remove the permissive settings policies (anyone could UPDATE settings)
-- ---------------------------------------------------------------------
drop policy if exists "Allow all update settings" on public.settings;
drop policy if exists "Allow all read settings"   on public.settings;

-- events: the existing "Allow public read" (SELECT, using true) is kept as-is on purpose.

-- ---------------------------------------------------------------------
-- 3) Public READ policies (anon and authenticated identical)
-- ---------------------------------------------------------------------
drop policy if exists pub_read_merchants       on public.merchants;
drop policy if exists pub_read_categories      on public.categories;
drop policy if exists pub_read_products        on public.products;
drop policy if exists pub_read_merchant_videos on public.merchant_videos;
drop policy if exists pub_read_articles        on public.articles;
drop policy if exists pub_read_merchant_stats  on public.merchant_stats;
drop policy if exists pub_read_settings        on public.settings;

create policy pub_read_merchants on public.merchants
  for select to anon, authenticated
  using (is_published = true);

create policy pub_read_categories on public.categories
  for select to anon, authenticated
  using (exists (select 1 from public.merchants m where m.id = categories.merchant_id and m.is_published = true));

create policy pub_read_products on public.products
  for select to anon, authenticated
  using (exists (select 1 from public.merchants m where m.id = products.merchant_id and m.is_published = true));

create policy pub_read_merchant_videos on public.merchant_videos
  for select to anon, authenticated
  using (exists (select 1 from public.merchants m where m.id = merchant_videos.merchant_id and m.is_published = true));

create policy pub_read_articles on public.articles
  for select to anon, authenticated
  using (published = true);

-- view counters are shown on the home / store pages today (hiding them publicly is a later product decision, D-14)
create policy pub_read_merchant_stats on public.merchant_stats
  for select to anon, authenticated
  using (true);

-- only the six keys lib/settings.ts actually reads
create policy pub_read_settings on public.settings
  for select to anon, authenticated
  using (key in ('site_title','site_description','contact_email','contact_phone','whatsapp_number','footer_text'));

-- NO policies at all for: page_views, login_attempts, merchant_daily_views,
-- merchant_monthly_views  ->  RLS default-deny for anon/authenticated.

-- ---------------------------------------------------------------------
-- 4) Table privileges: second layer, independent of RLS
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.merchants, public.categories, public.products, public.merchant_videos,
  public.events, public.articles, public.merchant_stats, public.settings
to anon, authenticated;

-- service_role keeps full access (it is used server-side only)
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------
-- 5) Functions: no direct calls from the browser
--    (they are SECURITY INVOKER, so they also would fail for anon once RLS is on)
-- ---------------------------------------------------------------------
revoke all on all functions in schema public from PUBLIC, anon, authenticated;
grant execute on all functions in schema public to service_role;
-- pg_cron runs aggregate_daily_views() as the job owner (postgres), which is unaffected.

-- ---------------------------------------------------------------------
-- 6) Future objects created by this role must not auto-grant to the browser roles
--    (does not cover objects created by other roles, e.g. supabase_admin)
-- ---------------------------------------------------------------------
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
-- NOTE: Postgres still grants EXECUTE on NEW functions to PUBLIC by default. Any function
-- added later must `revoke execute ... from public, anon, authenticated` explicitly.

-- ---------------------------------------------------------------------
-- 7) Self-check: abort the whole transaction if the result is not what we intend
-- ---------------------------------------------------------------------
do $$
declare
  t   text;
  r   text;
  p   text;
  bad text := '';
begin
  -- 7a) RLS on for every ordinary public table
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    bad := bad || format(' RLS-off:%s', t);
  end loop;

  -- 7b) browser roles have no write privileges on any public table
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
  loop
    foreach r in array array['anon','authenticated'] loop
      foreach p in array array['INSERT','UPDATE','DELETE','TRUNCATE'] loop
        if has_table_privilege(r, format('public.%I', t), p) then
          bad := bad || format(' %s-can-%s:%s', r, p, t);
        end if;
      end loop;
    end loop;
  end loop;

  -- 7c) browser roles cannot execute any public function
  for t in select p2.oid::regprocedure::text from pg_proc p2 join pg_namespace n on n.oid = p2.pronamespace where n.nspname = 'public'
  loop
    foreach r in array array['anon','authenticated'] loop
      if has_function_privilege(r, t::regprocedure, 'EXECUTE') then
        bad := bad || format(' %s-can-execute:%s', r, t);
      end if;
    end loop;
  end loop;

  -- 7d) no policy on any public table allows a write for the browser roles
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and cmd in ('ALL','INSERT','UPDATE','DELETE')
  ) then
    bad := bad || ' write-policy-exists';
  end if;

  -- 7e) service_role must still be able to do its job
  if not has_table_privilege('service_role', 'public.merchants', 'INSERT')
     or not has_function_privilege('service_role', 'public.increment_view_count(text)', 'EXECUTE') then
    bad := bad || ' service_role-lost-access';
  end if;

  if bad <> '' then
    raise exception 'SECURITY LOCKDOWN SELF-CHECK FAILED:%', bad;
  end if;
end $$;

commit;
