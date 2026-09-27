-- =====================================================================
-- D2-C Admin governance: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927090000_merchant_governance. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-d2c-gov-*).
-- =====================================================================
begin;

create schema d2c_test;
grant usage on schema d2c_test to public;
create function d2c_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'D2C TEST FAILED: %', label; end if; end $f$;
create function d2c_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'D2C TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'D2C TEST FAILED: % did not fail', label;
end $f$;
create function d2c_test.act(mid uuid, action text, reason text, req uuid default gen_random_uuid()) returns jsonb
language sql as $f$ select public.merchant_governance_apply('admin', 'legacy_admin', mid, req, action, reason) $f$;
create function d2c_test.m(mid uuid) returns public.merchants
language sql as $f$ select * from public.merchants where id = mid $f$;
create function d2c_test.public(mid uuid) returns boolean
language sql as $f$ select private.merchant_is_public(m) from public.merchants m where id = mid $f$;
create function d2c_test.logs(mid uuid) returns bigint
language sql as $f$ select count(*) from public.merchant_change_log where merchant_id = mid $f$;
grant execute on all functions in schema d2c_test to public;

-- Fixtures (as postgres). D = legacy draft with contact, N = legacy draft without contact,
-- P = legacy public, S = legacy suspended (was published), R = legacy archived,
-- W = legacy pending review, M = managed approved + public, H = managed approved + hidden.
insert into public.merchants (id, slug, name, is_published, platform_status, phone, email) values
  ('00000000-0000-4000-8000-00000000c001', 'zz-d2c-gov-d', 'ZZ Gov D', false, 'DRAFT', '+60111111111', null),
  ('00000000-0000-4000-8000-00000000c002', 'zz-d2c-gov-n', 'ZZ Gov N', false, 'DRAFT', 'abc', null),
  ('00000000-0000-4000-8000-00000000c003', 'zz-d2c-gov-p', 'ZZ Gov P', true, 'PUBLISHED', null, 'p@example.test'),
  ('00000000-0000-4000-8000-00000000c004', 'zz-d2c-gov-s', 'ZZ Gov S', true, 'SUSPENDED', '+60144444444', null),
  ('00000000-0000-4000-8000-00000000c005', 'zz-d2c-gov-r', 'ZZ Gov R', false, 'ARCHIVED', '+60155555555', null),
  ('00000000-0000-4000-8000-00000000c006', 'zz-d2c-gov-w', 'ZZ Gov W', false, 'PENDING_REVIEW', '+60166666666', null);
insert into public.merchants (id, slug, name, state_source, review_status, listing_visibility, platform_restriction, business_status, phone) values
  ('00000000-0000-4000-8000-00000000c007', 'zz-d2c-gov-m', 'ZZ Gov M', 'managed', 'approved', 'public', 'none', 'OPEN', '+60177777777'),
  ('00000000-0000-4000-8000-00000000c008', 'zz-d2c-gov-h', 'ZZ Gov H', 'managed', 'approved', 'hidden', 'none', 'OPEN', '+60188888888');
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000c0a1', 'zz-d2c-gov-owner@example.test');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c0a1', 'owner', 'active');

set local role service_role;

do $$
declare
  d uuid := '00000000-0000-4000-8000-00000000c001';
  n uuid := '00000000-0000-4000-8000-00000000c002';
  p uuid := '00000000-0000-4000-8000-00000000c003';
  s uuid := '00000000-0000-4000-8000-00000000c004';
  r uuid := '00000000-0000-4000-8000-00000000c005';
  w uuid := '00000000-0000-4000-8000-00000000c006';
  mg uuid := '00000000-0000-4000-8000-00000000c007';
  h uuid := '00000000-0000-4000-8000-00000000c008';
  req uuid := gen_random_uuid();
  res jsonb;
  rev0 bigint;
  logs0 bigint;
  a text;
  stmt text := $s$select public.merchant_governance_apply(%L, %L, %L::uuid, gen_random_uuid(), %L, %L)$s$;
begin
  -- 1. publish a draft: public, audited with operation and actor, revision bumped once
  rev0 := (d2c_test.m(d)).revision;
  res := d2c_test.act(d, 'publish', null, req);
  perform d2c_test.ok(res ->> 'status' = 'applied' and d2c_test.public(d)
    and (d2c_test.m(d)).platform_status = 'PUBLISHED' and (d2c_test.m(d)).first_published_at is not null
    and (d2c_test.m(d)).revision = rev0 + 1, 'publish a draft');
  perform d2c_test.ok(exists (select 1 from public.merchant_change_log l where l.merchant_id = d and l.operation = 'merchant_governance:publish'
    and l.actor_type = 'admin' and l.actor_id = 'legacy_admin' and l.request_id = req), 'publish is audited');
  perform d2c_test.ok(not ((res -> 'state' -> 'allowedActions') ? 'publish') and (res -> 'state' -> 'allowedActions') ? 'hide', 'allowed actions after publish');

  -- 2. replay, reuse, noop
  logs0 := d2c_test.logs(d);
  res := d2c_test.act(d, 'publish', null, req);
  perform d2c_test.ok((res ->> 'replayed')::boolean and res ->> 'status' = 'applied' and d2c_test.logs(d) = logs0 and (d2c_test.m(d)).revision = rev0 + 1, 'replay writes nothing');
  perform d2c_test.err(format($s$select public.merchant_governance_apply('admin', 'legacy_admin', %L::uuid, %L::uuid, 'hide', 'x')$s$, d, req), 'IDEMPOTENCY_KEY_REUSED', 'same id, other action');
  res := d2c_test.act(d, 'publish', null);
  perform d2c_test.ok(res ->> 'status' = 'noop' and d2c_test.logs(d) = logs0, 'publish again is a no-op');

  -- 3. publish needs a valid contact
  perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', n, 'publish', null), 'PUBLIC_CONTACT_MINIMUM', 'publish without valid contact');
  perform d2c_test.ok(not d2c_test.public(n), 'refused publish wrote nothing');

  -- 4. hide needs a reason; hide keeps platform_status; reason is audited
  perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', p, 'hide', '  '), 'VALIDATION_FAILED', 'hide without reason');
  perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', p, 'hide', repeat('x', 501)), 'VALIDATION_FAILED', 'reason too long');
  res := d2c_test.act(p, 'hide', 'Wrong prices reported');
  perform d2c_test.ok(res ->> 'status' = 'applied' and not d2c_test.public(p) and (d2c_test.m(p)).platform_status = 'PUBLISHED'
    and exists (select 1 from public.merchant_change_log l where l.merchant_id = p and l.operation = 'merchant_governance:hide' and l.reason = 'Wrong prices reported'), 'hide');
  res := d2c_test.act(p, 'publish', null);
  perform d2c_test.ok(d2c_test.public(p), 'publish after hide');

  -- 5. suspend keeps is_published; Owner writes refused, Admin corrections allowed; publish refused
  res := d2c_test.act(p, 'suspend', 'Complaint under review');
  perform d2c_test.ok(res ->> 'status' = 'applied' and not d2c_test.public(p) and (d2c_test.m(p)).is_published
    and (res -> 'state' -> 'allowedActions') = '["hide", "unsuspend"]'::jsonb, 'suspend');
  perform d2c_test.err(format($s$select public.merchant_field_patch('owner', %L, %L::uuid, gen_random_uuid(), '[{"path": "profile.tagline", "expected": {"exists": false}, "value": "x"}]')$s$,
    '00000000-0000-4000-8000-00000000c0a1', p), 'MERCHANT_SUSPENDED', 'Owner write while suspended');
  res := public.merchant_field_patch('admin', 'legacy_admin', p, gen_random_uuid(), '[{"path": "profile.tagline", "expected": {"exists": true, "value": null}, "value": "fixed"}]');
  perform d2c_test.ok(res ->> 'status' = 'applied', 'Admin correction while suspended');
  perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', p, 'publish', null), 'OPERATION_FORBIDDEN', 'publish while suspended');

  -- 6. lifting a suspension restores the earlier visibility
  res := d2c_test.act(p, 'unsuspend', 'Resolved');
  perform d2c_test.ok(d2c_test.public(p) and (d2c_test.m(p)).platform_status = 'PUBLISHED', 'unsuspend restores public');
  res := d2c_test.act(s, 'hide', 'Keep hidden after the suspension');
  res := d2c_test.act(s, 'unsuspend', 'Resolved');
  perform d2c_test.ok(not d2c_test.public(s) and (d2c_test.m(s)).platform_status = 'DRAFT', 'hidden while suspended stays hidden');

  -- 7. archived refuses everything; pending review can be published by Admin
  foreach a in array array['publish', 'hide', 'suspend', 'unsuspend'] loop
    perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', r, a, 'x'), 'OPERATION_FORBIDDEN', 'archived ' || a);
  end loop;
  res := d2c_test.act(w, 'publish', null);
  perform d2c_test.ok(d2c_test.public(w), 'Admin publishes a pending legacy restaurant');

  -- 8. managed rows: suspend / unsuspend only; mirrors derived by the D1a trigger
  perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', h, 'publish', null), 'OPERATION_FORBIDDEN', 'managed publish');
  perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', mg, 'hide', 'x'), 'OPERATION_FORBIDDEN', 'managed hide');
  res := d2c_test.act(mg, 'suspend', 'Emergency');
  perform d2c_test.ok(not d2c_test.public(mg) and (d2c_test.m(mg)).platform_status = 'SUSPENDED' and (d2c_test.m(mg)).listing_visibility = 'public', 'managed suspend');
  res := d2c_test.act(mg, 'unsuspend', 'Resolved');
  perform d2c_test.ok(d2c_test.public(mg), 'managed unsuspend');

  -- 9. actor, action and target checks; read
  perform d2c_test.err(format(stmt, 'owner', '00000000-0000-4000-8000-00000000c0a1', d, 'hide', 'x'), 'OPERATION_FORBIDDEN', 'Owner cannot govern');
  perform d2c_test.err(format(stmt, 'admin', 'someone', d, 'hide', 'x'), 'OPERATION_FORBIDDEN', 'unknown Admin principal');
  perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', d, 'archive', 'x'), 'VALIDATION_FAILED', 'unknown action');
  perform d2c_test.err(format(stmt, 'admin', 'legacy_admin', gen_random_uuid(), 'hide', 'x'), 'RESOURCE_NOT_FOUND', 'missing restaurant');
  res := public.merchant_governance_read('admin', 'legacy_admin', n);
  perform d2c_test.ok(res -> 'state' ->> 'hasValidContact' = 'false' and res -> 'state' -> 'allowedActions' = '["suspend"]'::jsonb, 'read shows what is allowed');
end $$;

reset role;

-- 10. public roles cannot call the RPCs
set local role authenticated;
select d2c_test.err($q$select public.merchant_governance_apply('admin', 'legacy_admin', '00000000-0000-4000-8000-00000000c001', gen_random_uuid(), 'hide', 'x')$q$, 'permission denied', 'authenticated cannot govern');
reset role;
set local role anon;
select d2c_test.err($q$select public.merchant_governance_read('admin', 'legacy_admin', '00000000-0000-4000-8000-00000000c001')$q$, 'permission denied', 'anon cannot read');
reset role;

select 'ALL D2C GOVERNANCE BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
