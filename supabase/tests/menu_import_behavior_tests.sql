-- =====================================================================
-- Admin menu import: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260930130000_menu_import. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema mi_test;
grant usage on schema mi_test to public;
create function mi_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'MENU IMPORT TEST FAILED: %', label; end if; end $f$;
create function mi_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'MENU IMPORT TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'MENU IMPORT TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema mi_test to public;

insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000f701', 'zz-mi-a', 'ZZ MI A', true, 'PUBLISHED', '+60111111111');
insert into public.categories (id, merchant_id, name, sort_order) values ('00000000-0000-4000-8000-00000000f7c1', '00000000-0000-4000-8000-00000000f701', 'Rice', 0);
insert into public.products (merchant_id, category_id, name, price, description) values
  ('00000000-0000-4000-8000-00000000f701', '00000000-0000-4000-8000-00000000f7c1', 'Nasi Goreng', 9, 'Edited by Admin');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000f701';
  items jsonb := '[
    {"name": " rice ", "dishes": [
      {"name": "Nasi Lemak", "price": 12.5, "description": null},
      {"name": "NASI GORENG", "price": 10, "description": "From the photo"},
      {"name": "nasi lemak", "price": 12.5}
    ]},
    {"name": "Drinks", "dishes": [{"name": "Teh Tarik (Hot)", "price": 2.8}, {"name": "Air Kosong", "price": null}]}
  ]';
  r jsonb;
begin
  r := public.merchant_menu_import('admin', 'legacy_admin', a, items);
  perform mi_test.ok((r ->> 'dishesCreated')::int = 3 and (r ->> 'categoriesCreated')::int = 1, 'counts: 3 dishes, 1 new section');
  perform mi_test.ok(jsonb_array_length(r -> 'skipped') = 2, 'existing dish and repeat in the same import are skipped');
  perform mi_test.ok((select count(*) from public.categories where merchant_id = a) = 2, 'Rice matched by name, Drinks created');
  perform mi_test.ok((select description from public.products where merchant_id = a and name = 'Nasi Goreng') = 'Edited by Admin'
                     and (select price from public.products where merchant_id = a and name = 'Nasi Goreng') = 9, 'existing dish never changed');
  perform mi_test.ok((select price from public.products where merchant_id = a and name = 'Air Kosong') is null, 'no price stays null');
  perform mi_test.ok((select array_agg(name order by sort_order) from public.products where merchant_id = a and category_id = '00000000-0000-4000-8000-00000000f7c1')
                     = array['Nasi Goreng', 'Nasi Lemak'], 'new dishes go after existing ones');

  r := public.merchant_menu_import('admin', 'legacy_admin', a, items);
  perform mi_test.ok((r ->> 'dishesCreated')::int = 0 and (r ->> 'categoriesCreated')::int = 0, 'importing again adds nothing');

  -- One bad dish stops the whole import (one transaction).
  perform mi_test.err(format($s$select public.merchant_menu_import('admin', 'legacy_admin', %L::uuid, '[{"name":"Noodles","dishes":[{"name":"Mee Goreng","price":8},{"name":"Laksa","price":-1}]}]'::jsonb)$s$, a),
    'VALIDATION_FAILED', 'negative price');
  perform mi_test.ok(not exists (select 1 from public.categories where merchant_id = a and name = 'Noodles'), 'nothing kept from a failed import');
  perform mi_test.err(format($s$select public.merchant_menu_import('admin', 'legacy_admin', %L::uuid, '[{"name":"X","dishes":[{"name":"Y","price":"12"}]}]'::jsonb)$s$, a), 'VALIDATION_FAILED', 'price must be a number');
  perform mi_test.err(format($s$select public.merchant_menu_import('admin', 'legacy_admin', %L::uuid, '[]'::jsonb)$s$, a), 'VALIDATION_FAILED', 'empty import');
  perform mi_test.err(format($s$select public.merchant_menu_import('admin', 'legacy_admin', %L::uuid, '[{"name":"X"}]'::jsonb)$s$, a), 'VALIDATION_FAILED', 'section without dishes list');
  perform mi_test.err(format($s$select public.merchant_menu_import('owner', '00000000-0000-4000-8000-000000000001', %L::uuid, '[{"name":"X","dishes":[]}]'::jsonb)$s$, a), 'OPERATION_FORBIDDEN', 'Admin only');
  perform mi_test.err($s$select public.merchant_menu_import('admin', 'legacy_admin', '00000000-0000-4000-8000-00000000ffff', '[{"name":"X","dishes":[]}]'::jsonb)$s$, 'RESOURCE_NOT_FOUND', 'unknown restaurant');
end $$;

reset role;
do $$
begin
  if has_function_privilege('anon', 'public.merchant_menu_import(text,text,uuid,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_menu_import(text,text,uuid,jsonb)', 'execute') then
    raise exception 'MENU IMPORT TEST FAILED: public can execute';
  end if;
end $$;

select 'ALL MENU IMPORT BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
