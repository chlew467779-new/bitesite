-- =====================================================================
-- Owner statistics: how many people saw the restaurant page and what they did (read only).
-- =====================================================================
-- public.merchant_stats_read(actor, merchant, days 7..90) aggregates public.page_views (raw events,
-- kept 90 days, written live by /api/track) for the restaurant's current slug and every former
-- slug (merchant_slug_history), with days in Asia/Kuala_Lumpur:
--   totals per event (page_view, menu_view, whatsapp_click, phone_click, directions_click,
--   website_click, email_click, merchant_order_click, booking_submit), unique visitors (distinct
--   IPs of page views, returned only as a number), and a daily page-view series with zero days.
-- Owner (active membership) or Admin. No IPs or other raw rows leave the database; merchant_stats
-- stays private (DEC-29).
--
-- Local first; staging and production each need CH approval, after 20260927190000.
-- Rollback: supabase/rollback/20260927200000_merchant_owner_stats.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create index if not exists page_views_slug_created_idx on public.page_views (slug, created_at);

create or replace function public.merchant_stats_read(p_actor_type text, p_actor_id text, p_merchant_id uuid, p_days int)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  v_slugs text[];
  v_from date;
  v_to date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if p_days is null or p_days not between 7 and 90 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'days must be 7..90');
  end if;
  if p_actor_type = 'owner' then
    if p_actor_id is null or p_actor_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    select mer.* into m from public.merchants mer
      join public.merchant_memberships mm on mm.merchant_id = mer.id
     where mer.id = p_merchant_id and mm.user_id = p_actor_id::uuid and mm.role = 'owner' and mm.status = 'active';
  elsif p_actor_type = 'admin' and p_actor_id = 'legacy_admin' then
    select * into m from public.merchants where id = p_merchant_id;
  else
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'unknown actor');
  end if;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;

  v_from := v_to - (p_days - 1);
  v_slugs := array[m.slug] || coalesce((select array_agg(old_slug) from public.merchant_slug_history where merchant_id = m.id), '{}');

  return (
    with ev as (
      select pv.event_type, pv.ip, (pv.created_at at time zone 'Asia/Kuala_Lumpur')::date as day
        from public.page_views pv
       where pv.slug = any (v_slugs)
         and pv.created_at >= (v_from::timestamp at time zone 'Asia/Kuala_Lumpur')
         and (pv.page_type = 'merchant' or pv.event_type <> 'page_view')
    )
    select jsonb_build_object(
      'days', p_days,
      'from', v_from,
      'to', v_to,
      'totals', (select coalesce(jsonb_object_agg(k, (select count(*) from ev where ev.event_type = k)), '{}'::jsonb)
                   from unnest(array['page_view', 'menu_view', 'whatsapp_click', 'phone_click', 'directions_click',
                                     'website_click', 'email_click', 'merchant_order_click', 'booking_submit']) k),
      'uniqueVisitors', (select count(distinct ev.ip) from ev where ev.event_type = 'page_view' and ev.ip is not null),
      'daily', (select jsonb_agg(jsonb_build_object('date', d, 'views', (select count(*) from ev where ev.event_type = 'page_view' and ev.day = d)) order by d)
                  from generate_series(v_from, v_to, interval '1 day') g(d0), lateral (select g.d0::date as d) x)
    )
  );
end;
$$;

revoke all on function public.merchant_stats_read(text, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.merchant_stats_read(text, text, uuid, integer) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.merchant_stats_read(text,text,uuid,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_stats_read(text,text,uuid,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.merchant_stats_read(text,text,uuid,integer)', 'execute') then
    raise exception 'Owner stats self-check: wrong EXECUTE grants';
  end if;
end $$;

commit;
