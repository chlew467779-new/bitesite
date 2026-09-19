-- M1 merchant external links catalog assertions.
-- Read-only: safe to run on staging and production after the M1 migration.

do $$
declare
  bad text := '';
  rls_enabled boolean;
begin
  select c.relrowsecurity
    into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'merchant_external_links';

  if not found then
    raise exception 'M1 ASSERTIONS FAILED: merchant_external_links table is missing';
  end if;

  if not rls_enabled then
    bad := bad || ' [RLS is disabled]';
  end if;

  if not has_table_privilege('anon', 'public.merchant_external_links', 'SELECT') then
    bad := bad || ' [anon cannot SELECT]';
  end if;
  if has_table_privilege('anon', 'public.merchant_external_links', 'INSERT') then
    bad := bad || ' [anon can INSERT]';
  end if;
  if has_table_privilege('anon', 'public.merchant_external_links', 'UPDATE') then
    bad := bad || ' [anon can UPDATE]';
  end if;
  if has_table_privilege('anon', 'public.merchant_external_links', 'DELETE') then
    bad := bad || ' [anon can DELETE]';
  end if;
  if not has_table_privilege('service_role', 'public.merchant_external_links', 'INSERT') then
    bad := bad || ' [service_role cannot INSERT]';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'merchant_external_links'
      and policyname = 'merchant_external_links_public_read'
      and cmd = 'SELECT'
  ) then
    bad := bad || ' [public read policy missing]';
  end if;

  if bad <> '' then
    raise exception 'M1 ASSERTIONS FAILED:%', bad;
  end if;
end $$;

select 'ALL M1 MERCHANT EXTERNAL LINK ASSERTIONS PASSED' as result;
