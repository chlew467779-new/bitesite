-- =====================================================================
-- Owner amenities / occasion: BEHAVIOUR tests. Needs migrations through
-- 20261003140000_owner_amenities_occasion. Runs inside the caller's transaction; wrap in
-- begin ... rollback.
-- =====================================================================
create schema am_test;
create function am_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'AMENITIES TEST FAILED: %', label; end if; end $f$;
create function am_test.patch(p_actor text, p_actor_id text, p_mid uuid, p_path text, p_target text, p_value jsonb) returns jsonb
language plpgsql as $f$
declare m public.merchants;
begin
  select * into m from public.merchants where id = p_mid;
  return public.merchant_field_patch(p_actor, p_actor_id, p_mid, gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('path', p_path,
      'expected', private.merchant_field_snapshot(m, 'tag_array', p_target), 'value', p_value)));
end $f$;

select am_test.ok((select owner_writable and admin_writable and max_length = 5 from private.merchant_field_registry() where path = 'tags.amenities'), 'amenities row');
select am_test.ok((select owner_writable and admin_writable and max_length = 3 from private.merchant_field_registry() where path = 'tags.occasion'), 'occasion row');
select am_test.ok((select not owner_writable from private.merchant_field_registry() where path = 'presentation.layout'), 'layout stays Admin-only');
select am_test.ok((select owner_writable from private.merchant_field_registry() where path = 'tags.payment'), 'payment kept');

-- A synthetic Owner and restaurant, so the test does not depend on existing data.
do $$
declare uid uuid := gen_random_uuid(); mid uuid := gen_random_uuid(); res jsonb;
begin
  insert into auth.users (id, email) values (uid, 'am-test-' || uid || '@example.test');
  insert into public.merchants (id, slug, name, is_published, platform_status) values (mid, 'am-test-' || left(mid::text, 8), 'AM Test', true, 'PUBLISHED');
  insert into public.merchant_memberships (merchant_id, user_id, role, status) values (mid, uid, 'owner', 'active');

  res := am_test.patch('owner', uid::text, mid, 'tags.amenities', 'amenities', '["Halal", "WiFi"]');
  perform am_test.ok(res ->> 'status' = 'applied', 'owner amenities write: ' || coalesce(res ->> 'status', res::text));
  perform am_test.ok((select amenities from public.merchants where id = mid) = array['Halal', 'WiFi'], 'amenities written');

  res := am_test.patch('owner', uid::text, mid, 'tags.occasion', 'occasion', '["Family Friendly"]');
  perform am_test.ok(res ->> 'status' = 'applied', 'owner occasion write: ' || coalesce(res ->> 'status', res::text));
  perform am_test.ok((select occasion from public.merchants where id = mid) = array['Family Friendly'], 'occasion written');

  begin
    perform am_test.patch('owner', uid::text, mid, 'tags.occasion', 'occasion', '["A", "B", "C", "D"]');
    raise exception 'AMENITIES TEST FAILED: more than 3 occasions accepted';
  exception when others then
    if sqlerrm like 'AMENITIES TEST FAILED%' then raise; end if;
  end;

  -- Another account cannot write this restaurant.
  begin
    perform am_test.patch('owner', gen_random_uuid()::text, mid, 'tags.amenities', 'amenities', '["Parking"]');
    raise exception 'AMENITIES TEST FAILED: a stranger wrote amenities';
  exception when others then
    if sqlerrm like 'AMENITIES TEST FAILED%' then raise; end if;
  end;
  perform am_test.ok((select amenities from public.merchants where id = mid) = array['Halal', 'WiFi'], 'stranger write left nothing');
end $$;

select 'owner amenities behaviour tests passed' as result;
