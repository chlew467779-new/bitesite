-- =====================================================================
-- BiteSite — SYNTHETIC test data for STAGING ONLY
-- =====================================================================
-- Every row is fake and prefixed "zz-sec-test-" / "ZZ ". No real merchants,
-- customers, IPs or user data. Never run this on production.
-- =====================================================================

do $$
begin
  -- Refuse to run if the database holds anything that is not synthetic.
  if exists (select 1 from public.merchants where slug not like 'zz-sec-test-%') then
    raise exception 'Refusing to seed: non-synthetic merchants exist (is this production?)';
  end if;
end $$;

insert into public.merchants (id, slug, name, tagline, description, cuisine_type, area, whatsapp, operating_hours, is_published, status, latitude, longitude)
values
  ('00000000-0000-4000-8000-000000000001', 'zz-sec-test-published', 'ZZ Published Test Cafe', 'synthetic', 'Synthetic published merchant', 'Cafe', 'Test Area', '60100000001',
   '{"monday":"9am - 5pm","tuesday":"9am - 5pm","wednesday":"9am - 5pm","thursday":"9am - 5pm","friday":"9am - 5pm","saturday":"9am - 5pm","sunday":"9am - 5pm"}'::jsonb, true, 'active', 3.139, 101.687),
  ('00000000-0000-4000-8000-000000000002', 'zz-sec-test-draft', 'ZZ Draft Test Cafe', 'synthetic', 'Synthetic UNPUBLISHED merchant (must be invisible to anon)', 'Cafe', 'Test Area', '60100000002',
   '{}'::jsonb, false, 'active', 3.140, 101.688)
on conflict (id) do nothing;

insert into public.categories (id, merchant_id, name, sort_order) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 'ZZ Published Category', 1),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000002', 'ZZ Draft Category', 1)
on conflict (id) do nothing;

insert into public.products (id, merchant_id, category_id, name, price, is_available) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1', 'ZZ Published Product', 1.00, true),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000c2', 'ZZ Draft Product', 2.00, true)
on conflict (id) do nothing;

insert into public.events (id, merchant_id, title, date) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000001', 'ZZ Published Event', current_date + 7)
on conflict (id) do nothing;

insert into public.articles (id, slug, title, content, category, merchant_slug, published) values
  ('00000000-0000-4000-8000-0000000000a1', 'zz-sec-test-story-published', 'ZZ Published Story', 'synthetic body', 'Test', 'zz-sec-test-published', true),
  ('00000000-0000-4000-8000-0000000000a2', 'zz-sec-test-story-draft',     'ZZ Draft Story',     'synthetic body (must be invisible to anon)', 'Test', 'zz-sec-test-published', false)
on conflict (id) do nothing;

insert into public.merchant_stats (slug, view_count) values ('zz-sec-test-published', 3)
on conflict (slug) do nothing;

insert into public.settings (key, value, description) values
  ('site_title',        'ZZ Staging BiteSite',           'synthetic'),
  ('site_description',  'Synthetic staging description', 'synthetic'),
  ('contact_email',     'zz-test@example.invalid',       'synthetic'),
  ('contact_phone',     '+60 10-000 0000',               'synthetic'),
  ('whatsapp_number',   '60100000000',                   'synthetic'),
  ('footer_text',       'ZZ staging footer',             'synthetic'),
  ('zz_private_test_key', 'must-not-be-public',          'NOT in the public allow-list: anon must not see this row')
on conflict (key) do nothing;

-- rows that only the server may ever touch (anon must get "permission denied"):
insert into public.page_views (slug, path, page_type, event_type, ip, country, city, device_type)
values ('zz-sec-test-published', '/store/zz-sec-test-published', 'merchant', 'page_view', '203.0.113.7', 'MY', 'Kuala Lumpur', 'mobile');
insert into public.login_attempts (ip, attempt_count) values ('203.0.113.8', 1)
on conflict (ip) do nothing;
