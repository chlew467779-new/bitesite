-- =====================================================================
-- ShopeeFood / foodpanda links: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20261004110000_delivery_links. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-dlv-*).
-- =====================================================================
begin;

create schema dlv_test;
grant usage on schema dlv_test to public;
create function dlv_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'DELIVERY LINK TEST FAILED: %', label; end if; end $f$;
create function dlv_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'DELIVERY LINK TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'DELIVERY LINK TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema dlv_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000d1a1', 'zz-dlv-owner@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000d101', 'zz-dlv-a', 'ZZ DLV A', true, 'PUBLISHED', '+60111111111'),
  ('00000000-0000-4000-8000-00000000d102', 'zz-dlv-b', 'ZZ DLV B', false, 'DRAFT', '+60111111112');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d1a1', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000d101';
  b uuid := '00000000-0000-4000-8000-00000000d102';
  oa text := '00000000-0000-4000-8000-00000000d1a1';
  r jsonb;
  hash_before text;
  l1 uuid;
begin
  -- Host rules
  perform dlv_test.ok(private.merchant_link_problem('shopeefood', 'https://shopee.com.my/universal-link/now-food/shop/123') is null, 'shopee.com.my ok');
  perform dlv_test.ok(private.merchant_link_problem('shopeefood', 'https://shp.ee/abc123') is null, 'shp.ee ok');
  perform dlv_test.ok(private.merchant_link_problem('shopeefood', 'https://food.shopeefood.my/x') is null, 'shopeefood.my subdomain ok');
  perform dlv_test.ok(private.merchant_link_problem('shopeefood', 'https://shopee.com.my.evil.io/x') = 'host_shopeefood', 'shopee look-alike refused');
  perform dlv_test.ok(private.merchant_link_problem('shopeefood', 'https://food.grab.com/x') = 'host_shopeefood', 'grab link is not shopee');
  perform dlv_test.ok(private.merchant_link_problem('foodpanda', 'https://www.foodpanda.my/restaurant/s7tg/zz') is null, 'foodpanda.my ok');
  perform dlv_test.ok(private.merchant_link_problem('foodpanda', 'https://www.foodpanda.sg/restaurant/x/zz') is null, 'foodpanda.sg ok');
  perform dlv_test.ok(private.merchant_link_problem('foodpanda', 'https://notfoodpanda.my/x') = 'host_foodpanda', 'foodpanda look-alike refused');
  perform dlv_test.ok(private.merchant_link_problem('foodpanda', 'http://www.foodpanda.my/x') = 'https_only', 'http refused');
  perform dlv_test.ok(private.merchant_link_problem('grabfood', 'https://food.grab.com/my/en/restaurant/x') is null, 'grab still ok');

  -- Adding nothing leaves the review hash unchanged
  hash_before := private.merchant_review_hash(private.merchant_review_content((select m from public.merchants m where m.id = a)));
  perform dlv_test.ok(not (private.merchant_review_content((select m from public.merchants m where m.id = a)) ? 'shopeefood'), 'no key when unset');

  -- Owner asks, Admin approves, row appears
  r := public.merchant_link_request_submit('owner', oa, a, gen_random_uuid(), 'shopeefood', 'https://shopee.com.my/universal-link/now-food/shop/1');
  l1 := (r ->> 'linkRequestId')::uuid;
  perform dlv_test.ok(not exists (select 1 from public.merchant_external_links where merchant_id = a), 'nothing public before approval');
  r := public.merchant_link_review('admin', 'legacy_admin', gen_random_uuid(), l1, 'approve', null);
  perform dlv_test.ok((select url from public.merchant_external_links where merchant_id = a and link_type = 'shopeefood') = 'https://shopee.com.my/universal-link/now-food/shop/1', 'approved shopeefood stored');
  perform dlv_test.ok(private.merchant_review_hash(private.merchant_review_content((select m from public.merchants m where m.id = a))) <> hash_before, 'set link changes the hash');
  perform dlv_test.err(format($s$select public.merchant_link_request_submit('owner', %L, %L::uuid, gen_random_uuid(), 'foodpanda', 'https://evil.io/x')$s$, oa, a), 'INVALID_LINK', 'bad foodpanda refused');

  -- Admin direct set and removal
  r := public.merchant_link_admin_set('admin', 'legacy_admin', a, gen_random_uuid(), 'foodpanda', 'https://www.foodpanda.my/restaurant/zz/a', null);
  perform dlv_test.ok(r ->> 'status' = 'applied', 'admin set foodpanda');
  r := public.merchant_link_admin_set('admin', 'legacy_admin', b, gen_random_uuid(), 'foodpanda', 'https://www.foodpanda.my/restaurant/zz/b', null);
  r := public.merchant_links_read('owner', oa, a);
  perform dlv_test.ok(r -> 'links' ? 'shopeefood' and r -> 'links' ->> 'foodpanda' = 'https://www.foodpanda.my/restaurant/zz/a' and (r -> 'links' -> 'grabfood') = 'null'::jsonb, 'read has the new keys');
  r := public.merchant_link_admin_set('admin', 'legacy_admin', a, gen_random_uuid(), 'shopeefood', null, 'https://shopee.com.my/universal-link/now-food/shop/1');
  perform dlv_test.ok(not exists (select 1 from public.merchant_external_links where merchant_id = a and link_type = 'shopeefood'), 'removal deletes the row');
  perform dlv_test.ok(private.merchant_link_current(a, 'grabfood') is null, 'grabfood untouched');
end $$;

reset role;
set local role anon;
select dlv_test.ok((select count(*) from public.merchant_external_links where merchant_id = '00000000-0000-4000-8000-00000000d101' and link_type = 'foodpanda') = 1, 'anon sees the public restaurant''s foodpanda link');
select dlv_test.ok((select count(*) from public.merchant_external_links where merchant_id = '00000000-0000-4000-8000-00000000d102') = 0, 'anon does not see a draft restaurant''s link');
select dlv_test.err($q$select public.merchant_links_read('admin', 'legacy_admin', '00000000-0000-4000-8000-00000000d101')$q$, 'permission denied', 'anon cannot read links');
reset role;

select dlv_test.err($q$insert into public.merchant_external_links (merchant_id, link_type, url) values ('00000000-0000-4000-8000-00000000d101', 'deliveroo', 'https://x.example.com')$q$, 'new row for relation', 'unknown link type refused');

select 'ALL DELIVERY LINK BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
