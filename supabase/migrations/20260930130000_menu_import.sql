-- =====================================================================
-- Admin menu import (CH 2026-09-30): add a whole menu read from photos in one step.
-- =====================================================================
-- CH asks a restaurant for photos of its printed menu, has Gemini turn them into BiteSite's
-- menu format (the prompt lives in lib/menu-import-core.mjs), checks the preview in Admin and
-- imports it. public.merchant_menu_import(actor, merchant, items) runs in one transaction:
--
--   items = [{ "name": "Rice", "dishes": [{ "name", "description"?, "price"? }] }]
--
-- - Categories are matched by name (trimmed, case-insensitive); missing ones are created at the
--   end of the menu, in the order given.
-- - A dish whose name already exists in that category is skipped, never changed: importing the
--   same photos twice adds nothing, and edits made in Admin are never overwritten.
-- - Text and price rules are the menu editor's own (private.merchant_menu_text / _price):
--   category 80 characters, dish 160, description 2000, price 0..100000 with 2 decimals, null =
--   no price. At most 60 categories and 1000 dishes per import.
-- - Admin only. Locked like every menu write (a restaurant pending review is frozen).
-- Returns counts plus the skipped dish names so the preview can say what happened.
-- Rollback: supabase/rollback/20260930130000_menu_import.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create or replace function public.merchant_menu_import(p_actor_type text, p_actor_id text, p_merchant_id uuid, p_items jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  c jsonb;
  d jsonb;
  v_cat uuid;
  v_cat_name text;
  v_dish_name text;
  v_order int;
  v_categories_created int := 0;
  v_dishes_created int := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'nothing to import');
  end if;
  if jsonb_array_length(p_items) > 60 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'at most 60 categories per import');
  end if;
  if (select sum(jsonb_array_length(coalesce(e -> 'dishes', '[]'::jsonb))) from jsonb_array_elements(p_items) e) > 1000 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'at most 1000 dishes per import');
  end if;

  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);

  for c in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'dishes') is distinct from 'array' then
      perform private.merchant_write_error('VALIDATION_FAILED', 'each category needs a name and a dishes list');
    end if;
    v_cat_name := private.merchant_menu_text(c -> 'name', 'Category name', 80, false);
    select id into v_cat from public.categories
     where merchant_id = m.id and lower(btrim(name)) = lower(v_cat_name)
     order by sort_order, created_at limit 1;
    if v_cat is null then
      insert into public.categories (merchant_id, name, sort_order)
      values (m.id, v_cat_name, coalesce((select max(sort_order) + 1 from public.categories where merchant_id = m.id), 0))
      returning id into v_cat;
      v_categories_created := v_categories_created + 1;
    end if;

    for d in select value from jsonb_array_elements(c -> 'dishes') loop
      if jsonb_typeof(d) <> 'object' then
        perform private.merchant_write_error('VALIDATION_FAILED', 'each dish must be an object');
      end if;
      v_dish_name := private.merchant_menu_text(d -> 'name', 'Dish name', 160, false);
      if exists (select 1 from public.products where merchant_id = m.id and category_id = v_cat and lower(btrim(name)) = lower(v_dish_name)) then
        v_skipped := v_skipped || jsonb_build_object('category', v_cat_name, 'name', v_dish_name);
        continue;
      end if;
      select coalesce(max(sort_order) + 1, 0) into v_order from public.products where category_id = v_cat;
      insert into public.products (merchant_id, category_id, name, description, price, sort_order)
      values (m.id, v_cat, v_dish_name,
              private.merchant_menu_text(d -> 'description', 'Description', 2000, true),
              private.merchant_menu_price(d -> 'price', 'Price'),
              v_order);
      v_dishes_created := v_dishes_created + 1;
    end loop;
    v_cat := null;
  end loop;

  return jsonb_build_object(
    'status', 'applied',
    'categoriesCreated', v_categories_created,
    'dishesCreated', v_dishes_created,
    'skipped', v_skipped);
end;
$$;

revoke all on function public.merchant_menu_import(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merchant_menu_import(text, text, uuid, jsonb) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.merchant_menu_import(text,text,uuid,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_menu_import(text,text,uuid,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.merchant_menu_import(text,text,uuid,jsonb)', 'execute') then
    raise exception 'Menu import self-check: wrong EXECUTE grants';
  end if;
end $$;

commit;
