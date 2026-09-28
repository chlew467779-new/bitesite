-- =====================================================================
-- D2-A atomic field save: BEHAVIOUR tests (single connection). Local or staging only.
-- Needs the baseline, synthetic seed and migrations through 20260927030741_merchant_field_cas.
-- Everything runs in one transaction that is ROLLED BACK. All rows are synthetic (zz-d2a-*).
-- Concurrency (two overlapping transactions) is covered by scripts/test-d2a-concurrency-local.mjs.
-- =====================================================================
begin;

create schema d2a_test;
grant usage on schema d2a_test to public;

create function d2a_test.assert_true(cond boolean, label text) returns void
language plpgsql as $f$
begin
  if cond is not true then raise exception 'D2A TEST FAILED: %', label; end if;
end $f$;

create function d2a_test.assert_error(stmt text, expected_prefix text, expected_state text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if (expected_prefix is not null and sqlerrm like expected_prefix || '%')
       or (expected_state is not null and sqlstate = expected_state) then
      return;
    end if;
    raise exception 'D2A TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'D2A TEST FAILED: % did not fail', label;
end $f$;

-- patch helper: one path
create function d2a_test.p(path text, expected jsonb, value jsonb) returns jsonb
language sql as $f$ select jsonb_build_object('path', path, 'expected', expected, 'value', value) $f$;
create function d2a_test.ex(value jsonb) returns jsonb
language sql as $f$ select jsonb_build_object('exists', true, 'value', value) $f$;
create function d2a_test.absent() returns jsonb
language sql as $f$ select '{"exists": false}'::jsonb $f$;
create function d2a_test.logs(mid uuid) returns bigint
language sql as $f$ select count(*) from public.merchant_change_log where merchant_id = mid $f$;
grant execute on all functions in schema d2a_test to public;

-- ---------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000d2a11', 'zz-d2a-owner-a@example.test'),
  ('00000000-0000-4000-8000-0000000d2a12', 'zz-d2a-owner-b@example.test'),
  ('00000000-0000-4000-8000-0000000d2a13', 'zz-d2a-owner-s@example.test'),
  ('00000000-0000-4000-8000-0000000d2a14', 'zz-d2a-owner-r@example.test'),
  ('00000000-0000-4000-8000-0000000d2a15', 'zz-d2a-owner-p@example.test');

insert into public.merchants (id, slug, name, is_published, platform_status, phone, tagline, operating_hours, features) values
  ('00000000-0000-4000-8000-0000000d2a01', 'zz-d2a-a', 'ZZ D2A A', true, 'PUBLISHED', '+60111111111', 'A',
   '{"monday": "09:00 - 17:00", "holiday": "legacy free text"}', '{"gallery": false, "legacy_x": true}'),
  ('00000000-0000-4000-8000-0000000d2a02', 'zz-d2a-b', 'ZZ D2A B', true, 'PUBLISHED', '+60122222222', 'B', null, null),
  ('00000000-0000-4000-8000-0000000d2a03', 'zz-d2a-s', 'ZZ D2A S', false, 'SUSPENDED', '+60133333333', 'S', null, null),
  ('00000000-0000-4000-8000-0000000d2a04', 'zz-d2a-r', 'ZZ D2A R', false, 'ARCHIVED', '+60144444444', 'R', null, null);
insert into public.merchants (id, slug, name, state_source, review_status, listing_visibility, platform_restriction, business_status, tagline) values
  ('00000000-0000-4000-8000-0000000d2a05', 'zz-d2a-p', 'ZZ D2A P', 'managed', 'pending', 'hidden', 'none', 'OPEN', 'P');

insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000d2a01', '00000000-0000-4000-8000-0000000d2a11', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000d2a02', '00000000-0000-4000-8000-0000000d2a12', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000d2a03', '00000000-0000-4000-8000-0000000d2a13', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000d2a04', '00000000-0000-4000-8000-0000000d2a14', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000d2a05', '00000000-0000-4000-8000-0000000d2a15', 'owner', 'active');

-- C: public legacy restaurant whose stored contacts are all invalid ("abc", WhatsApp without
-- country code). L: legacy restaurant waiting for review.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000d2a16', 'zz-d2a-owner-c@example.test'),
  ('00000000-0000-4000-8000-0000000d2a17', 'zz-d2a-owner-l@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone, whatsapp, tagline) values
  ('00000000-0000-4000-8000-0000000d2a06', 'zz-d2a-c', 'ZZ D2A C', true, 'PUBLISHED', 'abc', '0123456789', 'C'),
  ('00000000-0000-4000-8000-0000000d2a07', 'zz-d2a-l', 'ZZ D2A L', false, 'PENDING_REVIEW', '+60155555555', null, 'L');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000d2a06', '00000000-0000-4000-8000-0000000d2a16', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000d2a07', '00000000-0000-4000-8000-0000000d2a17', 'owner', 'active');

-- ---------------------------------------------------------------------
-- As the application role
-- ---------------------------------------------------------------------
set local role service_role;

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-0000000d2a01';
  owner_a constant text := '00000000-0000-4000-8000-0000000d2a11';
  r jsonb;
  rev0 bigint;
  logs0 bigint;
  row public.merchants;
  log public.merchant_change_log;
begin
  select revision into rev0 from public.merchants where id = a;
  logs0 := d2a_test.logs(a);

  -- 1. one applied patch with two paths: one revision, one audit row with logical leaf paths
  r := public.merchant_field_patch('owner', owner_a, a, '10000000-0000-4000-8000-000000000001', jsonb_build_array(
         d2a_test.p('profile.phone', d2a_test.ex('"+60111111111"'), '"+60199999999"'),
         d2a_test.p('hours.tue', d2a_test.absent(), '"10:00 - 18:00"')));
  perform d2a_test.assert_true(r ->> 'status' = 'applied' and (r ->> 'replayed')::boolean = false, 'owner patch applied');
  select * into row from public.merchants where id = a;
  perform d2a_test.assert_true(row.revision = rev0 + 1, 'revision +1 exactly');
  perform d2a_test.assert_true(row.phone = '+60199999999' and row.operating_hours ->> 'tuesday' = '10:00 - 18:00', 'values written');
  perform d2a_test.assert_true(row.operating_hours ->> 'monday' = '09:00 - 17:00' and row.operating_hours ->> 'holiday' = 'legacy free text', 'other days and legacy keys kept');
  perform d2a_test.assert_true(d2a_test.logs(a) = logs0 + 1, 'exactly one audit row');
  select * into log from public.merchant_change_log where merchant_id = a order by created_at desc, revision desc limit 1;
  perform d2a_test.assert_true(log.changed_paths = array['hours.tue', 'profile.phone'], 'audit has logical leaf paths: ' || log.changed_paths::text);
  perform d2a_test.assert_true(log.actor_type = 'owner' and log.actor_id = owner_a and log.operation = 'merchant_field_patch'
                               and log.request_id = '10000000-0000-4000-8000-000000000001', 'audit actor and request metadata');
  perform d2a_test.assert_true(log.before ->> 'profile.phone' = '+60111111111' and log.after ->> 'profile.phone' = '+60199999999'
                               and log.before -> 'hours.tue' = 'null'::jsonb and log.after ->> 'hours.tue' = '10:00 - 18:00', 'audit before/after values');
  perform d2a_test.assert_true(r -> 'values' -> 'profile.phone' = d2a_test.ex('"+60199999999"'), 'response carries confirmed values');

  -- 2. replay: same key, same payload -> same result, nothing written
  r := public.merchant_field_patch('owner', owner_a, a, '10000000-0000-4000-8000-000000000001', jsonb_build_array(
         d2a_test.p('hours.tue', d2a_test.absent(), '"10:00 - 18:00"'),
         d2a_test.p('profile.phone', d2a_test.ex('"+60111111111"'), '"+60199999999"')));
  perform d2a_test.assert_true(r ->> 'status' = 'applied' and (r ->> 'replayed')::boolean, 'replay returns the stored result (patch order irrelevant)');
  perform d2a_test.assert_true((select revision from public.merchants where id = a) = rev0 + 1 and d2a_test.logs(a) = logs0 + 1, 'replay writes nothing');

  -- 3. same key, different payload
  perform d2a_test.assert_error(format($q$select public.merchant_field_patch('owner', %L, %L, '10000000-0000-4000-8000-000000000001', %L)$q$,
    owner_a, a, jsonb_build_array(d2a_test.p('profile.phone', d2a_test.ex('"+60111111111"'), '"+60100000000"'))),
    'IDEMPOTENCY_KEY_REUSED', null, 'key reuse with another payload');

  -- 4. different field from a stale session still merges (Admin, features by key)
  r := public.merchant_field_patch('admin', 'legacy_admin', a, '10000000-0000-4000-8000-000000000002', jsonb_build_array(
         d2a_test.p('features.gallery', d2a_test.ex('false'), 'true'),
         d2a_test.p('features.events', d2a_test.absent(), 'true')));
  perform d2a_test.assert_true(r ->> 'status' = 'applied', 'different fields merge although revision changed');
  select * into row from public.merchants where id = a;
  perform d2a_test.assert_true(row.features = '{"gallery": true, "events": true, "legacy_x": true}'::jsonb, 'features patched by key, legacy key kept: ' || row.features::text);
  select * into log from public.merchant_change_log where merchant_id = a order by revision desc limit 1;
  perform d2a_test.assert_true(log.actor_type = 'admin' and log.actor_id = 'legacy_admin' and log.changed_paths = array['features.events', 'features.gallery'], 'admin audit paths');

  -- 5. same field from the same old baseline -> conflict, nothing written
  rev0 := row.revision; logs0 := d2a_test.logs(a);
  r := public.merchant_field_patch('owner', owner_a, a, '10000000-0000-4000-8000-000000000003', jsonb_build_array(
         d2a_test.p('profile.description', d2a_test.ex('null'), '"new description"'),
         d2a_test.p('profile.phone', d2a_test.ex('"+60111111111"'), '"+60188888888"')));
  perform d2a_test.assert_true(r ->> 'status' = 'conflict', 'stale same-field patch conflicts');
  perform d2a_test.assert_true(jsonb_array_length(r -> 'conflicts') = 1 and r -> 'conflicts' -> 0 ->> 'path' = 'profile.phone'
                               and r -> 'conflicts' -> 0 -> 'current' = d2a_test.ex('"+60199999999"'), 'conflict names path, current and proposed');
  select * into row from public.merchants where id = a;
  perform d2a_test.assert_true(row.description is null and row.phone = '+60199999999' and row.revision = rev0 and d2a_test.logs(a) = logs0,
    'one conflicting patch -> no field of the request is written, no audit');
  r := public.merchant_field_patch('owner', owner_a, a, '10000000-0000-4000-8000-000000000003', jsonb_build_array(
         d2a_test.p('profile.phone', d2a_test.ex('"+60111111111"'), '"+60188888888"'),
         d2a_test.p('profile.description', d2a_test.ex('null'), '"new description"')));
  perform d2a_test.assert_true(r ->> 'status' = 'conflict' and (r ->> 'replayed')::boolean, 'conflict result is replayable');

  -- 6. real no-op
  r := public.merchant_field_patch('owner', owner_a, a, '10000000-0000-4000-8000-000000000004', jsonb_build_array(
         d2a_test.p('profile.tagline', d2a_test.ex('"A"'), '"A"'),
         d2a_test.p('hours.sun', d2a_test.absent(), 'null')));
  perform d2a_test.assert_true(r ->> 'status' = 'noop' and (select revision from public.merchants where id = a) = rev0 and d2a_test.logs(a) = logs0, 'no-op writes nothing');
  perform d2a_test.assert_true(r -> 'values' = jsonb_build_object('profile.tagline', d2a_test.ex('"A"'), 'hours.sun', d2a_test.absent()), 'no-op confirms every requested snapshot including absence');
  r := public.merchant_field_patch('owner', owner_a, a, '10000000-0000-4000-8000-000000000004', jsonb_build_array(
         d2a_test.p('hours.sun', d2a_test.absent(), 'null'),
         d2a_test.p('profile.tagline', d2a_test.ex('"A"'), '"A"')));
  perform d2a_test.assert_true(r ->> 'status' = 'noop' and (r ->> 'replayed')::boolean
    and r -> 'values' = jsonb_build_object('profile.tagline', d2a_test.ex('"A"'), 'hours.sun', d2a_test.absent())
    and (select revision from public.merchants where id = a) = rev0 and d2a_test.logs(a) = logs0, 'no-op replay preserves confirmed snapshots and writes nothing');

  -- 7. removing a day, clearing text
  r := public.merchant_field_patch('owner', owner_a, a, '10000000-0000-4000-8000-000000000005', jsonb_build_array(
         d2a_test.p('hours.mon', d2a_test.ex('"09:00 - 17:00"'), 'null'),
         d2a_test.p('profile.tagline', d2a_test.ex('"A"'), 'null')));
  select * into row from public.merchants where id = a;
  perform d2a_test.assert_true(r ->> 'status' = 'applied' and not (row.operating_hours ? 'monday') and row.tagline is null
                               and row.operating_hours ->> 'holiday' = 'legacy free text', 'day removed, text cleared, legacy key kept');

  -- 8. public restaurant keeps a contact method
  perform d2a_test.assert_error(format($q$select public.merchant_field_patch('owner', %L, %L, '10000000-0000-4000-8000-000000000006', %L)$q$,
    owner_a, a, jsonb_build_array(d2a_test.p('profile.phone', d2a_test.ex('"+60199999999"'), 'null'))),
    'PUBLIC_CONTACT_MINIMUM', null, 'last contact of a public restaurant');
  r := public.merchant_field_patch('owner', owner_a, a, '10000000-0000-4000-8000-000000000007', jsonb_build_array(
         d2a_test.p('profile.email', d2a_test.ex('null'), '"hello@example.test"'),
         d2a_test.p('profile.phone', d2a_test.ex('"+60199999999"'), 'null')));
  perform d2a_test.assert_true(r ->> 'status' = 'applied', 'replacing the contact in one request is fine');
  perform d2a_test.assert_error(format($q$select public.merchant_field_patch('owner', %L, %L, '10000000-0000-4000-8000-000000000008', %L)$q$,
    owner_a, a, jsonb_build_array(d2a_test.p('profile.email', d2a_test.ex('"hello@example.test"'), '"not an email"'))),
    'PUBLIC_CONTACT_MINIMUM', null, 'an invalid value does not count as a contact');
end $$;

-- Older data: C is public and has no VALID contact ("abc", WhatsApp without country code).
do $$
declare
  c constant uuid := '00000000-0000-4000-8000-0000000d2a06';
  owner_c constant text := '00000000-0000-4000-8000-0000000d2a16';
  r jsonb;
begin
  r := public.merchant_field_patch('owner', owner_c, c, gen_random_uuid(), jsonb_build_array(d2a_test.p('profile.tagline', d2a_test.ex('"C"'), '"C2"')));
  perform d2a_test.assert_true(r ->> 'status' = 'applied', 'unrelated fields can still be saved');
  perform d2a_test.assert_error(format($q$select public.merchant_field_patch('owner', %L, %L, gen_random_uuid(), %L)$q$,
    owner_c, c, jsonb_build_array(d2a_test.p('profile.phone', d2a_test.ex('"abc"'), '"still not a phone"'))),
    'PUBLIC_CONTACT_MINIMUM', null, 'a contact save must leave a valid contact');
  perform d2a_test.assert_error(format($q$select public.merchant_field_patch('owner', %L, %L, gen_random_uuid(), %L)$q$,
    owner_c, c, jsonb_build_array(d2a_test.p('profile.whatsapp', d2a_test.ex('"0123456789"'), '"012 345 6789"'))),
    'PUBLIC_CONTACT_MINIMUM', null, 'WhatsApp without country code is not bookable, so not valid');
  r := public.merchant_field_patch('owner', owner_c, c, gen_random_uuid(), jsonb_build_array(d2a_test.p('profile.whatsapp', d2a_test.ex('"0123456789"'), '"+60 12-345 6789"')));
  perform d2a_test.assert_true(r ->> 'status' = 'applied', 'a contact save that repairs the data is accepted');
  perform d2a_test.assert_true(private.is_valid_contact_phone('+60 3-1234 5678') and not private.is_valid_contact_phone('123456')
    and private.is_valid_contact_whatsapp('60123456789') and not private.is_valid_contact_whatsapp('++60123456789')
    and not private.is_valid_contact_whatsapp('1234567') and private.is_valid_contact_email('a@b.co') and not private.is_valid_contact_email('a@b'),
    'contact rules match the JavaScript validators');
end $$;

-- ---------------------------------------------------------------------
-- Input validation (nothing written, nothing cached)
-- ---------------------------------------------------------------------
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-0000000d2a01';
  o constant text := '00000000-0000-4000-8000-0000000d2a11';
  req constant uuid := '20000000-0000-4000-8000-000000000001';
  stmt constant text := $q$select public.merchant_field_patch(%L, %L, %L, %L, %L)$q$;
  cases jsonb[][] := array[]::jsonb[][];
begin
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[]'), 'VALIDATION_FAILED', null, 'empty patch list');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '{"path": "profile.tagline"}'), 'VALIDATION_FAILED', null, 'patches not an array');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "profile.tagline", "value": "x"}]'), 'VALIDATION_FAILED', null, 'missing expected');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "profile.tagline", "expected": {"exists": true}, "value": "x"}]'), 'VALIDATION_FAILED', null, 'expected exists without value');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "profile.tagline", "expected": {"exists": "yes", "value": null}, "value": "x"}]'), 'VALIDATION_FAILED', null, 'expected.exists not boolean');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "hours.mon", "expected": {"exists": false, "value": null}, "value": "x"}]'), 'VALIDATION_FAILED', null, 'absent snapshot with value');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "profile.owner_email", "expected": {"exists": true, "value": "x"}, "value": "y"}]'), 'UNKNOWN_FIELD', null, 'an unregistered path');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "settings.theme", "expected": {"exists": false}, "value": "y"}]'), 'UNKNOWN_FIELD', null, 'arbitrary path');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "features", "expected": {"exists": false}, "value": {}}]'), 'UNKNOWN_FIELD', null, 'parent path');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "profile.tagline", "expected": {"exists": true, "value": null}, "value": "x"}, {"path": "profile.tagline", "expected": {"exists": true, "value": null}, "value": "y"}]'), 'VALIDATION_FAILED', null, 'duplicate path');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "features.gallery", "expected": {"exists": true, "value": true}, "value": false}]'), 'FIELD_NOT_WRITABLE', null, 'Owner cannot write features');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "profile.website", "expected": {"exists": true, "value": null}, "value": "https://x.test"}]'), 'FIELD_NOT_WRITABLE', null, 'Owner link write');
  perform d2a_test.assert_error(format(stmt, 'admin', 'legacy_admin', a, req, '[{"path": "profile.instagram", "expected": {"exists": true, "value": null}, "value": "https://x.test"}]'), 'FIELD_NOT_WRITABLE', null, 'Admin link write');
  perform d2a_test.assert_error(format(stmt, 'admin', 'legacy_admin', a, req, '[{"path": "features.menu", "expected": {"exists": false}, "value": false}]'), 'FIELD_NOT_WRITABLE', null, 'features.menu is protected');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "profile.tagline", "expected": {"exists": true, "value": null}, "value": 5}]'), 'VALIDATION_FAILED', null, 'wrong type');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, '[{"path": "profile.tagline", "expected": {"exists": true, "value": null}, "value": ""}]'), 'VALIDATION_FAILED', null, 'empty string is not a clear');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, req, jsonb_build_array(d2a_test.p('profile.tagline', d2a_test.ex('null'), to_jsonb(repeat('x', 301))))), 'VALIDATION_FAILED', null, 'too long');
  perform d2a_test.assert_error(format(stmt, 'admin', 'legacy_admin', a, req, '[{"path": "features.gallery", "expected": {"exists": true, "value": true}, "value": "yes"}]'), 'VALIDATION_FAILED', null, 'feature not boolean');
  perform d2a_test.assert_error(format(stmt, 'owner', o, a, null, '[{"path": "profile.tagline", "expected": {"exists": true, "value": null}, "value": "x"}]'), 'VALIDATION_FAILED', null, 'missing request id');
  perform d2a_test.assert_true(not exists (select 1 from public.request_idempotency where request_id = req), 'invalid input is not cached');
end $$;

-- ---------------------------------------------------------------------
-- Authorization and state
-- ---------------------------------------------------------------------
do $$
declare
  stmt constant text := $q$select public.merchant_field_patch(%L, %L, %L, %L, '[{"path": "profile.tagline", "expected": {"exists": true, "value": %s}, "value": "changed"}]')$q$;
  r jsonb;
begin
  perform d2a_test.assert_error(format(stmt, 'owner', '00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a01', gen_random_uuid(), 'null'), 'RESOURCE_NOT_FOUND', null, 'Owner B -> A is 404');
  perform d2a_test.assert_error(format(stmt, 'owner', 'not-a-uuid', '00000000-0000-4000-8000-0000000d2a01', gen_random_uuid(), 'null'), 'RESOURCE_NOT_FOUND', null, 'malformed owner id');
  perform d2a_test.assert_error(format(stmt, 'owner', '00000000-0000-4000-8000-0000000d2a11', gen_random_uuid(), gen_random_uuid(), 'null'), 'RESOURCE_NOT_FOUND', null, 'missing merchant');
  perform d2a_test.assert_error(format(stmt, 'admin', 'someone', '00000000-0000-4000-8000-0000000d2a01', gen_random_uuid(), 'null'), 'OPERATION_FORBIDDEN', null, 'unknown admin principal');
  perform d2a_test.assert_error(format(stmt, 'system', 'x', '00000000-0000-4000-8000-0000000d2a01', gen_random_uuid(), 'null'), 'FIELD_NOT_WRITABLE', null, 'unknown actor type');
  perform d2a_test.assert_error(format(stmt, 'owner', '00000000-0000-4000-8000-0000000d2a13', '00000000-0000-4000-8000-0000000d2a03', gen_random_uuid(), '"S"'), 'MERCHANT_SUSPENDED', null, 'suspended Owner write');
  perform d2a_test.assert_error(format(stmt, 'owner', '00000000-0000-4000-8000-0000000d2a14', '00000000-0000-4000-8000-0000000d2a04', gen_random_uuid(), '"R"'), 'OPERATION_FORBIDDEN', null, 'archived Owner write');
  perform d2a_test.assert_error(format(stmt, 'owner', '00000000-0000-4000-8000-0000000d2a15', '00000000-0000-4000-8000-0000000d2a05', gen_random_uuid(), '"P"'), 'OPERATION_FORBIDDEN', null, 'pending review frozen for Owner');
  perform d2a_test.assert_error(format(stmt, 'admin', 'legacy_admin', '00000000-0000-4000-8000-0000000d2a05', gen_random_uuid(), '"P"'), 'OPERATION_FORBIDDEN', null, 'pending review frozen for Admin');
  perform d2a_test.assert_error(format(stmt, 'owner', '00000000-0000-4000-8000-0000000d2a17', '00000000-0000-4000-8000-0000000d2a07', gen_random_uuid(), '"L"'), 'OPERATION_FORBIDDEN', null, 'legacy PENDING_REVIEW frozen for Owner');
  perform d2a_test.assert_error(format(stmt, 'admin', 'legacy_admin', '00000000-0000-4000-8000-0000000d2a07', gen_random_uuid(), '"L"'), 'OPERATION_FORBIDDEN', null, 'legacy PENDING_REVIEW frozen for Admin');
  perform d2a_test.assert_error(format(stmt, 'admin', 'legacy_admin', '00000000-0000-4000-8000-0000000d2a04', gen_random_uuid(), '"R"'), 'OPERATION_FORBIDDEN', null, 'archived Admin ordinary write');
  r := public.merchant_field_patch('admin', 'legacy_admin', '00000000-0000-4000-8000-0000000d2a03', gen_random_uuid(),
         '[{"path": "profile.tagline", "expected": {"exists": true, "value": "S"}, "value": "admin fix"}]');
  perform d2a_test.assert_true(r ->> 'status' = 'applied', 'Admin may correct a suspended restaurant');
  perform d2a_test.assert_true((select tagline from public.merchants where id = '00000000-0000-4000-8000-0000000d2a03') = 'admin fix', 'Admin write stored');
end $$;

-- Replay after the membership is revoked returns 404, not the stored result.
reset role;
update public.merchant_memberships set status = 'suspended'
 where merchant_id = '00000000-0000-4000-8000-0000000d2a01' and user_id = '00000000-0000-4000-8000-0000000d2a11';
set local role service_role;
select d2a_test.assert_error($q$select public.merchant_field_patch('owner', '00000000-0000-4000-8000-0000000d2a11', '00000000-0000-4000-8000-0000000d2a01', '10000000-0000-4000-8000-000000000001', '[{"path": "profile.phone", "expected": {"exists": true, "value": "+60111111111"}, "value": "+60199999999"}, {"path": "hours.tue", "expected": {"exists": false}, "value": "10:00 - 18:00"}]')$q$,
  'RESOURCE_NOT_FOUND', null, 'revoked Owner cannot replay an old key');
reset role;
update public.merchant_memberships set status = 'active'
 where merchant_id = '00000000-0000-4000-8000-0000000d2a01' and user_id = '00000000-0000-4000-8000-0000000d2a11';

-- Expired key
update public.request_idempotency set expires_at = now() - interval '1 minute' where request_id = '10000000-0000-4000-8000-000000000004';
set local role service_role;
select d2a_test.assert_error($q$select public.merchant_field_patch('owner', '00000000-0000-4000-8000-0000000d2a11', '00000000-0000-4000-8000-0000000d2a01', '10000000-0000-4000-8000-000000000004', '[{"path": "profile.tagline", "expected": {"exists": true, "value": "A"}, "value": "A"}]')$q$,
  'IDEMPOTENCY_KEY_EXPIRED', null, 'expired key asks for a new request id');
select d2a_test.assert_true(public.request_idempotency_purge_expired(100) >= 1, 'purge removes expired keys');
select d2a_test.assert_true(not exists (select 1 from public.request_idempotency where request_id = '10000000-0000-4000-8000-000000000004'), 'expired key gone');
select d2a_test.assert_true(exists (select 1 from public.request_idempotency where request_id = '10000000-0000-4000-8000-000000000001'), 'unexpired keys kept');

-- ---------------------------------------------------------------------
-- A failing audit or idempotency write rolls the whole save back
-- ---------------------------------------------------------------------
reset role;
alter table public.merchant_change_log add constraint d2a_test_block_audit check (operation is distinct from 'merchant_field_patch') not valid;
set local role service_role;
select d2a_test.assert_error($q$select public.merchant_field_patch('owner', '00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a02', '30000000-0000-4000-8000-000000000001', '[{"path": "profile.tagline", "expected": {"exists": true, "value": "B"}, "value": "B2"}]')$q$,
  null, '23514', 'audit failure aborts the save');
select d2a_test.assert_true((select tagline from public.merchants where id = '00000000-0000-4000-8000-0000000d2a02') = 'B', 'merchant unchanged after audit failure');
select d2a_test.assert_true(not exists (select 1 from public.request_idempotency where request_id = '30000000-0000-4000-8000-000000000001'), 'no idempotency row after audit failure');
reset role;
alter table public.merchant_change_log drop constraint d2a_test_block_audit;
alter table public.request_idempotency add constraint d2a_test_block_idem check (request_id <> '30000000-0000-4000-8000-000000000002') not valid;
set local role service_role;
select d2a_test.assert_error($q$select public.merchant_field_patch('owner', '00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a02', '30000000-0000-4000-8000-000000000002', '[{"path": "profile.tagline", "expected": {"exists": true, "value": "B"}, "value": "B3"}]')$q$,
  null, '23514', 'idempotency failure aborts the save');
select d2a_test.assert_true((select tagline from public.merchants where id = '00000000-0000-4000-8000-0000000d2a02') = 'B', 'merchant unchanged after idempotency failure');
reset role;
alter table public.request_idempotency drop constraint d2a_test_block_idem;

-- ---------------------------------------------------------------------
-- Inserts with ownership rechecked in the transaction
-- ---------------------------------------------------------------------
set local role service_role;
do $$
declare
  s jsonb;
  c jsonb;
begin
  s := public.merchant_story_submission_create('00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a02',
         '{"title": " ZZ story ", "content": "Facts.", "merchant_slug": "zz-d2a-a", "submitted_by": "someone", "image_urls": ["https://x.test/1.webp"], "ai_assistance_requested": true}');
  perform d2a_test.assert_true(s ->> 'merchant_slug' = 'zz-d2a-b' and s ->> 'title' = 'ZZ story' and s ->> 'status' = 'pending_review'
                               and s ->> 'channel' = 'self_service_form' and s ->> 'submitted_by' = '00000000-0000-4000-8000-0000000d2a12'
                               and (s ->> 'rights_declared')::boolean and (s ->> 'ai_assistance_requested')::boolean,
                               'Story insert uses the locked merchant and server-set fields');
  perform d2a_test.assert_error($q$select public.merchant_story_submission_create('00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a02', '{"title": "Second", "content": "x"}')$q$,
    null, '23505', 'one pending Story per restaurant is kept');
  perform d2a_test.assert_error($q$select public.merchant_story_submission_create('00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a01', '{"title": "Foreign", "content": "x"}')$q$,
    'RESOURCE_NOT_FOUND', null, 'Story for a foreign restaurant');
  perform d2a_test.assert_error($q$select public.merchant_story_submission_create('00000000-0000-4000-8000-0000000d2a13', '00000000-0000-4000-8000-0000000d2a03', '{"title": "S", "content": "x"}')$q$,
    'MERCHANT_SUSPENDED', null, 'Story for a suspended restaurant');
  perform d2a_test.assert_error($q$select public.merchant_story_submission_create('00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a02', '{"title": "", "content": "x"}')$q$,
    'VALIDATION_FAILED', null, 'empty Story title');

  c := public.merchant_profile_change_request_create('00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a02', '{"name": "New B"}');
  perform d2a_test.assert_true(c ->> 'status' = 'pending' and c -> 'changes' = '{"name": "New B"}' and not (c ? 'requested_by'), 'change request created with the safe projection');
  perform d2a_test.assert_error($q$select public.merchant_profile_change_request_create('00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a02', '{"address": "x"}')$q$,
    null, '23505', 'one pending change request per restaurant is kept');
  perform d2a_test.assert_error($q$select public.merchant_profile_change_request_create('00000000-0000-4000-8000-0000000d2a11', '00000000-0000-4000-8000-0000000d2a02', '{"name": "x"}')$q$,
    'RESOURCE_NOT_FOUND', null, 'change request for a foreign restaurant');
  perform d2a_test.assert_error($q$select public.merchant_profile_change_request_create('00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a02', '{"layout": "x"}')$q$,
    'VALIDATION_FAILED', null, 'change request field whitelist');
end $$;

-- Snapshot read: Owner sees no features, foreign Owner gets 404
select d2a_test.assert_true(not ((public.merchant_field_snapshot_read('owner', '00000000-0000-4000-8000-0000000d2a11', '00000000-0000-4000-8000-0000000d2a01') -> 'fields') ? 'features.gallery'), 'Owner snapshot has no features');
select d2a_test.assert_true((public.merchant_field_snapshot_read('admin', 'legacy_admin', '00000000-0000-4000-8000-0000000d2a01') -> 'fields') ? 'features.gallery', 'Admin snapshot has features');
select d2a_test.assert_error($q$select public.merchant_field_snapshot_read('owner', '00000000-0000-4000-8000-0000000d2a12', '00000000-0000-4000-8000-0000000d2a01')$q$, 'RESOURCE_NOT_FOUND', null, 'foreign snapshot');
reset role;

-- ---------------------------------------------------------------------
-- Public roles cannot call the RPCs or read the private tables
-- ---------------------------------------------------------------------
set local role anon;
select d2a_test.assert_error($q$select public.merchant_field_patch('admin', 'legacy_admin', '00000000-0000-4000-8000-0000000d2a01', gen_random_uuid(), '[]')$q$, null, '42501', 'anon cannot execute the patch RPC');
select d2a_test.assert_error($q$select public.merchant_story_submission_create('00000000-0000-4000-8000-0000000d2a11', '00000000-0000-4000-8000-0000000d2a01', '{}')$q$, null, '42501', 'anon cannot execute the Story RPC');
select d2a_test.assert_error($q$select count(*) from public.request_idempotency$q$, null, '42501', 'anon cannot read idempotency results');
reset role;
set local role authenticated;
select d2a_test.assert_error($q$select public.merchant_field_patch('owner', '00000000-0000-4000-8000-0000000d2a11', '00000000-0000-4000-8000-0000000d2a01', gen_random_uuid(), '[]')$q$, null, '42501', 'authenticated cannot execute the patch RPC');
select d2a_test.assert_error($q$select public.merchant_profile_change_request_create('00000000-0000-4000-8000-0000000d2a11', '00000000-0000-4000-8000-0000000d2a01', '{}')$q$, null, '42501', 'authenticated cannot execute the change request RPC');
select d2a_test.assert_error($q$select public.request_idempotency_purge_expired(1)$q$, null, '42501', 'authenticated cannot purge');
select d2a_test.assert_error($q$select count(*) from public.merchant_change_log$q$, null, '42501', 'authenticated cannot read the audit log');
reset role;

select 'ALL D2A FIELD CAS BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
