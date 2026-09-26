-- =====================================================================
-- D1a merchant state foundation: read-only catalog ASSERTIONS.
-- Safe on local, staging and (after the migration) production. No writes, no role switching.
-- Returns 'ALL D1A STATE ASSERTIONS PASSED' or raises an exception naming what is wrong.
-- =====================================================================
do $$
declare
  bad text := '';
  c text;
  t text;
begin
  foreach c in array array['review_status','listing_visibility','platform_restriction','state_source','revision','updated_at','first_published_at'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchants' and column_name = c) then
      bad := bad || format(' [merchants.%s missing]', c);
    end if;
  end loop;

  foreach c in array array['merchants_review_status_check','merchants_listing_visibility_check','merchants_platform_restriction_check','merchants_state_source_check','merchants_revision_nonnegative'] loop
    if not exists (select 1 from pg_constraint where conrelid = 'public.merchants'::regclass and conname = c and convalidated) then
      bad := bad || format(' [constraint %s missing or not validated]', c);
    end if;
  end loop;

  if to_regprocedure('private.merchant_is_public(public.merchants)') is null then
    bad := bad || ' [private.merchant_is_public missing]';
  else
    if (select prosecdef from pg_proc where oid = to_regprocedure('private.merchant_is_public(public.merchants)')) then
      bad := bad || ' [merchant_is_public must be SECURITY INVOKER]';
    end if;
    if not coalesce((select proconfig @> array['search_path=""'] from pg_proc where oid = to_regprocedure('private.merchant_is_public(public.merchants)')), false) then
      bad := bad || ' [merchant_is_public must pin an empty search_path]';
    end if;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'merchant_is_public') then
    bad := bad || ' [merchant_is_public must not live in the PostgREST-exposed public schema]';
  end if;

  foreach t in array array['merchants_before_write','merchants_after_write_audit'] loop
    if not exists (select 1 from pg_trigger where tgrelid = 'public.merchants'::regclass and tgname = t and not tgisinternal and tgenabled = 'O') then
      bad := bad || format(' [trigger %s missing or disabled]', t);
    end if;
  end loop;

  foreach t in array array[
    'merchants.pub_read_merchants', 'categories.pub_read_categories', 'products.pub_read_products',
    'merchant_videos.pub_read_merchant_videos', 'merchant_external_links.merchant_external_links_public_read',
    'events.pub_read_events'
  ] loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = split_part(t, '.', 1) and policyname = split_part(t, '.', 2)
         and cmd = 'SELECT' and qual like '%private.merchant_is_public%'
    ) then
      bad := bad || format(' [%s does not use the shared predicate]', t);
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('merchants','categories','products','merchant_videos','merchant_external_links','events') and cmd = 'SELECT' and qual not like '%merchant_is_public%') then
    bad := bad || ' [another SELECT policy bypasses the shared predicate]';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'merchant_stats') then
    bad := bad || ' [merchant_stats still has a policy]';
  end if;

  foreach c in array array['anon','authenticated'] loop
    if has_table_privilege(c, 'public.merchant_stats', 'SELECT') then bad := bad || format(' [%s can SELECT merchant_stats]', c); end if;
    if has_table_privilege(c, 'public.merchant_change_log', 'SELECT') or has_table_privilege(c, 'public.merchant_change_log', 'INSERT') then
      bad := bad || format(' [%s can access merchant_change_log]', c);
    end if;
    if not has_function_privilege(c, 'private.merchant_is_public(public.merchants)', 'EXECUTE') then
      bad := bad || format(' [%s cannot evaluate the public predicate used by RLS]', c);
    end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.merchant_change_log'::regclass) then
    bad := bad || ' [RLS off on merchant_change_log]';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'merchant_memberships' and indexname = 'merchant_memberships_one_active_owner'
       and indexdef like 'CREATE UNIQUE INDEX%' and indexdef like '%(merchant_id)%' and indexdef like '%status = ''active''%'
  ) then
    bad := bad || ' [one-active-owner partial unique index missing]';
  end if;

  -- ---- private schema: usage only, and a fixed EXECUTE matrix for every function in it ----
  foreach c in array array['anon','authenticated'] loop
    if not has_schema_privilege(c, 'private', 'USAGE') then
      bad := bad || format(' [%s needs USAGE on private to evaluate the RLS predicate]', c);
    end if;
  end loop;
  foreach c in array array['anon','authenticated','service_role'] loop
    if has_schema_privilege(c, 'private', 'CREATE') then
      bad := bad || format(' [%s can CREATE in schema private]', c);
    end if;
  end loop;
  declare
    fn record;
    expected_exec text[];
    actual_exec text[];
  begin
    for fn in
      select p.oid, p.proname::text as sig, p.prosecdef, p.proconfig
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
    loop
      expected_exec := case fn.sig
        when 'merchant_is_public' then array['anon','authenticated','service_role']
        when 'merchants_before_write' then array[]::text[]
        when 'merchants_after_write_audit' then array[]::text[]
        when 'convert_merchant_to_managed' then array[]::text[]
        when 'take_state_conversion_ticket' then array['service_role']
      end;
      if expected_exec is null then
        -- Later packages add their functions to this list (or to their own assertions file).
        if fn.sig not in ('merchant_id_is_public') then
          bad := bad || format(' [unreviewed function %s in schema private]', fn.sig);
        end if;
        continue;
      end if;
      select coalesce(array_agg(r order by r), '{}') into actual_exec
        from unnest(array['anon','authenticated','service_role']) r
       where has_function_privilege(r, fn.oid, 'EXECUTE');
      if actual_exec <> (select coalesce(array_agg(x order by x), '{}') from unnest(expected_exec) x) then
        bad := bad || format(' [%s EXECUTE is %s, expected %s]', fn.sig, actual_exec, expected_exec);
      end if;
      if has_function_privilege('public', fn.oid, 'EXECUTE') then
        bad := bad || format(' [PUBLIC can EXECUTE %s]', fn.sig);
      end if;
      if not coalesce(fn.proconfig @> array['search_path=""'], false) then
        bad := bad || format(' [%s must pin an empty search_path]', fn.sig);
      end if;
      if fn.prosecdef and fn.sig not in ('convert_merchant_to_managed', 'take_state_conversion_ticket') then
        bad := bad || format(' [%s must not be SECURITY DEFINER]', fn.sig);
      end if;
    end loop;
  end;
  foreach t in array array['private.convert_merchant_to_managed(uuid,bigint,text,text,text,text,text,text)',
                           'private.take_state_conversion_ticket(uuid,text,text,text,text)'] loop
    if to_regprocedure(t) is null then
      bad := bad || format(' [%s missing]', t);
    elsif not (select prosecdef from pg_proc where oid = to_regprocedure(t)) then
      bad := bad || format(' [%s must be SECURITY DEFINER]', t);
    end if;
  end loop;

  -- ---- conversion tickets are invisible to every API role ----
  if to_regclass('private.merchant_state_conversion_tickets') is null then
    bad := bad || ' [private.merchant_state_conversion_tickets missing]';
  else
    if not (select relrowsecurity from pg_class where oid = 'private.merchant_state_conversion_tickets'::regclass) then
      bad := bad || ' [RLS off on merchant_state_conversion_tickets]';
    end if;
    foreach c in array array['anon','authenticated','service_role'] loop
      foreach t in array array['SELECT','INSERT','UPDATE'] loop
        if has_any_column_privilege(c, 'private.merchant_state_conversion_tickets', t) then
          bad := bad || format(' [%s can %s conversion tickets]', c, t);
        end if;
      end loop;
      if has_table_privilege(c, 'private.merchant_state_conversion_tickets', 'DELETE') then
        bad := bad || format(' [%s can DELETE conversion tickets]', c);
      end if;
    end loop;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'merchant_change_log' and column_name = 'reason') then
    bad := bad || ' [merchant_change_log.reason missing]';
  end if;

  -- ---- private is not a Data API schema (when PostgREST reads its config from the database) ----
  if exists (
    select 1
      from pg_db_role_setting s join pg_roles r on r.oid = s.setrole, unnest(s.setconfig) cfg
     where r.rolname = 'authenticator' and cfg like 'pgrst.db_schemas=%' and cfg ~ '(=|,)\s*private\s*(,|$)'
  ) then
    bad := bad || ' [schema private is listed in pgrst.db_schemas]';
  end if;

  if bad <> '' then raise exception 'D1A STATE ASSERTIONS FAILED:%', bad; end if;
end $$;
select 'ALL D1A STATE ASSERTIONS PASSED' as result;
