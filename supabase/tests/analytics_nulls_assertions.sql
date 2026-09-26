-- Read-only catalog + data checks for 20260926121244 (OQ-AnalyticsNulls).
-- Safe on local, staging and production after the migration. Writes nothing.

begin read only;

do $$
declare
  unique_count integer;
begin
  -- One unique constraint on merchant_daily_views, on the ten bucket columns, NULLS NOT DISTINCT
  select count(*) into unique_count
    from pg_constraint
   where conrelid = 'public.merchant_daily_views'::regclass and contype = 'u';
  if unique_count <> 1 then
    raise exception 'expected 1 unique constraint on merchant_daily_views, found %', unique_count;
  end if;

  if not exists (
    select 1
      from pg_constraint c
      join pg_index i on i.indexrelid = c.conindid
     where c.conrelid = 'public.merchant_daily_views'::regclass
       and c.conname = 'merchant_daily_views_bucket_key'
       and i.indnullsnotdistinct
       and (select array_agg(a.attname::text order by a.attname)
              from unnest(c.conkey) k(attnum)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum)
           = array['browser','city','country','device_type','event_type','os','page_type','referrer_type','slug','view_date']
  ) then
    raise exception 'merchant_daily_views_bucket_key missing, wrong columns, or not NULLS NOT DISTINCT';
  end if;

  -- No duplicate buckets (NULLs compared as equal)
  if exists (
    select 1
      from public.merchant_daily_views
     group by slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type
    having count(*) > 1
  ) then
    raise exception 'merchant_daily_views has duplicate buckets';
  end if;

  -- Archive exists, RLS on, and no API role can touch it
  if to_regclass('private.merchant_daily_views_nulls_dedupe_archive') is null then
    raise exception 'private.merchant_daily_views_nulls_dedupe_archive is missing';
  end if;

  if not (select relrowsecurity from pg_class
           where oid = 'private.merchant_daily_views_nulls_dedupe_archive'::regclass) then
    raise exception 'RLS is off on the dedupe archive';
  end if;

  if has_table_privilege('anon', 'private.merchant_daily_views_nulls_dedupe_archive', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'private.merchant_daily_views_nulls_dedupe_archive', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'private.merchant_daily_views_nulls_dedupe_archive', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'an API role has privileges on the dedupe archive';
  end if;

  -- Every archived row points at a bucket row that still exists
  if exists (
    select 1
      from private.merchant_daily_views_nulls_dedupe_archive a
      left join public.merchant_daily_views d on d.id = a.kept_id
     where d.id is null
  ) then
    raise exception 'an archived row points at a kept row that no longer exists';
  end if;

  -- The aggregate still targets the same column list (inferred by the new constraint)
  if position('on conflict (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type)'
              in pg_get_functiondef('public.aggregate_daily_views()'::regprocedure)) = 0 then
    raise exception 'aggregate_daily_views() no longer uses the bucket column list in ON CONFLICT';
  end if;

  raise notice 'analytics_nulls_assertions: PASS';
end $$;

rollback;
