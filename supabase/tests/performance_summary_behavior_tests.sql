-- =====================================================================
-- Admin performance summary + visitor privacy: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260930100000_visitor_privacy_performance. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema ps_test;
grant usage on schema ps_test to public;
create function ps_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'PERFORMANCE TEST FAILED: %', label; end if; end $f$;
grant execute on all functions in schema ps_test to public;

-- Only this test's rows count.
delete from public.page_views;

insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000d701', 'zz-ps-a', 'ZZ PS A', true, 'PUBLISHED', '+60111111111'),
  ('00000000-0000-4000-8000-00000000d702', 'zz-ps-b', 'ZZ PS B', true, 'PUBLISHED', '+60111111112');
insert into public.merchant_slug_history (old_slug, merchant_id) values ('zz-ps-a-old', '00000000-0000-4000-8000-00000000d701');

-- v1..v4 are visitor hashes. "Now" rows are today in Malaysia; -10 days is the previous 7-day period.
insert into public.page_views (path, slug, page_type, event_type, ip, event_detail, metadata, created_at) values
  ('/', null, 'home', 'page_view', repeat('1', 32), null, '{}', now()),
  ('/x', 'zz-ps-a', 'merchant', 'page_view', repeat('1', 32), null, '{}', now()),
  ('/x', 'zz-ps-a-old', 'merchant', 'page_view', repeat('2', 32), null, '{}', now()),   -- former slug
  ('/x', 'zz-ps-a', 'merchant', 'whatsapp_click', repeat('1', 32), null, '{}', now()),
  ('/x', 'zz-ps-a', 'merchant', 'directions_click', repeat('2', 32), null, '{}', now()),
  ('/x', 'zz-ps-b', 'merchant', 'page_view', repeat('3', 32), null, '{}', now()),
  ('/x', 'zz-ps-b', 'merchant', 'menu_view', repeat('3', 32), null, '{}', now()),        -- not a contact
  ('/join-us', null, 'join_us', 'whatsapp_click', repeat('4', 32), 'pricing_cta', '{}', now()), -- not a restaurant contact
  ('/', null, 'home', 'search', repeat('1', 32), ' Laksa ', '{"results": 0}', now()),
  ('/', null, 'home', 'search', repeat('2', 32), 'laksa', '{"results": 0}', now()),
  ('/', null, 'home', 'search', repeat('2', 32), 'nasi', '{"results": 3}', now()),
  ('/', null, 'home', 'search', repeat('2', 32), 'old style', '{}', now()),             -- before result counts
  ('/x', 'zz-ps-a', 'merchant', 'page_view', repeat('4', 32), null, '{}', now() - interval '10 days'),
  ('/x', 'zz-ps-a', 'merchant', 'phone_click', repeat('4', 32), null, '{}', now() - interval '10 days'),
  ('/x', 'zz-ps-a', 'merchant', 'page_view', repeat('4', 32), null, '{}', now() - interval '20 days'); -- outside both 7-day periods

-- Raw IPs and user agents are refused.
do $$
begin
  begin
    insert into public.page_views (path, event_type, ip) values ('/', 'page_view', '203.0.113.9');
    raise exception 'PERFORMANCE TEST FAILED: raw IP accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.page_views (path, event_type, user_agent) values ('/', 'page_view', 'Mozilla/5.0');
    raise exception 'PERFORMANCE TEST FAILED: user agent accepted';
  exception when check_violation then null;
  end;
end $$;

set local role service_role;

do $$
declare
  r jsonb;
  a jsonb;
begin
  r := public.admin_performance_summary(7);
  perform ps_test.ok((r ->> 'hasPrevious')::boolean, '7 days has a previous period');
  perform ps_test.ok((r #>> '{current,visitors}')::int = 3, 'visitors: distinct hashes of page views');
  perform ps_test.ok((r #>> '{current,pageViews}')::int = 4, 'page views: all public pages');
  perform ps_test.ok((r #>> '{current,restaurantViews}')::int = 3, 'restaurant views include the former slug');
  perform ps_test.ok((r #>> '{current,contacts}')::int = 2, 'contacts: WhatsApp + directions on restaurants only');
  perform ps_test.ok((r #>> '{previous,restaurantViews}')::int = 1 and (r #>> '{previous,contacts}')::int = 1, 'previous period');
  perform ps_test.ok(jsonb_array_length(r -> 'daily') = 7, 'one entry per day');
  perform ps_test.ok((select sum((e ->> 'contacts')::int) from jsonb_array_elements(r -> 'daily') e) = 2, 'daily contacts add up');

  select e into a from jsonb_array_elements(r -> 'restaurants') e where e ->> 'slug' = 'zz-ps-a';
  perform ps_test.ok((a ->> 'views')::int = 2 and (a ->> 'visitors')::int = 2 and (a ->> 'contacts')::int = 2
                     and (a ->> 'whatsapp')::int = 1 and (a ->> 'directions')::int = 1, 'restaurant A');
  perform ps_test.ok((r #>> '{restaurants,0,slug}') = 'zz-ps-a', 'ranked by views');
  perform ps_test.ok(jsonb_array_length(r -> 'restaurants') = 2, 'only restaurants with activity');

  perform ps_test.ok((r #>> '{searches,total}')::int = 4 and (r #>> '{searches,counted}')::int = 3
                     and (r #>> '{searches,noResults}')::int = 2, 'search totals');
  perform ps_test.ok(jsonb_array_length(r #> '{searches,noResultTerms}') = 1
                     and (r #>> '{searches,noResultTerms,0,term}') = 'laksa'
                     and (r #>> '{searches,noResultTerms,0,searches}')::int = 2
                     and (r #>> '{searches,noResultTerms,0,visitors}')::int = 2, 'no-result terms are trimmed and merged');
  perform ps_test.ok(r::text not like '%11111111%', 'no visitor hashes leave the database');

  r := public.admin_performance_summary(90);
  perform ps_test.ok(not (r ->> 'hasPrevious')::boolean and r -> 'previous' = 'null'::jsonb, '90 days has no previous period');
  perform ps_test.ok((r #>> '{current,restaurantViews}')::int = 5, '90 days includes older views');

  begin
    perform public.admin_performance_summary(14);
    raise exception 'PERFORMANCE TEST FAILED: range';
  exception when others then if sqlerrm not like 'VALIDATION_FAILED%' then raise; end if;
  end;
end $$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.admin_performance_summary(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_performance_summary(integer)', 'execute') then
    raise exception 'PERFORMANCE TEST FAILED: public can execute';
  end if;
end $$;

select 'ALL PERFORMANCE SUMMARY BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
