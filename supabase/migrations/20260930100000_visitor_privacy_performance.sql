-- =====================================================================
-- Visitor privacy (#31) and the Admin performance summary (dashboard phase 2).
-- =====================================================================
-- 1. public.page_views no longer holds raw IP addresses or user agents.
--    /api/track now stores a keyed hash of the IP (HMAC-SHA256, server secret, 32 hex) and no
--    user agent (device/OS/browser are already derived). Existing rows: every IP is replaced by
--    an HMAC under a random key that exists only inside this transaction (so distinct counts in
--    the last 90 days stay right, but nobody can map them back), and user agents are cleared.
--    A check constraint keeps raw IPs out from now on.
--    Raw rows are still deleted after 90 days by the existing cron job page_views_cleanup_90d
--    (20260920001000); daily totals stay in merchant_daily_views. This migration asserts the job.
-- 2. public.admin_performance_summary(days 7|30|90): KPIs against the previous period of the same
--    length, a daily views/contacts series, restaurants ranked by views with their contacts, and
--    searches that found nothing. "Contacts" = WhatsApp, phone and directions clicks (CH 09-29).
--    Days are Asia/Kuala_Lumpur. Service role only; no hashes or raw rows leave the database.
--
-- DEPLOY ORDER: ship the app first (it writes hashed IPs), then run this migration. Rows written
-- by the old app between the two steps are hashed here too.
-- Rollback: supabase/rollback/20260930100000_visitor_privacy_performance.rollback.STAGING_ONLY.sql
-- (the function and constraint only; the IPs cannot be restored, by design).
-- =====================================================================
begin;

-- The cleanup job must exist before we promise "90 days" anywhere.
do $$
begin
  if not exists (
    select 1 from cron.job
     where jobname = 'page_views_cleanup_90d'
       and command like '%interval ''90 days''%'
       and active
  ) then
    raise exception 'page_views_cleanup_90d is missing or inactive: apply 20260920001000 first';
  end if;
end $$;

-- 1. Hash every stored IP under a throwaway key; drop user agents.
do $$
declare
  k text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  update public.page_views
     set ip = case
                when ip is null or ip = '' or ip = 'unknown' then null
                when ip ~ '^[0-9a-f]{32,64}$' then ip
                else left(encode(extensions.hmac(ip, k, 'sha256'), 'hex'), 32)
              end,
         user_agent = null
   where user_agent is not null
      or (ip is not null and ip !~ '^[0-9a-f]{32,64}$');
end $$;

alter table public.page_views drop constraint if exists page_views_ip_hashed;
alter table public.page_views add constraint page_views_ip_hashed
  check (ip is null or ip ~ '^[0-9a-f]{32,64}$');
alter table public.page_views drop constraint if exists page_views_no_user_agent;
alter table public.page_views add constraint page_views_no_user_agent
  check (user_agent is null);

comment on column public.page_views.ip is
  'HMAC-SHA256 of the visitor IP (server secret), never the address itself; for distinct-visitor counts only. Rows are deleted after 90 days.';
comment on column public.page_views.user_agent is 'No longer stored (always null).';

create index if not exists page_views_created_event_idx on public.page_views (created_at, event_type);

-- 2. Admin performance summary.
create or replace function public.admin_performance_summary(p_days int)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_to date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_from date;
  v_prev_from date;
  v_has_prev boolean;
  v_contacts constant text[] := array['whatsapp_click', 'phone_click', 'directions_click'];
begin
  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'VALIDATION_FAILED: days must be 7, 30 or 90';
  end if;
  v_from := v_to - (p_days - 1);
  v_prev_from := v_from - p_days;
  -- Raw rows are kept 90 days, so a 90-day period has no complete previous period.
  v_has_prev := p_days * 2 <= 90;

  return (
    with ev as (
      select pv.event_type, pv.page_type, pv.slug, pv.ip, pv.event_detail, pv.metadata, pv.created_at,
             (pv.created_at at time zone 'Asia/Kuala_Lumpur')::date as day,
             -- A contact is a click on a restaurant's WhatsApp, phone or directions (not Join us).
             (pv.event_type = any (v_contacts) and pv.slug is not null) as is_contact
        from public.page_views pv
       where pv.created_at >= ((case when v_has_prev then v_prev_from else v_from end)::timestamp at time zone 'Asia/Kuala_Lumpur')
         and pv.event_type in ('page_view', 'whatsapp_click', 'phone_click', 'directions_click', 'search')
    ),
    cur as (select * from ev where ev.day >= v_from),
    prev as (select * from ev where v_has_prev and ev.day < v_from),
    -- Every slug a restaurant has had points to the restaurant.
    slug_map as (
      select m.slug, m.id as merchant_id from public.merchants m
      union all
      select h.old_slug, h.merchant_id from public.merchant_slug_history h
       where not exists (select 1 from public.merchants m2 where m2.slug = h.old_slug)
    ),
    per_merchant as (
      select sm.merchant_id,
             count(*) filter (where c.event_type = 'page_view' and c.page_type = 'merchant') as views,
             count(distinct c.ip) filter (where c.event_type = 'page_view' and c.page_type = 'merchant') as visitors,
             count(*) filter (where c.event_type = 'whatsapp_click') as whatsapp,
             count(*) filter (where c.event_type = 'phone_click') as phone,
             count(*) filter (where c.event_type = 'directions_click') as directions
        from cur c
        join slug_map sm on sm.slug = c.slug
       where (c.event_type = 'page_view' and c.page_type = 'merchant') or c.is_contact
       group by sm.merchant_id
    ),
    zero as (
      select lower(btrim(c.event_detail)) as term, count(*) as searches, count(distinct c.ip) as visitors,
             max(c.created_at) as last_at
        from cur c
       where c.event_type = 'search' and c.metadata ->> 'results' = '0'
         and coalesce(btrim(c.event_detail), '') <> ''
       group by 1
    )
    select jsonb_build_object(
      'days', p_days,
      'from', v_from,
      'to', v_to,
      'hasPrevious', v_has_prev,
      'current', jsonb_build_object(
        'visitors', (select count(distinct ip) from cur where event_type = 'page_view'),
        'pageViews', (select count(*) from cur where event_type = 'page_view'),
        'restaurantViews', (select count(*) from cur where event_type = 'page_view' and page_type = 'merchant'),
        'contacts', (select count(*) from cur where is_contact)
      ),
      'previous', case when v_has_prev then jsonb_build_object(
        'visitors', (select count(distinct ip) from prev where event_type = 'page_view'),
        'pageViews', (select count(*) from prev where event_type = 'page_view'),
        'restaurantViews', (select count(*) from prev where event_type = 'page_view' and page_type = 'merchant'),
        'contacts', (select count(*) from prev where is_contact)
      ) end,
      'daily', (
        select jsonb_agg(jsonb_build_object('date', d.day, 'views', coalesce(t.views, 0), 'contacts', coalesce(t.contacts, 0))
                         order by d.day)
          from (select g::date as day from generate_series(v_from, v_to, interval '1 day') g) d
          left join (
            select cur.day,
                   count(*) filter (where cur.event_type = 'page_view') as views,
                   count(*) filter (where cur.is_contact) as contacts
              from cur group by cur.day
          ) t on t.day = d.day
      ),
      'restaurants', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id, 'slug', m.slug, 'name', m.name, 'published', m.is_published,
                 'views', pm.views, 'visitors', pm.visitors,
                 'whatsapp', pm.whatsapp, 'phone', pm.phone, 'directions', pm.directions,
                 'contacts', pm.whatsapp + pm.phone + pm.directions
               ) order by pm.views desc, (pm.whatsapp + pm.phone + pm.directions) desc, m.name)
          from per_merchant pm
          join public.merchants m on m.id = pm.merchant_id
      ), '[]'::jsonb),
      'searches', jsonb_build_object(
        'total', (select count(*) from cur where event_type = 'search'),
        'counted', (select count(*) from cur where event_type = 'search' and metadata ? 'results'),
        'noResults', (select count(*) from cur where event_type = 'search' and metadata ->> 'results' = '0'),
        'noResultTerms', coalesce((
          select jsonb_agg(jsonb_build_object('term', z.term, 'searches', z.searches, 'visitors', z.visitors, 'lastAt', z.last_at)
                           order by z.searches desc, z.last_at desc)
            from (select * from zero order by searches desc, last_at desc limit 30) z
        ), '[]'::jsonb)
      )
    )
  );
end;
$$;

revoke all on function public.admin_performance_summary(integer) from public, anon, authenticated;
grant execute on function public.admin_performance_summary(integer) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.admin_performance_summary(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_performance_summary(integer)', 'execute')
     or not has_function_privilege('service_role', 'public.admin_performance_summary(integer)', 'execute') then
    raise exception 'Performance summary self-check: wrong EXECUTE grants';
  end if;
  if exists (select 1 from public.page_views where user_agent is not null or (ip is not null and ip !~ '^[0-9a-f]{32,64}$')) then
    raise exception 'Visitor privacy self-check: raw IPs or user agents remain';
  end if;
end $$;

commit;
