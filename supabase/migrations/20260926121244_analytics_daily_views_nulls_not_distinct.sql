-- =====================================================================
-- OQ-AnalyticsNulls: make the merchant_daily_views bucket key treat NULLs
-- as equal, so the hourly aggregate updates a bucket instead of adding rows.
-- =====================================================================
-- Why: the bucket key (slug, page_type, view_date, device_type, country,
-- city, os, browser, referrer_type, event_type) was a default NULLS DISTINCT
-- unique constraint. /api/track writes NULL into several of those columns
-- (slug on pages without a restaurant; os, browser, country, city, ...), so
-- `on conflict` in public.aggregate_daily_views() never matched those buckets
-- and every hourly run (and the 03:00 MYT retention run) inserted another
-- full-count row. Admin analytics sum the rows, so those buckets are
-- over-counted.
--
-- What this does, in one transaction:
-- 1. For each bucket that has more than one row, keeps the most recent row
--    (latest created_at; each duplicate is a full snapshot of the bucket at
--    the time of that run, so the latest one is the current total) and moves
--    the older rows to private.merchant_daily_views_nulls_dedupe_archive.
--    Nothing is lost: the archive keeps every removed row and which row was
--    kept instead.
-- 2. Replaces the unique constraint with the same columns as
--    UNIQUE NULLS NOT DISTINCT (PostgreSQL 15+). aggregate_daily_views() is
--    unchanged: its `on conflict (...)` column list infers the new constraint.
-- 3. Checks itself and raises (rolling everything back) if anything is off.
--
-- This changes stored analytics data wherever it runs. Hosted environments
-- need CH approval for this specific migration and environment first. Run
-- supabase/operations/analytics_nulls_impact.READ_ONLY.sql beforehand to see
-- what it will change.
-- =====================================================================
begin;

-- Keep the hourly/daily cron aggregate out while the rows are merged.
lock table public.merchant_daily_views in access exclusive mode;

create table private.merchant_daily_views_nulls_dedupe_archive (
  id            uuid not null primary key,
  slug          text,
  page_type     text not null,
  view_date     date not null,
  device_type   text,
  country       text,
  city          text,
  os            text,
  browser       text,
  referrer_type text,
  event_type    text,
  count         integer,
  unique_ips    integer,
  created_at    timestamptz,
  updated_at    timestamptz,
  kept_id       uuid not null,
  archived_at   timestamptz not null default now()
);

alter table private.merchant_daily_views_nulls_dedupe_archive enable row level security;
revoke all on table private.merchant_daily_views_nulls_dedupe_archive from public, anon, authenticated, service_role;

comment on table private.merchant_daily_views_nulls_dedupe_archive is
  'Duplicate merchant_daily_views rows removed by 20260926121244 (NULLS DISTINCT bucket key). kept_id is the row that stayed. Owner-only; no API access. Drop only with CH approval.';

do $migration$
declare
  rows_before     bigint;
  dup_buckets     bigint;
  rows_archived   bigint;
  rows_deleted    bigint;
  rows_after      bigint;
  old_constraint  text;
  unique_count    integer;
begin
  select count(*) into rows_before from public.merchant_daily_views;

  select count(*) into dup_buckets
    from (
      select 1
        from public.merchant_daily_views
       group by slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type
      having count(*) > 1
    ) b;

  -- 1) Archive every row except the most recent one per bucket.
  --    PARTITION BY groups NULLs together, unlike the old constraint.
  insert into private.merchant_daily_views_nulls_dedupe_archive (
    id, slug, page_type, view_date, device_type, country, city, os, browser,
    referrer_type, event_type, count, unique_ips, created_at, updated_at, kept_id
  )
  select d.id, d.slug, d.page_type, d.view_date, d.device_type, d.country, d.city, d.os, d.browser,
         d.referrer_type, d.event_type, d.count, d.unique_ips, d.created_at, d.updated_at, r.kept_id
    from public.merchant_daily_views d
    join (
      select id,
             first_value(id) over w as kept_id,
             row_number()    over w as rn
        from public.merchant_daily_views
      window w as (
        partition by slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type
        order by created_at desc nulls last, updated_at desc nulls last, count desc nulls last, id
      )
    ) r on r.id = d.id
   where r.rn > 1;
  get diagnostics rows_archived = row_count;

  delete from public.merchant_daily_views d
   using private.merchant_daily_views_nulls_dedupe_archive a
   where a.id = d.id;
  get diagnostics rows_deleted = row_count;

  select count(*) into rows_after from public.merchant_daily_views;

  if rows_deleted <> rows_archived or rows_after <> rows_before - rows_archived then
    raise exception 'dedupe mismatch: before=%, archived=%, deleted=%, after=%',
      rows_before, rows_archived, rows_deleted, rows_after;
  end if;

  -- 2) Replace the bucket key. Look the constraint up by its columns rather
  --    than by name, so an environment with a different generated name works.
  select c.conname into old_constraint
    from pg_constraint c
   where c.conrelid = 'public.merchant_daily_views'::regclass
     and c.contype = 'u'
     and (select array_agg(a.attname::text order by a.attname)
            from unnest(c.conkey) k(attnum)
            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum)
         = array['browser','city','country','device_type','event_type','os','page_type','referrer_type','slug','view_date'];

  if old_constraint is null then
    raise exception 'bucket unique constraint on merchant_daily_views not found';
  end if;

  execute format('alter table public.merchant_daily_views drop constraint %I', old_constraint);

  alter table public.merchant_daily_views
    add constraint merchant_daily_views_bucket_key
    unique nulls not distinct (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type);

  -- 3) Self-checks
  select count(*) into unique_count
    from pg_constraint
   where conrelid = 'public.merchant_daily_views'::regclass and contype = 'u';
  if unique_count <> 1 then
    raise exception 'expected exactly one unique constraint on merchant_daily_views, found %', unique_count;
  end if;

  if not exists (
    select 1
      from pg_constraint c
      join pg_index i on i.indexrelid = c.conindid
     where c.conrelid = 'public.merchant_daily_views'::regclass
       and c.conname = 'merchant_daily_views_bucket_key'
       and i.indnullsnotdistinct
  ) then
    raise exception 'merchant_daily_views_bucket_key is not NULLS NOT DISTINCT';
  end if;

  if exists (
    select 1
      from public.merchant_daily_views
     group by slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type
    having count(*) > 1
  ) then
    raise exception 'duplicate buckets remain after dedupe';
  end if;

  raise notice 'analytics nulls: rows_before=%, duplicate_buckets=%, rows_archived=%, rows_after=%, replaced constraint %',
    rows_before, dup_buckets, rows_archived, rows_after, old_constraint;
end $migration$;

commit;
