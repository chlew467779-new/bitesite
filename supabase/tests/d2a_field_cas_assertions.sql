-- =====================================================================
-- D2-A atomic field save: READ-ONLY catalog assertions.
-- Local, staging and production (after migration 20260927030741_merchant_field_cas).
-- Changes nothing; raises an exception naming the first failed check.
-- =====================================================================
do $$
declare
  fn text;
  cfg text[];
begin
  foreach fn in array array[
    'public.merchant_field_patch(text,text,uuid,uuid,jsonb)',
    'public.merchant_field_snapshot_read(text,text,uuid)',
    'public.merchant_story_submission_create(uuid,uuid,jsonb)',
    'public.merchant_profile_change_request_create(uuid,uuid,jsonb)',
    'public.request_idempotency_purge_expired(integer)',
    'private.lock_merchant_for_actor(text,text,uuid,boolean)',
    'private.merchant_field_registry()',
    'private.merchant_field_snapshot(public.merchants,text,text)',
    'private.merchant_write_error(text,text)'
  ] loop
    if to_regprocedure(fn) is null then raise exception 'D2A ASSERT: % is missing', fn; end if;
    if has_function_privilege('anon', fn, 'EXECUTE') or has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception 'D2A ASSERT: % is executable by anon/authenticated', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'EXECUTE') then raise exception 'D2A ASSERT: % not executable by service_role', fn; end if;
    select proconfig into cfg from pg_proc where oid = fn::regprocedure;
    if (select prosecdef from pg_proc where oid = fn::regprocedure) then raise exception 'D2A ASSERT: % is SECURITY DEFINER', fn; end if;
    if not coalesce(cfg, '{}') @> array['search_path=""'] then raise exception 'D2A ASSERT: % has no empty search_path', fn; end if;
  end loop;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('merchant_field_patch', 'merchant_field_snapshot_read', 'merchant_story_submission_create', 'merchant_profile_change_request_create', 'request_idempotency_purge_expired')) <> 5 then
    raise exception 'D2A ASSERT: unexpected overloads of the D2-A RPCs';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.request_idempotency'::regclass) then
    raise exception 'D2A ASSERT: request_idempotency must have RLS enabled';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'request_idempotency') then
    raise exception 'D2A ASSERT: request_idempotency must have no policies';
  end if;
  if has_table_privilege('anon', 'public.request_idempotency', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.request_idempotency', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'D2A ASSERT: request_idempotency must be private';
  end if;
  if has_table_privilege('service_role', 'public.request_idempotency', 'UPDATE') then
    raise exception 'D2A ASSERT: stored idempotency results must not be updatable';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'request_idempotency_scope_key' and contype = 'u') then
    raise exception 'D2A ASSERT: idempotency scope key missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'request_idempotency_expires_idx') then
    raise exception 'D2A ASSERT: expiry index missing';
  end if;

  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'merchant_change_log' and column_name in ('request_id', 'operation')) <> 2 then
    raise exception 'D2A ASSERT: merchant_change_log request metadata columns missing';
  end if;
  if has_table_privilege('anon', 'public.merchant_change_log', 'SELECT') or has_table_privilege('authenticated', 'public.merchant_change_log', 'SELECT') then
    raise exception 'D2A ASSERT: merchant_change_log must stay private';
  end if;

  -- The exact writable count grows with later migrations (B0: 25); these D2-A invariants stay.
  if (select count(*) from private.merchant_field_registry() where owner_writable) <> 12
     or exists (select 1 from private.merchant_field_registry() where target in ('website', 'instagram', 'facebook', 'menu_pdf_url', 'menu', 'reviews') and (owner_writable or admin_writable))
     or exists (select 1 from private.merchant_field_registry() where kind = 'feature' and owner_writable) then
    raise exception 'D2A ASSERT: field registry differs from the reviewed whitelist';
  end if;
end $$;

select 'D2A FIELD CAS ASSERTIONS PASSED (read-only)' as result;
