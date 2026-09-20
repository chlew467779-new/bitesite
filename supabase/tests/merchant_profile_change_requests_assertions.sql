-- Read-only catalog assertions for merchant profile change requests.
do $$
declare
  rls_enabled boolean;
  bad text := '';
begin
  select c.relrowsecurity into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'merchant_profile_change_requests';

  if not found then
    raise exception 'FAIL: merchant_profile_change_requests table is missing';
  end if;
  if not rls_enabled then bad := bad || ' [RLS disabled]'; end if;
  if has_table_privilege('anon', 'public.merchant_profile_change_requests', 'SELECT') then bad := bad || ' [anon can SELECT]'; end if;
  if has_table_privilege('authenticated', 'public.merchant_profile_change_requests', 'INSERT') then bad := bad || ' [authenticated can INSERT]'; end if;
  if not has_table_privilege('service_role', 'public.merchant_profile_change_requests', 'INSERT') then bad := bad || ' [service_role cannot INSERT]'; end if;
  if not has_table_privilege('service_role', 'public.merchant_profile_change_requests', 'UPDATE') then bad := bad || ' [service_role cannot UPDATE]'; end if;
  if bad <> '' then raise exception 'MERCHANT PROFILE CHANGE REQUEST ASSERTIONS FAILED:%', bad; end if;
end $$;

select 'ALL MERCHANT PROFILE CHANGE REQUEST ASSERTIONS PASSED' as result;
