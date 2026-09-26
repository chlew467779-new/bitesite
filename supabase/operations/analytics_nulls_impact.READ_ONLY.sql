-- READ-ONLY impact assessment for 20260926121244 (OQ-AnalyticsNulls).
-- Run BEFORE the migration, on an environment CH has approved reading.
-- One SELECT statement: it only reads merchant_daily_views (aggregated
-- counts; no IP addresses) and returns a single JSON value.
--
-- "reported"  = what Admin analytics sum today (every row).
-- "corrected" = what the migration keeps (the most recent row per bucket,
--               NULLs compared as equal) — the same rule as the migration.

with ranked as (
  select d.view_date, d.event_type, d.count,
         d.slug, d.device_type, d.country, d.city, d.os, d.browser, d.referrer_type,
         row_number() over w as rn,
         count(*)     over (partition by slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type) as bucket_rows
    from public.merchant_daily_views d
  window w as (
    partition by slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type
    order by created_at desc nulls last, updated_at desc nulls last, count desc nulls last, id
  )
),
overall as (
  select count(*)                                           as total_rows,
         count(*) filter (where rn = 1 and bucket_rows > 1) as duplicate_buckets,
         count(*) filter (where rn > 1)                     as rows_to_archive,
         min(view_date) filter (where bucket_rows > 1)      as first_affected_date,
         max(view_date) filter (where bucket_rows > 1)      as last_affected_date,
         coalesce(max(bucket_rows), 0)                      as max_rows_in_one_bucket
    from ranked
),
by_event as (
  select event_type,
         sum(count)                                     as reported,
         coalesce(sum(count) filter (where rn = 1), 0)  as corrected
    from ranked
   group by event_type
),
by_month as (
  select to_char(view_date, 'YYYY-MM')                  as month,
         sum(count)                                     as reported,
         coalesce(sum(count) filter (where rn = 1), 0)  as corrected
    from ranked
   where event_type = 'page_view'
   group by 1
),
null_keys as (
  select count(*) filter (where slug is null)          as slug,
         count(*) filter (where device_type is null)   as device_type,
         count(*) filter (where country is null)       as country,
         count(*) filter (where city is null)          as city,
         count(*) filter (where os is null)            as os,
         count(*) filter (where browser is null)       as browser,
         count(*) filter (where referrer_type is null) as referrer_type,
         count(*) filter (where event_type is null)    as event_type
    from ranked
   where rn = 1 and bucket_rows > 1
),
last_7_days as (
  select view_date,
         count(*)                                       as rows,
         count(*) filter (where rn > 1)                 as extra_rows,
         sum(count)                                     as reported,
         coalesce(sum(count) filter (where rn = 1), 0)  as corrected
    from ranked
   where view_date >= current_date - 7
   group by view_date
)
select json_build_object(
  'overall',                    (select row_to_json(o) from overall o),
  'by_event_type',              (select coalesce(json_agg(e order by e.reported - e.corrected desc, e.event_type), '[]') from by_event e),
  'page_views_by_month',        (select coalesce(json_agg(m order by m.month), '[]') from by_month m),
  'null_key_columns_in_duplicated_buckets', (select row_to_json(n) from null_keys n),
  'last_7_days',                (select coalesce(json_agg(l order by l.view_date), '[]') from last_7_days l)
) as analytics_nulls_impact;
