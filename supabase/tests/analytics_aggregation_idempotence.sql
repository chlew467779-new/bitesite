-- Analytics aggregation regression test (STAGING ONLY).
-- Verifies that rerunning the hourly aggregate replaces a bucket rather than
-- incrementing it. The transaction is rolled back and leaves no test rows.

begin;
set local role service_role;

insert into public.page_views (slug, path, page_type, event_type, ip, country, city, device_type)
values
  ('zz-analytics-idempotent', '/store/zz-analytics-idempotent', 'merchant', 'page_view', '203.0.113.10', 'MY', 'Test', 'desktop'),
  ('zz-analytics-idempotent', '/store/zz-analytics-idempotent', 'merchant', 'page_view', '203.0.113.11', 'MY', 'Test', 'desktop');

select public.aggregate_daily_views();

do $$
declare
  first_count integer;
  first_unique integer;
  second_count integer;
  second_unique integer;
begin
  select coalesce(sum(count), 0), coalesce(sum(unique_ips), 0)
    into first_count, first_unique
    from public.merchant_daily_views
   where slug = 'zz-analytics-idempotent';

  if first_count <> 2 or first_unique <> 2 then
    raise exception 'first aggregate mismatch: count=%, unique_ips=%', first_count, first_unique;
  end if;

  select public.aggregate_daily_views();

  select coalesce(sum(count), 0), coalesce(sum(unique_ips), 0)
    into second_count, second_unique
    from public.merchant_daily_views
   where slug = 'zz-analytics-idempotent';

  if second_count <> first_count or second_unique <> first_unique then
    raise exception 'aggregate is not idempotent: first=(%,%), second=(%,%)',
      first_count, first_unique, second_count, second_unique;
  end if;
end $$;

rollback;
