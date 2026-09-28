-- =====================================================================
-- Owner temporary closure: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927210000_owner_temporary_closure. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema oc_test;
grant usage on schema oc_test to public;
create function oc_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'CLOSURE TEST FAILED: %', label; end if; end $f$;
create function oc_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'CLOSURE TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'CLOSURE TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema oc_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000ccb1', 'zz-oc-owner@example.test'),
  ('00000000-0000-4000-8000-00000000ccb2', 'zz-oc-other@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000cc01', 'zz-oc-a', 'ZZ OC A', true, 'PUBLISHED', '+60111111111');
insert into public.merchant_memberships (merchant_id, user_id, role, status)
  values ('00000000-0000-4000-8000-00000000cc01', '00000000-0000-4000-8000-00000000ccb1', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000cc01';
  o text := '00000000-0000-4000-8000-00000000ccb1';
  req uuid := gen_random_uuid();
  r jsonb;
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  call text := $s$select public.merchant_owner_business_status('owner', %L, %L::uuid, gen_random_uuid(), %L, %L, %L::date)$s$;
begin
  perform oc_test.err(format(call, '00000000-0000-4000-8000-00000000ccb2', a, 'TEMPORARILY_CLOSED', null, null), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  perform oc_test.err(format(call, o, a, 'MOVED', null, null), 'VALIDATION_FAILED', 'Owner cannot set MOVED');
  perform oc_test.err(format(call, o, a, 'TEMPORARILY_CLOSED', repeat('x', 201), null), 'VALIDATION_FAILED', 'note length');
  perform oc_test.err(format(call, o, a, 'TEMPORARILY_CLOSED', null, today - 1), 'VALIDATION_FAILED', 'past reopening date');

  r := public.merchant_owner_business_status('owner', o, a, req, 'TEMPORARILY_CLOSED', ' Closed for Hari Raya ', today + 5);
  perform oc_test.ok((select business_status from public.merchants where id = a) = 'TEMPORARILY_CLOSED', 'closed');
  perform oc_test.ok((select note from public.merchant_closure_notices where merchant_id = a) = 'Closed for Hari Raya', 'note stored (trimmed)');
  perform oc_test.ok((public.merchant_owner_business_status('owner', o, a, req, 'TEMPORARILY_CLOSED', ' Closed for Hari Raya ', today + 5) ->> 'replayed')::boolean, 'replay');
  perform oc_test.ok((select changed_paths from public.merchant_change_log where merchant_id = a order by created_at desc, revision desc limit 1) @> array['business_status']
                     and (select actor_type from public.merchant_change_log where merchant_id = a order by created_at desc, revision desc limit 1) = 'owner', 'audited as the Owner');
  perform oc_test.ok((public.merchant_owner_business_status_read('owner', o, a) ->> 'reopenOn')::date = today + 5, 'read');

  r := public.merchant_owner_business_status('owner', o, a, gen_random_uuid(), 'OPEN', 'ignored', today + 3);
  perform oc_test.ok((select business_status from public.merchants where id = a) = 'OPEN'
                     and not exists (select 1 from public.merchant_closure_notices where merchant_id = a), 'open again, notice removed');

  -- Admin-only statuses stay with Admin.
  perform public.merchant_business_status_set('admin', 'legacy_admin', a, gen_random_uuid(), 'MOVED', 'moved to KL');
  perform oc_test.err(format(call, o, a, 'OPEN', null, null), 'OPERATION_FORBIDDEN', 'Owner cannot leave MOVED');
  perform oc_test.ok(not (public.merchant_owner_business_status_read('owner', o, a) ->> 'ownerCanChange')::boolean, 'read says Admin-only');
end $$;

-- Public read only while the restaurant is public.
reset role;
update public.merchants set business_status = 'TEMPORARILY_CLOSED' where id = '00000000-0000-4000-8000-00000000cc01';
insert into public.merchant_closure_notices (merchant_id, note) values ('00000000-0000-4000-8000-00000000cc01', 'Back soon');
set local role anon;
do $$ begin
  perform oc_test.ok(exists (select 1 from public.merchant_closure_notices where merchant_id = '00000000-0000-4000-8000-00000000cc01'), 'public restaurant notice visible');
end $$;
reset role;
update public.merchants set is_published = false where id = '00000000-0000-4000-8000-00000000cc01';
set local role anon;
do $$ begin
  perform oc_test.ok(not exists (select 1 from public.merchant_closure_notices where merchant_id = '00000000-0000-4000-8000-00000000cc01'), 'hidden restaurant notice not visible');
end $$;
reset role;

select 'ALL OWNER CLOSURE BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
