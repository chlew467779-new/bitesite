-- =====================================================================
-- Lockdown ASSERTIONS — read-only catalog checks (no writes, no role switching).
-- Safe to run on staging AND on production after the migration.
-- Returns one row 'ALL LOCKDOWN ASSERTIONS PASSED' or raises an exception naming what is wrong.
-- =====================================================================
do $$
declare
  t text; r text; p text; bad text := '';
  public_read_tables text[] := array['merchants','categories','products','merchant_videos','events','articles','settings'];
  -- merchant_stats became server-only in D1a (view counts are private, DEC-29); it keeps no policy.
  server_only_tables text[] := array['page_views','login_attempts','merchant_daily_views','merchant_monthly_views','merchant_stats'];
  n int;
begin
  -- RLS enabled on every public table
  for t in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind='r' and not c.relrowsecurity loop
    bad := bad || format(' [RLS off: %s]', t);
  end loop;

  foreach r in array array['anon','authenticated'] loop
    -- no write/truncate privilege anywhere (column-level INSERT/UPDATE grants count too)
    for t in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind='r' loop
      foreach p in array array['INSERT','UPDATE'] loop
        if has_any_column_privilege(r, format('public.%I', t), p) then bad := bad || format(' [%s can %s %s]', r, p, t); end if;
      end loop;
      foreach p in array array['DELETE','TRUNCATE'] loop
        if has_table_privilege(r, format('public.%I', t), p) then bad := bad || format(' [%s can %s %s]', r, p, t); end if;
      end loop;
    end loop;
    -- SELECT only on the public-read tables. merchants is readable column by column since D1b,
    -- so "readable" means at least one column; server-only tables must have no readable column.
    foreach t in array server_only_tables loop
      if has_any_column_privilege(r, format('public.%I', t), 'SELECT') then bad := bad || format(' [%s can SELECT server-only table %s]', r, t); end if;
    end loop;
    foreach t in array public_read_tables loop
      if not has_any_column_privilege(r, format('public.%I', t), 'SELECT') then bad := bad || format(' [%s cannot SELECT public table %s]', r, t); end if;
    end loop;
    -- no function execute
    for t in select p2.oid::regprocedure::text from pg_proc p2 join pg_namespace ns on ns.oid=p2.pronamespace where ns.nspname='public' loop
      if has_function_privilege(r, t::regprocedure, 'EXECUTE') then bad := bad || format(' [%s can EXECUTE %s]', r, t); end if;
    end loop;
  end loop;

  -- policies: nothing but SELECT, and settings has no permissive policy
  select count(*) into n from pg_policies where schemaname='public' and cmd <> 'SELECT';
  if n > 0 then bad := bad || format(' [%s non-SELECT policies exist]', n); end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='settings' and policyname in ('Allow all update settings','Allow all read settings')) then
    bad := bad || ' [old permissive settings policy still present]';
  end if;
  -- server-only tables must have no policy at all
  foreach t in array server_only_tables loop
    if exists (select 1 from pg_policies where schemaname='public' and tablename=t) then bad := bad || format(' [policy on server-only table %s]', t); end if;
  end loop;

  -- service_role can still work
  foreach t in array public_read_tables || server_only_tables loop
    if not has_table_privilege('service_role', format('public.%I', t), 'INSERT') then bad := bad || format(' [service_role cannot INSERT %s]', t); end if;
  end loop;
  foreach t in array array['public.increment_view_count(text)','public.increment_article_view(text)','public.aggregate_daily_views()'] loop
    if not has_function_privilege('service_role', t, 'EXECUTE') then bad := bad || format(' [service_role cannot EXECUTE %s]', t); end if;
  end loop;

  if bad <> '' then raise exception 'LOCKDOWN ASSERTIONS FAILED:%', bad; end if;
end $$;
select 'ALL LOCKDOWN ASSERTIONS PASSED' as result;
