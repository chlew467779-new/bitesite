-- Analytics aggregation regression test (LOCAL / STAGING ONLY).
-- Verifies that rerunning the hourly aggregate replaces a bucket rather than
-- adding another row, including buckets whose key columns are NULL
-- (os, browser and referrer_type below, and slug in the second bucket).
-- The transaction is rolled back and leaves no test rows.

begin;
set local role service_role;

insert into public.page_views (slug, path, page_type, event_type, ip, country, city, device_type)
values
  ('zz-analytics-idempotent', '/store/zz-analytics-idempotent', 'merchant', 'page_view', '203.0.113.10', 'MY', 'Test', 'desktop'),
  ('zz-analytics-idempotent', '/store/zz-analytics-idempotent', 'merchant', 'page_view', '203.0.113.11', 'MY', 'Test', 'desktop'),
  (null, '/zz-analytics-no-slug', 'other', 'page_view', '203.0.113.12', 'MY', 'zz-analytics-null-slug', 'mobile');

do $$
declare
  run integer;
  merchant_rows integer;
  merchant_count integer;
  merchant_unique integer;
  null_slug_rows integer;
  null_slug_count integer;
begin
  for run in 1..3 loop
    perform public.aggregate_daily_views();

    select count(*), coalesce(sum(count), 0), coalesce(sum(unique_ips), 0)
      into merchant_rows, merchant_count, merchant_unique
      from public.merchant_daily_views
     where slug = 'zz-analytics-idempotent';

    select count(*), coalesce(sum(count), 0)
      into null_slug_rows, null_slug_count
      from public.merchant_daily_views
     where slug is null and city = 'zz-analytics-null-slug';

    if merchant_rows <> 1 or merchant_count <> 2 or merchant_unique <> 2 then
      raise exception 'run %: merchant bucket mismatch: rows=%, count=%, unique_ips=% (expected 1, 2, 2)',
        run, merchant_rows, merchant_count, merchant_unique;
    end if;

    if null_slug_rows <> 1 or null_slug_count <> 1 then
      raise exception 'run %: NULL-slug bucket mismatch: rows=%, count=% (expected 1, 1)',
        run, null_slug_rows, null_slug_count;
    end if;
  end loop;

  -- A new event in an existing bucket replaces the bucket's totals.
  insert into public.page_views (slug, path, page_type, event_type, ip, country, city, device_type)
  values ('zz-analytics-idempotent', '/store/zz-analytics-idempotent', 'merchant', 'page_view', '203.0.113.10', 'MY', 'Test', 'desktop');

  perform public.aggregate_daily_views();

  select count(*), coalesce(sum(count), 0), coalesce(sum(unique_ips), 0)
    into merchant_rows, merchant_count, merchant_unique
    from public.merchant_daily_views
   where slug = 'zz-analytics-idempotent';

  if merchant_rows <> 1 or merchant_count <> 3 or merchant_unique <> 2 then
    raise exception 'after new event: merchant bucket mismatch: rows=%, count=%, unique_ips=% (expected 1, 3, 2)',
      merchant_rows, merchant_count, merchant_unique;
  end if;

  raise notice 'analytics_aggregation_idempotence: PASS';
end $$;

rollback;
