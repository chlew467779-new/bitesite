-- Read-only deployment assertion for the public directory query indexes.
do $$
begin
  if to_regclass('public.idx_merchants_published_created_at') is null then
    raise exception 'FAIL: idx_merchants_published_created_at is missing';
  end if;

  if to_regclass('public.idx_products_available_merchant') is null then
    raise exception 'FAIL: idx_products_available_merchant is missing';
  end if;

  raise notice 'PASS: homepage query indexes are present';
end $$;

select 'ALL HOMEPAGE QUERY INDEX ASSERTIONS PASSED' as result;
