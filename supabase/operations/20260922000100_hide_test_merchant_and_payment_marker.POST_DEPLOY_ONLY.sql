-- PRODUCTION OPERATION — run manually only after the target rows are reviewed.
-- This is intentionally not a migration: it changes production content, not schema.
-- It preserves The Hearth Bakery's deliberately malformed operating_hours values
-- as regression data for the public-display and Admin API validation safeguards.

begin;

do $$
begin
  if (select count(*) from public.merchants where slug = 'test-slug') <> 1 then
    raise exception 'Expected exactly one merchant with slug test-slug';
  end if;
end $$;

-- Remove the test restaurant from every public query that uses is_published.
-- Keep the newer platform lifecycle field consistent when that migration exists.
do $operation$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'merchants'
      and column_name = 'platform_status'
  ) then
    update public.merchants
    set is_published = false, platform_status = 'DRAFT'
    where slug = 'test-slug';
  else
    update public.merchants
    set is_published = false
    where slug = 'test-slug';
  end if;
end
$operation$;

-- Remove the exact test-only payment marker without disturbing supported methods.
update public.merchants
set payment_methods = array_remove(coalesce(payment_methods, '{}'::text[]), 'ABCD')
where 'ABCD' = any(payment_methods);

commit;

-- Verify after commit:
-- select slug, is_published, payment_methods from public.merchants
-- where slug = 'test-slug' or 'ABCD' = any(payment_methods);
