-- =====================================================================
-- M3a: Owner menu editing (categories and dishes) through one idempotent, locked RPC.
-- =====================================================================
-- public.merchant_menu_apply(actor, merchant, request_id, op) runs one menu operation in one
-- transaction after private.lock_merchant_for_actor (Owner membership rechecked under lock;
-- suspended/archived refuse Owner writes; a restaurant pending review is frozen):
--
--   create_category {name}                    rename_category {id, name, expectedName}
--   reorder_categories {ids}                  delete_category {id, withProducts}
--   create_product {categoryId, name, description?, price?, discountPrice?, isAvailable?,
--                   isFeatured?, showPrices?}
--   update_product {id, changes, expected}    field-level compare-and-set (FIELD_CONFLICT)
--   move_product {id, categoryId, expectedCategoryId}
--   reorder_products {categoryId, ids}        delete_product {id}
--
-- Rules: every id must belong to this restaurant (a dish never moves into another restaurant's
-- category); reorder lists must name exactly the current members; price and discount are
-- 0..100000 with 2 decimals, null means "no price" (0 is a real price); a discount needs a price
-- and cannot exceed it; deleting a category that still has dishes needs withProducts = true;
-- a public restaurant keeps at least one dish in a category (PUBLIC_MENU_MINIMUM). Sold-out
-- dishes (is_available = false) stay on the page, so they count. Dish images are not changed here.
-- The same requestId replays the result for 7 days; a reused id with another op is refused.
-- Admin keeps its existing menu routes; the RPC also accepts the Admin principal.
--
-- Local first; staging and production each need CH approval, after 20260927100000.
-- Rollback: supabase/rollback/20260927110000_merchant_menu.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create or replace function private.merchant_menu_snapshot(p_merchant_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sortOrder', c.sort_order) order by c.sort_order, c.created_at, c.id)
        from public.categories c where c.merchant_id = p_merchant_id), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'categoryId', p.category_id, 'name', p.name, 'description', p.description,
               'price', p.price, 'discountPrice', p.discount_price, 'imageUrl', p.image_url,
               'isAvailable', coalesce(p.is_available, true), 'isFeatured', coalesce(p.is_featured, false),
               'showPrices', coalesce(p.show_prices, true), 'sortOrder', p.sort_order)
             order by p.sort_order, p.created_at, p.id)
        from public.products p where p.merchant_id = p_merchant_id), '[]'::jsonb)
  );
$$;

create or replace function private.merchant_menu_has_minimum(p_merchant_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.products p join public.categories c on c.id = p.category_id
     where p.merchant_id = p_merchant_id and c.merchant_id = p_merchant_id);
$$;

-- Text: trimmed, 1..max characters (or null when allowed).
create or replace function private.merchant_menu_text(p_value jsonb, p_label text, p_max int, p_nullable boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    if p_nullable then return null; end if;
    perform private.merchant_write_error('VALIDATION_FAILED', p_label || ' is required');
  end if;
  if jsonb_typeof(p_value) <> 'string' then
    perform private.merchant_write_error('VALIDATION_FAILED', p_label || ' must be text');
  end if;
  v := btrim(p_value #>> '{}');
  if v = '' then
    if p_nullable then return null; end if;
    perform private.merchant_write_error('VALIDATION_FAILED', p_label || ' is required');
  end if;
  if char_length(v) > p_max then
    perform private.merchant_write_error('VALIDATION_FAILED', p_label || ' is longer than ' || p_max);
  end if;
  return v;
end;
$$;

-- Price: null = no price; otherwise 0..100000 with at most 2 decimals.
create or replace function private.merchant_menu_price(p_value jsonb, p_label text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return null; end if;
  if jsonb_typeof(p_value) <> 'number' then
    perform private.merchant_write_error('VALIDATION_FAILED', p_label || ' must be a number');
  end if;
  v := (p_value #>> '{}')::numeric;
  if v < 0 or v > 100000 or v <> round(v, 2) then
    perform private.merchant_write_error('VALIDATION_FAILED', p_label || ' must be between 0 and 100000 with at most 2 decimals');
  end if;
  return v;
end;
$$;

create or replace function private.merchant_menu_bool(p_value jsonb, p_label text, p_default boolean)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null then return p_default; end if;
  if jsonb_typeof(p_value) <> 'boolean' then
    perform private.merchant_write_error('VALIDATION_FAILED', p_label || ' must be true or false');
  end if;
  return (p_value #>> '{}')::boolean;
end;
$$;

-- Parse a jsonb array of uuids (no duplicates).
create or replace function private.merchant_menu_ids(p_value jsonb)
returns uuid[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  out_ids uuid[];
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 500 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'ids must be a list');
  end if;
  begin
    select coalesce(array_agg(e::uuid order by ord), '{}') into out_ids from jsonb_array_elements_text(p_value) with ordinality as t(e, ord);
  exception when invalid_text_representation then
    perform private.merchant_write_error('VALIDATION_FAILED', 'ids must be ids');
  end;
  if cardinality(out_ids) <> (select count(distinct x) from unnest(out_ids) x) then
    perform private.merchant_write_error('VALIDATION_FAILED', 'duplicate ids');
  end if;
  return out_ids;
end;
$$;

create or replace function private.merchant_menu_uuid(p_value jsonb, p_label text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform private.merchant_write_error('VALIDATION_FAILED', p_label || ' must be an id');
  end if;
  return (p_value #>> '{}')::uuid;
end;
$$;

create or replace function public.merchant_menu_read(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
begin
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
  if not found then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND');
  end if;
  return jsonb_build_object('menu', private.merchant_menu_snapshot(m.id), 'public', private.merchant_is_public(m));
end;
$$;

create or replace function public.merchant_menu_apply(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_request_id  uuid,
  p_op          jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_operation constant text := 'merchant_menu';
  v_type text;
  v_hash text;
  v_result jsonb;
  v_ids uuid[];
  v_current uuid[];
  v_id uuid;
  v_cat uuid;
  v_count int;
  v_changes jsonb;
  v_expected jsonb;
  v_key text;
  v_conflicts jsonb := '[]'::jsonb;
  v_cur jsonb;
  v_had_minimum boolean;
  m public.merchants;
  cat public.categories;
  prod public.products;
  idem public.request_idempotency;
  col constant jsonb := '{"name": "name", "description": "description", "price": "price", "discountPrice": "discount_price", "isAvailable": "is_available", "isFeatured": "is_featured", "showPrices": "show_prices"}';
begin
  if p_request_id is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required');
  end if;
  if p_op is null or jsonb_typeof(p_op) <> 'object' then
    perform private.merchant_write_error('VALIDATION_FAILED', 'op must be an object');
  end if;
  v_type := p_op ->> 'type';
  if v_type is null or v_type not in ('create_category', 'rename_category', 'reorder_categories', 'delete_category',
                                      'create_product', 'update_product', 'move_product', 'reorder_products', 'delete_product') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unknown menu operation');
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_operation, 'merchant', p_merchant_id, 'body', p_op)::text, 'UTF8')), 'hex');

  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);

  select * into idem from public.request_idempotency ri
   where ri.actor_type = p_actor_type and ri.actor_id = p_actor_id and ri.merchant_id = p_merchant_id
     and ri.operation = v_operation and ri.request_id = p_request_id;
  if found then
    if idem.expires_at <= now() then
      perform private.merchant_write_error('IDEMPOTENCY_KEY_EXPIRED');
    end if;
    if idem.payload_hash <> v_hash then
      perform private.merchant_write_error('IDEMPOTENCY_KEY_REUSED');
    end if;
    return idem.result || jsonb_build_object('replayed', true, 'menu', private.merchant_menu_snapshot(m.id));
  end if;
  v_had_minimum := private.merchant_menu_has_minimum(m.id);

  if v_type = 'create_category' then
    insert into public.categories (merchant_id, name, sort_order)
    values (m.id, private.merchant_menu_text(p_op -> 'name', 'Category name', 80, false),
            coalesce((select max(sort_order) + 1 from public.categories where merchant_id = m.id), 0))
    returning id into v_id;

  elsif v_type = 'rename_category' then
    v_id := private.merchant_menu_uuid(p_op -> 'id', 'id');
    select * into cat from public.categories where id = v_id and merchant_id = m.id for update;
    if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'category'); end if;
    if cat.name is distinct from (p_op ->> 'expectedName') then
      v_conflicts := jsonb_build_array(jsonb_build_object('field', 'name', 'current', cat.name));
    else
      update public.categories set name = private.merchant_menu_text(p_op -> 'name', 'Category name', 80, false) where id = v_id;
    end if;

  elsif v_type = 'reorder_categories' then
    v_ids := private.merchant_menu_ids(p_op -> 'ids');
    select coalesce(array_agg(id), '{}') into v_current from (select id from public.categories where merchant_id = m.id for update) c;
    if cardinality(v_ids) <> cardinality(v_current) or not (v_ids <@ v_current) then
      v_conflicts := jsonb_build_array(jsonb_build_object('field', 'order'));
    else
      update public.categories c set sort_order = t.ord - 1
        from unnest(v_ids) with ordinality as t(id, ord) where c.id = t.id and c.merchant_id = m.id;
    end if;

  elsif v_type = 'delete_category' then
    v_id := private.merchant_menu_uuid(p_op -> 'id', 'id');
    select * into cat from public.categories where id = v_id and merchant_id = m.id for update;
    if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'category'); end if;
    select count(*) into v_count from public.products where category_id = v_id;
    if v_count > 0 and coalesce((p_op ->> 'withProducts')::boolean, false) is not true then
      perform private.merchant_write_error('VALIDATION_FAILED', 'category_has_products');
    end if;
    delete from public.products where category_id = v_id and merchant_id = m.id;
    delete from public.categories where id = v_id;

  elsif v_type = 'create_product' then
    v_cat := private.merchant_menu_uuid(p_op -> 'categoryId', 'categoryId');
    perform 1 from public.categories where id = v_cat and merchant_id = m.id for update;
    if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'category'); end if;
    insert into public.products (merchant_id, category_id, name, description, price, discount_price, is_available, is_featured, show_prices, sort_order)
    values (m.id, v_cat,
            private.merchant_menu_text(p_op -> 'name', 'Dish name', 160, false),
            private.merchant_menu_text(p_op -> 'description', 'Description', 2000, true),
            private.merchant_menu_price(p_op -> 'price', 'Price'),
            private.merchant_menu_price(p_op -> 'discountPrice', 'Discount price'),
            private.merchant_menu_bool(p_op -> 'isAvailable', 'isAvailable', true),
            private.merchant_menu_bool(p_op -> 'isFeatured', 'isFeatured', false),
            private.merchant_menu_bool(p_op -> 'showPrices', 'showPrices', true),
            coalesce((select max(sort_order) + 1 from public.products where category_id = v_cat), 0))
    returning * into prod;

  elsif v_type = 'update_product' then
    v_id := private.merchant_menu_uuid(p_op -> 'id', 'id');
    v_changes := p_op -> 'changes';
    v_expected := p_op -> 'expected';
    if jsonb_typeof(v_changes) is distinct from 'object' or jsonb_typeof(v_expected) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(v_changes)) = 0 then
      perform private.merchant_write_error('VALIDATION_FAILED', 'changes and expected are required');
    end if;
    for v_key in select jsonb_object_keys(v_changes) loop
      if not (col ? v_key) or not (v_expected ? v_key) then
        perform private.merchant_write_error('VALIDATION_FAILED', 'unknown or unexpected field ' || v_key);
      end if;
    end loop;
    select * into prod from public.products where id = v_id and merchant_id = m.id for update;
    if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'product'); end if;
    for v_key in select jsonb_object_keys(v_changes) loop
      v_cur := coalesce(case v_key
            when 'name' then to_jsonb(prod.name)
            when 'description' then to_jsonb(prod.description)
            when 'price' then to_jsonb(prod.price)
            when 'discountPrice' then to_jsonb(prod.discount_price)
            when 'isAvailable' then to_jsonb(coalesce(prod.is_available, true))
            when 'isFeatured' then to_jsonb(coalesce(prod.is_featured, false))
            when 'showPrices' then to_jsonb(coalesce(prod.show_prices, true))
          end, 'null'::jsonb);
      if v_cur is distinct from (v_expected -> v_key) then
        v_conflicts := v_conflicts || jsonb_build_object('field', v_key, 'current', v_cur);
      end if;
    end loop;
    if jsonb_array_length(v_conflicts) = 0 then
      if v_changes ? 'name' then prod.name := private.merchant_menu_text(v_changes -> 'name', 'Dish name', 160, false); end if;
      if v_changes ? 'description' then prod.description := private.merchant_menu_text(v_changes -> 'description', 'Description', 2000, true); end if;
      if v_changes ? 'price' then prod.price := private.merchant_menu_price(v_changes -> 'price', 'Price'); end if;
      if v_changes ? 'discountPrice' then prod.discount_price := private.merchant_menu_price(v_changes -> 'discountPrice', 'Discount price'); end if;
      if v_changes ? 'isAvailable' then prod.is_available := private.merchant_menu_bool(v_changes -> 'isAvailable', 'isAvailable', true); end if;
      if v_changes ? 'isFeatured' then prod.is_featured := private.merchant_menu_bool(v_changes -> 'isFeatured', 'isFeatured', false); end if;
      if v_changes ? 'showPrices' then prod.show_prices := private.merchant_menu_bool(v_changes -> 'showPrices', 'showPrices', true); end if;
      update public.products
         set name = prod.name, description = prod.description, price = prod.price, discount_price = prod.discount_price,
             is_available = prod.is_available, is_featured = prod.is_featured, show_prices = prod.show_prices
       where id = v_id;
    end if;

  elsif v_type = 'move_product' then
    v_id := private.merchant_menu_uuid(p_op -> 'id', 'id');
    v_cat := private.merchant_menu_uuid(p_op -> 'categoryId', 'categoryId');
    select * into prod from public.products where id = v_id and merchant_id = m.id for update;
    if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'product'); end if;
    perform 1 from public.categories where id = v_cat and merchant_id = m.id for update;
    if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'category'); end if;
    if prod.category_id::text is distinct from (p_op ->> 'expectedCategoryId') then
      v_conflicts := jsonb_build_array(jsonb_build_object('field', 'categoryId', 'current', prod.category_id));
    elsif prod.category_id is distinct from v_cat then
      update public.products set category_id = v_cat,
             sort_order = coalesce((select max(sort_order) + 1 from public.products where category_id = v_cat), 0)
       where id = v_id;
    end if;

  elsif v_type = 'reorder_products' then
    v_cat := private.merchant_menu_uuid(p_op -> 'categoryId', 'categoryId');
    perform 1 from public.categories where id = v_cat and merchant_id = m.id for update;
    if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'category'); end if;
    v_ids := private.merchant_menu_ids(p_op -> 'ids');
    select coalesce(array_agg(id), '{}') into v_current from (select id from public.products where category_id = v_cat and merchant_id = m.id for update) p;
    if cardinality(v_ids) <> cardinality(v_current) or not (v_ids <@ v_current) then
      v_conflicts := jsonb_build_array(jsonb_build_object('field', 'order'));
    else
      update public.products p set sort_order = t.ord - 1
        from unnest(v_ids) with ordinality as t(id, ord) where p.id = t.id and p.merchant_id = m.id;
    end if;

  elsif v_type = 'delete_product' then
    v_id := private.merchant_menu_uuid(p_op -> 'id', 'id');
    delete from public.products where id = v_id and merchant_id = m.id;
    if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'product'); end if;
  end if;

  if jsonb_array_length(v_conflicts) > 0 then
    v_result := jsonb_build_object('status', 'conflict', 'type', v_type, 'conflicts', v_conflicts);
    insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
    values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'conflict', v_result, now() + interval '7 days');
    return v_result || jsonb_build_object('replayed', false, 'menu', private.merchant_menu_snapshot(m.id));
  end if;

  -- A discount needs a price and cannot exceed it (the dish this op created or changed only, so
  -- older data on other dishes never blocks an edit).
  if v_type in ('create_product', 'update_product') and prod.discount_price is not null
     and (prod.price is null or prod.discount_price > prod.price) then
    perform private.merchant_write_error('VALIDATION_FAILED', 'discount_price');
  end if;
  -- A public restaurant that had a displayable dish keeps one (a restaurant still building its
  -- first menu is not blocked).
  if v_had_minimum and private.merchant_is_public(m) and not private.merchant_menu_has_minimum(m.id) then
    perform private.merchant_write_error('PUBLIC_MENU_MINIMUM');
  end if;

  v_result := jsonb_build_object('status', 'applied', 'type', v_type, 'id', coalesce(v_id, prod.id));
  insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
  values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'applied', v_result, now() + interval '7 days');
  return v_result || jsonb_build_object('replayed', false, 'menu', private.merchant_menu_snapshot(m.id));
end;
$$;

revoke all on function public.merchant_menu_read(text, text, uuid) from public, anon, authenticated;
revoke all on function public.merchant_menu_apply(text, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merchant_menu_read(text, text, uuid) to service_role;
grant execute on function public.merchant_menu_apply(text, text, uuid, uuid, jsonb) to service_role;
revoke all on function private.merchant_menu_snapshot(uuid) from public, anon, authenticated;
revoke all on function private.merchant_menu_has_minimum(uuid) from public, anon, authenticated;
revoke all on function private.merchant_menu_text(jsonb, text, int, boolean) from public, anon, authenticated;
revoke all on function private.merchant_menu_price(jsonb, text) from public, anon, authenticated;
revoke all on function private.merchant_menu_bool(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function private.merchant_menu_ids(jsonb) from public, anon, authenticated;
revoke all on function private.merchant_menu_uuid(jsonb, text) from public, anon, authenticated;
grant execute on function private.merchant_menu_snapshot(uuid) to service_role;
grant execute on function private.merchant_menu_has_minimum(uuid) to service_role;
grant execute on function private.merchant_menu_text(jsonb, text, int, boolean) to service_role;
grant execute on function private.merchant_menu_price(jsonb, text) to service_role;
grant execute on function private.merchant_menu_bool(jsonb, text, boolean) to service_role;
grant execute on function private.merchant_menu_ids(jsonb) to service_role;
grant execute on function private.merchant_menu_uuid(jsonb, text) to service_role;

do $$
declare
  fn text;
begin
  foreach fn in array array['public.merchant_menu_read(text,text,uuid)', 'public.merchant_menu_apply(text,text,uuid,uuid,jsonb)'] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'M3a self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
end $$;

commit;
