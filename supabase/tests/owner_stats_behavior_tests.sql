-- =====================================================================
-- Owner statistics: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927200000_merchant_owner_stats. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema st_test;
grant usage on schema st_test to public;
create function st_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'STATS TEST FAILED: %', label; end if; end $f$;
grant execute on all functions in schema st_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000c7a1', 'zz-st-owner@example.test'),
  ('00000000-0000-4000-8000-00000000c7a2', 'zz-st-other@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000c701', 'zz-st-new', 'ZZ ST', true, 'PUBLISHED', '+60111111111');
insert into public.merchant_memberships (merchant_id, user_id, role, status)
  values ('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c7a1', 'owner', 'active');
insert into public.merchant_slug_history (old_slug, merchant_id) values ('zz-st-old', '00000000-0000-4000-8000-00000000c701');
insert into public.page_views (path, slug, page_type, event_type, ip, created_at) values
  ('/x', 'zz-st-new', 'merchant', 'page_view', '10.0.0.1', now()),
  ('/x', 'zz-st-new', 'merchant', 'page_view', '10.0.0.1', now()),
  ('/x', 'zz-st-old', 'merchant', 'page_view', '10.0.0.2', now() - interval '2 days'),
  ('/x', 'zz-st-new', 'merchant', 'whatsapp_click', '10.0.0.1', now()),
  ('/x', 'zz-st-new', 'merchant', 'menu_view', '10.0.0.1', now()),
  ('/x', 'zz-st-new', 'story', 'page_view', '10.0.0.3', now()),                   -- a Story page, not the restaurant page
  ('/x', 'zz-st-new', 'merchant', 'page_view', '10.0.0.4', now() - interval '40 days'), -- outside 30 days
  ('/x', 'zz-st-else', 'merchant', 'page_view', '10.0.0.5', now());               -- another restaurant

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000c701';
  r jsonb;
begin
  r := public.merchant_stats_read('owner', '00000000-0000-4000-8000-00000000c7a1', a, 30);
  perform st_test.ok((r #>> '{totals,page_view}')::int = 3, 'page views: current and former slug, restaurant page only, in range');
  perform st_test.ok((r ->> 'uniqueVisitors')::int = 2, 'unique visitors');
  perform st_test.ok((r #>> '{totals,whatsapp_click}')::int = 1 and (r #>> '{totals,menu_view}')::int = 1, 'actions');
  perform st_test.ok(jsonb_array_length(r -> 'daily') = 30, 'one entry per day');
  perform st_test.ok((select sum((e ->> 'views')::int) from jsonb_array_elements(r -> 'daily') e) = 3, 'daily series adds up');
  perform st_test.ok(r::text not like '%10.0.0%', 'no IPs leave the database');
  perform st_test.ok((public.merchant_stats_read('owner', '00000000-0000-4000-8000-00000000c7a1', a, 90) #>> '{totals,page_view}')::int = 4, '90 days includes the older view');
  begin
    perform public.merchant_stats_read('owner', '00000000-0000-4000-8000-00000000c7a2', a, 30);
    raise exception 'STATS TEST FAILED: foreign Owner';
  exception when others then if sqlerrm not like 'RESOURCE_NOT_FOUND%' then raise; end if;
  end;
  begin
    perform public.merchant_stats_read('owner', '00000000-0000-4000-8000-00000000c7a1', a, 365);
    raise exception 'STATS TEST FAILED: range';
  exception when others then if sqlerrm not like 'VALIDATION_FAILED%' then raise; end if;
  end;
end $$;

reset role;
select 'ALL OWNER STATS BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
