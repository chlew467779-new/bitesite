-- =====================================================================
-- Singapore currency and areas: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20261004130000_singapore_currency. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-sg-*).
-- =====================================================================
begin;

create schema sg_test;
grant usage on schema sg_test to public;
create function sg_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'SG TEST FAILED: %', label; end if; end $f$;
create function sg_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'SG TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'SG TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema sg_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000c1a1', 'zz-sg-owner@example.test'),
  ('00000000-0000-4000-8000-00000000c1a2', 'zz-sg-other@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000c101', 'zz-sg-a', 'ZZ SG A', true, 'PUBLISHED', '+6561234567');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c1a1', 'owner', 'active');

set local role service_role;
do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000c101';
  oa text := '00000000-0000-4000-8000-00000000c1a1';
  ob text := '00000000-0000-4000-8000-00000000c1a2';
  r jsonb;
begin
  perform sg_test.ok((select currency from public.merchants where id = a) = 'MYR', 'default MYR');
  r := public.merchant_currency_set('owner', oa, a, 'SGD');
  perform sg_test.ok(r ->> 'status' = 'applied' and (select currency from public.merchants where id = a) = 'SGD', 'Owner sets SGD');
  perform sg_test.ok(exists (select 1 from public.merchant_change_log where merchant_id = a and 'currency' = any(changed_paths)), 'audited');
  r := public.merchant_currency_set('owner', oa, a, 'SGD');
  perform sg_test.ok(r ->> 'status' = 'noop', 'same value is a no-op');
  perform sg_test.err(format($s$select public.merchant_currency_set('owner', %L, %L::uuid, 'USD')$s$, oa, a), 'VALIDATION_FAILED', 'unknown currency');
  perform sg_test.err(format($s$select public.merchant_currency_set('owner', %L, %L::uuid, 'MYR')$s$, ob, a), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  r := public.merchant_currency_set('admin', 'legacy_admin', a, 'MYR');
  perform sg_test.ok((select currency from public.merchants where id = a) = 'MYR', 'Admin sets MYR');
  update public.merchants set platform_restriction = 'suspended' where id = a;
  perform sg_test.err(format($s$select public.merchant_currency_set('owner', %L, %L::uuid, 'SGD')$s$, oa, a), 'OPERATION_FORBIDDEN', 'suspended Owner refused');
  update public.merchants set platform_restriction = 'none' where id = a;

  -- Areas
  perform sg_test.ok((select count(*) from public.areas where country = 'SG' and state = 'Singapore') >= 21, 'Singapore areas');
  update public.merchants set area = 'orchard road' where id = a;
  perform sg_test.ok((select area from public.merchants where id = a) = 'Orchard', 'merchant area accepts a Singapore area');
end $$;
reset role;

select sg_test.ok(private.area_canonical('amk') = 'Ang Mo Kio', 'alias works');
select sg_test.ok(private.area_canonical('Chinatown') = 'Chinatown', 'KL Chinatown unchanged');

set local role anon;
select sg_test.ok((select currency from public.merchants where slug = 'zz-sg-a') = 'MYR', 'anon reads currency');
select sg_test.ok((select count(*) from public.areas where country = 'SG') >= 21, 'anon reads Singapore areas');
select sg_test.err($q$select public.merchant_currency_set('admin', 'legacy_admin', '00000000-0000-4000-8000-00000000c101', 'SGD')$q$, 'permission denied', 'anon cannot set currency');
reset role;

select sg_test.err($q$update public.merchants set currency = 'USD' where slug = 'zz-sg-a'$q$, 'new row for relation', 'check constraint');

select 'ALL SINGAPORE CURRENCY BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
