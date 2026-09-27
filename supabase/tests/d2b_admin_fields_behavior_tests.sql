-- =====================================================================
-- B0 (D2-B prerequisite): Admin field paths — BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927094400_merchant_field_cas_admin_fields. One transaction,
-- ROLLED BACK at the end. Synthetic rows only (zz-d2b-*).
-- =====================================================================
begin;

create schema d2b_test;
grant usage on schema d2b_test to public;
create function d2b_test.assert_true(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'D2B TEST FAILED: %', label; end if; end $f$;
create function d2b_test.assert_error(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'D2B TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'D2B TEST FAILED: % did not fail', label;
end $f$;
create function d2b_test.admin(mid uuid, patches jsonb) returns jsonb
language sql as $f$ select public.merchant_field_patch('admin', 'legacy_admin', mid, gen_random_uuid(), patches) $f$;
grant execute on all functions in schema d2b_test to public;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000d2b11', 'zz-d2b-owner@example.test');
insert into public.merchants (id, slug, name, layout, cuisine, amenities, address, area, latitude, longitude, tags) values
  ('00000000-0000-4000-8000-0000000d2b01', 'zz-d2b-a', 'ZZ D2B A', 'classic', '{Cafe}', '{}', '1 Jalan Test', 'Test Area', 3.1, 101.6, '{legacy-tag}'),
  ('00000000-0000-4000-8000-0000000d2b02', 'zz-d2b-archived', 'ZZ D2B Archived', 'classic', '{}', '{}', null, null, null, null, null);
update public.merchants set platform_status = 'ARCHIVED' where id = '00000000-0000-4000-8000-0000000d2b02';
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000d2b01', '00000000-0000-4000-8000-0000000d2b11', 'owner', 'active');

set local role service_role;

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-0000000d2b01';
  r jsonb;
  row public.merchants;
  log public.merchant_change_log;
  loc jsonb := '{"address": "1 Jalan Test", "area": "Test Area", "latitude": 3.1, "longitude": 101.6}';
begin
  -- name / layout / tags / location in one Admin section save
  r := d2b_test.admin(a, jsonb_build_array(
    jsonb_build_object('path', 'profile.name', 'expected', jsonb_build_object('exists', true, 'value', 'ZZ D2B A'), 'value', 'ZZ D2B A Renamed'),
    jsonb_build_object('path', 'presentation.layout', 'expected', jsonb_build_object('exists', true, 'value', 'classic'), 'value', 'rustic'),
    jsonb_build_object('path', 'tags.cuisine', 'expected', jsonb_build_object('exists', true, 'value', '["Cafe"]'::jsonb), 'value', '["Cafe", "Bakery"]'::jsonb),
    jsonb_build_object('path', 'location', 'expected', jsonb_build_object('exists', true, 'value', loc),
                       'value', '{"address": "2 Jalan Baru", "area": "New Area", "latitude": 0, "longitude": 0}'::jsonb)));
  select * into row from public.merchants where id = a;
  perform d2b_test.assert_true(r ->> 'status' = 'applied', 'Admin section save applied: ' || r::text);
  perform d2b_test.assert_true(row.name = 'ZZ D2B A Renamed' and row.slug = 'zz-d2b-a', 'renaming does not change the slug');
  perform d2b_test.assert_true(row.layout = 'rustic' and row.cuisine = '{Cafe,Bakery}' and row.tags = '{legacy-tag}', 'layout and cuisine set; legacy tags untouched');
  perform d2b_test.assert_true(row.address = '2 Jalan Baru' and row.area = 'New Area' and row.latitude = 0 and row.longitude = 0, 'coordinate 0 is kept as a real value');
  select * into log from public.merchant_change_log where merchant_id = a order by revision desc limit 1;
  perform d2b_test.assert_true(log.changed_paths = array['location.address', 'location.area', 'location.latitude', 'location.longitude', 'presentation.layout', 'profile.name', 'tags.cuisine'],
    'audit names the new logical paths: ' || log.changed_paths::text);

  -- location is one atomic group: a stale address with fresh coordinates conflicts as a whole
  r := d2b_test.admin(a, jsonb_build_array(jsonb_build_object('path', 'location', 'expected', jsonb_build_object('exists', true, 'value', loc),
         'value', '{"address": "1 Jalan Test", "area": "Test Area", "latitude": 5, "longitude": 100}'::jsonb)));
  perform d2b_test.assert_true(r ->> 'status' = 'conflict' and (select latitude from public.merchants where id = a) = 0, 'location group conflicts as a whole');

  -- no-op confirms values of the requested paths (B0 change)
  r := d2b_test.admin(a, jsonb_build_array(jsonb_build_object('path', 'presentation.layout', 'expected', jsonb_build_object('exists', true, 'value', 'rustic'), 'value', 'rustic')));
  perform d2b_test.assert_true(r ->> 'status' = 'noop' and r -> 'values' -> 'presentation.layout' = jsonb_build_object('exists', true, 'value', 'rustic'), 'no-op returns the confirmed snapshot');
end $$;

-- validation
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "profile.name", "expected": {"exists": true, "value": "ZZ D2B A Renamed"}, "value": null}]')$q$, 'VALIDATION_FAILED', 'name cannot be cleared');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "presentation.layout", "expected": {"exists": true, "value": "rustic"}, "value": "chinese"}]')$q$, 'VALIDATION_FAILED', 'layout on hold is refused');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "tags.cuisine", "expected": {"exists": true, "value": ["Cafe", "Bakery"]}, "value": ["A", "B", "C", "D"]}]')$q$, 'VALIDATION_FAILED', 'too many cuisine tags');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "tags.cuisine", "expected": {"exists": true, "value": ["Cafe", "Bakery"]}, "value": ["Cafe", "Cafe"]}]')$q$, 'VALIDATION_FAILED', 'duplicate tags');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "tags.cuisine", "expected": {"exists": true, "value": ["Cafe", "Bakery"]}, "value": "Cafe"}]')$q$, 'VALIDATION_FAILED', 'tags must be an array');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "location", "expected": {"exists": false}, "value": {"address": "x", "area": null, "latitude": 1}}]')$q$, 'VALIDATION_FAILED', 'location needs all four keys');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "location", "expected": {"exists": false}, "value": {"address": "x", "area": null, "latitude": 1, "longitude": null}}]')$q$, 'VALIDATION_FAILED', 'coordinates set or cleared together');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "location", "expected": {"exists": false}, "value": {"address": "x", "area": null, "latitude": 91, "longitude": 0}}]')$q$, 'VALIDATION_FAILED', 'latitude range');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "location", "expected": {"exists": false}, "value": {"address": "x", "area": null, "latitude": "3", "longitude": "101"}}]')$q$, 'VALIDATION_FAILED', 'coordinates must be numbers');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "location", "expected": {"exists": false}, "value": {"address": "", "area": null, "latitude": null, "longitude": null}}]')$q$, 'VALIDATION_FAILED', 'blank address');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "profile.slug", "expected": {"exists": true, "value": "zz-d2b-a"}, "value": "new"}]')$q$, 'UNKNOWN_FIELD', 'slug is not a patch path');
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b01', '[{"path": "profile.payment_methods", "expected": {"exists": true, "value": null}, "value": ["Cash"]}]')$q$, 'UNKNOWN_FIELD', 'payment_methods is not a patch path');

-- Owner cannot use the Admin-only paths
select d2b_test.assert_error($q$select public.merchant_field_patch('owner', '00000000-0000-4000-8000-0000000d2b11', '00000000-0000-4000-8000-0000000d2b01', gen_random_uuid(), '[{"path": "profile.name", "expected": {"exists": true, "value": "ZZ D2B A Renamed"}, "value": "Mine"}]')$q$, 'FIELD_NOT_WRITABLE', 'Owner name');
select d2b_test.assert_error($q$select public.merchant_field_patch('owner', '00000000-0000-4000-8000-0000000d2b11', '00000000-0000-4000-8000-0000000d2b01', gen_random_uuid(), '[{"path": "location", "expected": {"exists": false}, "value": {"address": "x", "area": null, "latitude": null, "longitude": null}}]')$q$, 'FIELD_NOT_WRITABLE', 'Owner location');

-- Archived: read-only for Admin ordinary edits too
select d2b_test.assert_error($q$select d2b_test.admin('00000000-0000-4000-8000-0000000d2b02', '[{"path": "profile.name", "expected": {"exists": true, "value": "ZZ D2B Archived"}, "value": "x"}]')$q$, 'OPERATION_FORBIDDEN', 'Admin edit of an archived restaurant');
reset role;

select 'ALL D2B ADMIN FIELD BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
