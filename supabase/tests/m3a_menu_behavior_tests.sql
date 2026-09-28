-- =====================================================================
-- M3a Owner menu: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927110000_merchant_menu. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-m3a-*).
-- =====================================================================
begin;

create schema m3a_test;
grant usage on schema m3a_test to public;
create function m3a_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'M3A TEST FAILED: %', label; end if; end $f$;
create function m3a_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'M3A TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'M3A TEST FAILED: % did not fail', label;
end $f$;
create function m3a_test.op(owner_id text, mid uuid, body jsonb, req uuid default gen_random_uuid()) returns jsonb
language sql as $f$ select public.merchant_menu_apply('owner', owner_id, mid, req, body) $f$;
grant execute on all functions in schema m3a_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000a3a01', 'zz-m3a-owner-a@example.test'),
  ('00000000-0000-4000-8000-0000000a3a02', 'zz-m3a-owner-b@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-0000000a3001', 'zz-m3a-a', 'ZZ M3A A', true, 'PUBLISHED', '+60111111111'),
  ('00000000-0000-4000-8000-0000000a3002', 'zz-m3a-b', 'ZZ M3A B', false, 'DRAFT', '+60122222222');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000a3001', '00000000-0000-4000-8000-0000000a3a01', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000a3002', '00000000-0000-4000-8000-0000000a3a02', 'owner', 'active');
insert into public.categories (id, merchant_id, name, sort_order) values
  ('00000000-0000-4000-8000-0000000a3c0b', '00000000-0000-4000-8000-0000000a3002', 'B mains', 0);

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000a3001';
  oa text := '00000000-0000-4000-8000-0000000a3a01';
  ob text := '00000000-0000-4000-8000-0000000a3a02';
  cat_b uuid := '00000000-0000-4000-8000-0000000a3c0b';
  r jsonb;
  c1 uuid;
  c2 uuid;
  p1 uuid;
  p2 uuid;
  req uuid := gen_random_uuid();
  stmt text := $s$select public.merchant_menu_apply('owner', %L, %L::uuid, gen_random_uuid(), %L::jsonb)$s$;
begin
  -- a public restaurant with no menu yet can still build one
  r := m3a_test.op(oa, a, '{"type": "create_category", "name": " Mains "}', req);
  c1 := (r ->> 'id')::uuid;
  perform m3a_test.ok(r ->> 'status' = 'applied' and r -> 'menu' -> 'categories' -> 0 ->> 'name' = 'Mains', 'create category (trimmed)');
  r := m3a_test.op(oa, a, '{"type": "create_category", "name": " Mains "}', req);
  perform m3a_test.ok((r ->> 'replayed')::boolean and jsonb_array_length(r -> 'menu' -> 'categories') = 1, 'replay creates nothing');
  r := m3a_test.op(oa, a, '{"type": "create_category", "name": "Drinks"}');
  c2 := (r ->> 'id')::uuid;

  -- dishes: 0 is a real price, null is none; discount rules
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'create_product', 'categoryId', c1, 'name', 'Nasi lemak', 'price', 0));
  p1 := (r ->> 'id')::uuid;
  perform m3a_test.ok((select price from public.products where id = p1) = 0, 'price 0 kept');
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'create_product', 'categoryId', c1, 'name', 'Teh tarik'));
  p2 := (r ->> 'id')::uuid;
  perform m3a_test.ok((select price from public.products where id = p2) is null, 'no price is null');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'create_product', 'categoryId', c1, 'name', 'X', 'price', 5, 'discountPrice', 6)), 'VALIDATION_FAILED', 'discount above price');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'create_product', 'categoryId', c1, 'name', 'X', 'discountPrice', 1)), 'VALIDATION_FAILED', 'discount without price');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'create_product', 'categoryId', c1, 'name', 'X', 'price', 1.234)), 'VALIDATION_FAILED', 'three decimals');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'create_product', 'categoryId', c1, 'name', 'X', 'price', '5')), 'VALIDATION_FAILED', 'price as text');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'create_product', 'categoryId', c1, 'name', '  ')), 'VALIDATION_FAILED', 'blank name');

  -- cross-restaurant ids are refused
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'create_product', 'categoryId', cat_b, 'name', 'X')), 'RESOURCE_NOT_FOUND', 'foreign category');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'move_product', 'id', p1, 'categoryId', cat_b, 'expectedCategoryId', c1)), 'RESOURCE_NOT_FOUND', 'move into foreign category');
  perform m3a_test.err(format(stmt, ob, a, '{"type": "create_category", "name": "Hack"}'), 'RESOURCE_NOT_FOUND', 'foreign Owner');

  -- field compare-and-set
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'update_product', 'id', p1, 'changes', jsonb_build_object('price', 12.5, 'isAvailable', false), 'expected', jsonb_build_object('price', 0, 'isAvailable', true)));
  perform m3a_test.ok(r ->> 'status' = 'applied' and (select price from public.products where id = p1) = 12.5 and not (select is_available from public.products where id = p1), 'update applies');
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'update_product', 'id', p1, 'changes', jsonb_build_object('price', 13), 'expected', jsonb_build_object('price', 0)));
  perform m3a_test.ok(r ->> 'status' = 'conflict' and r -> 'conflicts' -> 0 ->> 'field' = 'price' and (r -> 'conflicts' -> 0 -> 'current')::text = '12.50'
    and (select price from public.products where id = p1) = 12.5, 'stale expected -> conflict, nothing written');
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'update_product', 'id', p2, 'changes', jsonb_build_object('description', 'Sweet'), 'expected', jsonb_build_object('description', null)));
  perform m3a_test.ok(r ->> 'status' = 'applied', 'expected null matches an empty column');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'update_product', 'id', p1, 'changes', jsonb_build_object('image_url', 'x'), 'expected', jsonb_build_object('image_url', null))), 'VALIDATION_FAILED', 'image not editable here');

  -- move and reorder
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'move_product', 'id', p2, 'categoryId', c2, 'expectedCategoryId', c1));
  perform m3a_test.ok((select category_id from public.products where id = p2) = c2, 'move');
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'reorder_categories', 'ids', jsonb_build_array(c2, c1)));
  perform m3a_test.ok(r -> 'menu' -> 'categories' -> 0 ->> 'id' = c2::text, 'reorder categories');
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'reorder_categories', 'ids', jsonb_build_array(c2)));
  perform m3a_test.ok(r ->> 'status' = 'conflict', 'reorder must name every category');

  -- public minimum and category deletion
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'delete_category', 'id', c2)), 'VALIDATION_FAILED', 'category with dishes needs confirmation');
  r := m3a_test.op(oa, a, jsonb_build_object('type', 'delete_category', 'id', c2, 'withProducts', true));
  perform m3a_test.ok(not exists (select 1 from public.products where id = p2), 'delete category with dishes');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'delete_product', 'id', p1)), 'PUBLIC_MENU_MINIMUM', 'last dish of a public restaurant');
  perform m3a_test.err(format(stmt, oa, a, jsonb_build_object('type', 'delete_category', 'id', c1, 'withProducts', true)), 'PUBLIC_MENU_MINIMUM', 'last category of a public restaurant');

  -- suspended restaurant: Owner cannot edit the menu
  update public.merchants set platform_status = 'SUSPENDED' where id = a;
  perform m3a_test.err(format(stmt, oa, a, '{"type": "create_category", "name": "Late"}'), 'MERCHANT_SUSPENDED', 'suspended Owner');

  r := public.merchant_menu_read('owner', oa, a);
  perform m3a_test.ok(jsonb_array_length(r -> 'menu' -> 'products') = 1, 'read');
  perform m3a_test.err(format($s$select public.merchant_menu_read('owner', %L, %L::uuid)$s$, ob, a), 'RESOURCE_NOT_FOUND', 'foreign read');
end $$;

reset role;
set local role authenticated;
select m3a_test.err($q$select public.merchant_menu_read('admin', 'legacy_admin', '00000000-0000-4000-8000-0000000a3001')$q$, 'permission denied', 'authenticated cannot call');
reset role;

select 'ALL M3A MENU BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
