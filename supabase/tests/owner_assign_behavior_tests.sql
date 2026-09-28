-- =====================================================================
-- Admin Owner assign / transfer: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260928120000_merchant_owner_assign. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema oa_test;
grant usage on schema oa_test to public;
create function oa_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'OWNER ASSIGN TEST FAILED: %', label; end if; end $f$;
create function oa_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'OWNER ASSIGN TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'OWNER ASSIGN TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema oa_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000aa5a1', 'zz-oa-first@example.test'),
  ('00000000-0000-4000-8000-0000000aa5a2', 'zz-oa-second@example.test');
insert into public.merchants (id, slug, name) values ('00000000-0000-4000-8000-0000000aa5b1', 'zz-oa', 'ZZ OA');

set local role service_role;

do $$
declare
  m uuid := '00000000-0000-4000-8000-0000000aa5b1';
  u1 uuid := '00000000-0000-4000-8000-0000000aa5a1';
  u2 uuid := '00000000-0000-4000-8000-0000000aa5a2';
  r jsonb;
  active_owner uuid;
begin
  perform oa_test.err(format($s$select public.merchant_owner_assign('owner', %L, %L::uuid, %L::uuid)$s$, u1, m, u1), 'OPERATION_FORBIDDEN', 'Admin only');
  perform oa_test.err(format($s$select public.merchant_owner_assign('admin', 'legacy_admin', gen_random_uuid(), %L::uuid)$s$, u1), 'RESOURCE_NOT_FOUND', 'unknown restaurant');

  -- First Owner.
  r := public.merchant_owner_assign('admin', 'legacy_admin', m, u1);
  perform oa_test.ok(r ->> 'status' = 'applied' and r ->> 'previousUserId' is null, 'first Owner linked');
  perform oa_test.ok(public.merchant_owner_assign('admin', 'legacy_admin', m, u1) ->> 'status' = 'noop', 'same Owner again: noop');

  -- Transfer: the case that used to fail on the one-active-Owner index.
  r := public.merchant_owner_assign('admin', 'legacy_admin', m, u2);
  select user_id into active_owner from public.merchant_memberships where merchant_id = m and role = 'owner' and status = 'active';
  perform oa_test.ok(active_owner = u2 and (r ->> 'previousUserId')::uuid = u1, 'transferred to the second account');
  perform oa_test.ok((select status from public.merchant_memberships where merchant_id = m and user_id = u1) = 'suspended', 'previous Owner suspended');
  perform oa_test.ok(exists (select 1 from public.merchant_membership_audit where merchant_id = m and action = 'suspended' and user_id = u1)
                     and exists (select 1 from public.merchant_membership_audit where merchant_id = m and action = 'linked' and user_id = u2 and previous_user_id = u1), 'both steps audited');

  -- Transfer back reactivates the suspended row (no duplicate membership).
  r := public.merchant_owner_assign('admin', 'legacy_admin', m, u1);
  perform oa_test.ok((select count(*) from public.merchant_memberships where merchant_id = m) = 2
                     and (select user_id from public.merchant_memberships where merchant_id = m and status = 'active') = u1, 'transfer back reuses the row');
end $$;

reset role;
set local role authenticated;
do $$ begin
  perform oa_test.err($s$select public.merchant_owner_assign('admin', 'legacy_admin', '00000000-0000-4000-8000-0000000aa5b1', '00000000-0000-4000-8000-0000000aa5a1')$s$, 'permission denied', 'authenticated cannot call');
end $$;
reset role;

select 'ALL OWNER ASSIGN BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
