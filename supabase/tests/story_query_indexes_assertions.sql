-- Read-only deployment assertion for public Story query indexes.
do $$
begin
  if to_regclass('public.idx_articles_published_created_at') is null then
    raise exception 'FAIL: idx_articles_published_created_at is missing';
  end if;

  if to_regclass('public.idx_articles_published_slug') is null then
    raise exception 'FAIL: idx_articles_published_slug is missing';
  end if;

  raise notice 'PASS: Story query indexes are present';
end $$;

select 'ALL STORY QUERY INDEX ASSERTIONS PASSED' as result;
