-- =====================================================================
-- Listing basics change requests: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260928090000_merchant_basics_requests. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema br_test;
grant usage on schema br_test to public;
create function br_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'BASICS TEST FAILED: %', label; end if; end $f$;
create function br_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'BASICS TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'BASICS TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema br_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000bba1', 'zz-br-owner@example.test'),
  ('00000000-0000-4000-8000-00000000bba2', 'zz-br-other@example.test');
-- A: managed + approved. D: managed draft (edits basics directly). L: legacy published.
insert into public.merchants (id, slug, name, state_source, review_status, listing_visibility, platform_restriction, address, area, latitude, longitude, cuisine) values
  ('00000000-0000-4000-8000-00000000bb01', 'zz-br-a', 'ZZ BR Kopi', 'managed', 'approved', 'hidden', 'none', '1 Jalan Satu', 'Georgetown', 5.41, 100.33, array['Malaysian']),
  ('00000000-0000-4000-8000-00000000bb02', 'restaurant-00000000-0000-4000-8000-00000000bb02', 'ZZ BR Draft', 'managed', 'draft', 'hidden', 'none', null, null, null, null, '{}');
insert into public.merchants (id, slug, name, is_published, platform_status, phone, address, cuisine) values
  ('00000000-0000-4000-8000-00000000bb03', 'zz-br-legacy', 'ZZ BR Legacy', true, 'PUBLISHED', '+60111111111', '9 Lebuh Sembilan', array['Cafe']);
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000bb01', '00000000-0000-4000-8000-00000000bba1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000bb02', '00000000-0000-4000-8000-00000000bba1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000bb03', '00000000-0000-4000-8000-00000000bba1', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000bb01';
  d uuid := '00000000-0000-4000-8000-00000000bb02';
  l uuid := '00000000-0000-4000-8000-00000000bb03';
  o text := '00000000-0000-4000-8000-00000000bba1';
  req uuid := gen_random_uuid();
  rev uuid := gen_random_uuid();
  r jsonb;
  first_id uuid;
  second_id uuid;
  submit text := $s$select public.merchant_basics_request_submit('owner', %L, %L::uuid, gen_random_uuid(), %L::jsonb)$s$;
begin
  -- Who and what may ask.
  perform br_test.err(format(submit, '00000000-0000-4000-8000-00000000bba2', a, '{"profile.name":"X"}'), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  perform br_test.err(format(submit, o, d, '{"profile.name":"X"}'), 'FIELD_NOT_WRITABLE', 'draft edits directly');
  perform br_test.err(format(submit, o, a, '{"slug":"x"}'), 'VALIDATION_FAILED', 'unknown path');
  perform br_test.err(format(submit, o, a, '{"profile.name":"  "}'), 'VALIDATION_FAILED', 'blank name');
  perform br_test.err(format(submit, o, a, '{"location":{"address":"x","latitude":1}}'), 'VALIDATION_FAILED', 'Owner cannot send coordinates');
  perform br_test.err(format(submit, o, a, '{"tags.cuisine":[]}'), 'VALIDATION_FAILED', 'no cuisine');
  perform br_test.err(format(submit, o, a, '{"tags.cuisine":["a","b","c","d"]}'), 'VALIDATION_FAILED', 'four cuisines');
  perform br_test.ok(public.merchant_basics_read('owner', o, d) ->> 'requestable' = 'false', 'draft not requestable');
  perform br_test.ok(public.merchant_basics_read('owner', o, l) ->> 'requestable' = 'true', 'legacy requestable');

  -- Unchanged values are a noop.
  r := public.merchant_basics_request_submit('owner', o, a, gen_random_uuid(), '{"profile.name":" ZZ BR Kopi ","tags.cuisine":["Malaysian"]}');
  perform br_test.ok(r ->> 'status' = 'noop', 'noop when nothing differs');

  -- Submit, replay, supersede.
  r := public.merchant_basics_request_submit('owner', o, a, req, '{"profile.name":"ZZ BR Kopi Old","location":{"address":"2 Jalan Dua","area":null}}');
  first_id := (r ->> 'basicsRequestId')::uuid;
  perform br_test.ok(r -> 'paths' = '["location","profile.name"]'::jsonb, 'both paths requested');
  perform br_test.ok((public.merchant_basics_request_submit('owner', o, a, req, '{"profile.name":"ZZ BR Kopi Old","location":{"address":"2 Jalan Dua","area":null}}') ->> 'replayed')::boolean, 'replay');
  perform br_test.err(format($s$select public.merchant_basics_request_submit('owner', %L, %L::uuid, %L::uuid, '{"profile.name":"Other"}'::jsonb)$s$, o, a, req), 'IDEMPOTENCY_KEY_REUSED', 'reused key');
  perform br_test.ok((select name from public.merchants where id = a) = 'ZZ BR Kopi', 'nothing public changed yet');

  r := public.merchant_basics_request_submit('owner', o, a, gen_random_uuid(),
    '{"profile.name":"ZZ BR Kopi Baru","location":{"address":" 2 Jalan Dua ","area":"Georgetown"},"tags.cuisine":["Malaysian","Cafe","Cafe"]}');
  second_id := (r ->> 'basicsRequestId')::uuid;
  perform br_test.ok((select status from public.merchant_basics_requests where id = first_id) = 'superseded', 'older request superseded');
  perform br_test.ok((select changes -> 'location' from public.merchant_basics_requests where id = second_id)
                     = '{"address":"2 Jalan Dua","area":"Georgetown","latitude":5.41,"longitude":100.33}'::jsonb, 'location keeps stored coordinates, trimmed');
  perform br_test.ok((select changes -> 'tags.cuisine' from public.merchant_basics_requests where id = second_id) = '["Malaysian","Cafe"]'::jsonb, 'duplicate tag dropped, order kept');
  perform br_test.ok(jsonb_array_length(public.merchant_basics_queue('admin', 'legacy_admin')) = 1, 'one waiting in the queue');
  perform br_test.ok((public.merchant_basics_queue('admin', 'legacy_admin') -> 0 -> 'changes' ->> 'name') = 'ZZ BR Kopi Baru', 'queue shows proposal');

  -- Review rules.
  perform br_test.err(format($s$select public.merchant_basics_review('owner', %L, gen_random_uuid(), %L::uuid, 'approve', null)$s$, o, second_id), 'OPERATION_FORBIDDEN', 'Owner cannot review');
  perform br_test.err(format($s$select public.merchant_basics_review('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'reject', ' ')$s$, second_id), 'VALIDATION_FAILED', 'reject needs a note');

  -- Changed since the request: approval refused, request stays pending.
  update public.merchants set name = 'ZZ BR Kopi Admin' where id = a;
  perform br_test.ok((public.merchant_basics_queue('admin', 'legacy_admin') -> 0 ->> 'changedSinceRequest')::boolean, 'queue flags the change');
  perform br_test.err(format($s$select public.merchant_basics_review('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'approve', null)$s$, second_id), 'BASICS_CHANGED_SINCE_REQUEST', 'stale approval refused');
  perform br_test.ok((select status from public.merchant_basics_requests where id = second_id) = 'pending', 'still pending');
  update public.merchants set name = 'ZZ BR Kopi' where id = a;

  -- Approve applies every path at once, audited as Admin.
  r := public.merchant_basics_review('admin', 'legacy_admin', rev, second_id, 'approve', null);
  perform br_test.ok(r ->> 'decision' = 'approve' and r ->> 'slug' = 'zz-br-a', 'approved');
  perform br_test.ok((select name = 'ZZ BR Kopi Baru' and address = '2 Jalan Dua' and area = 'Georgetown' and latitude = 5.41 and cuisine = array['Malaysian', 'Cafe']
                        from public.merchants where id = a), 'all basics applied, coordinates kept');
  perform br_test.ok((select status from public.merchant_basics_requests where id = second_id) = 'approved', 'request approved');
  perform br_test.ok((select actor_type = 'admin' and request_id = rev and changed_paths @> array['profile.name', 'location.address', 'tags.cuisine']
                        from public.merchant_change_log where merchant_id = a order by created_at desc, revision desc limit 1), 'audited as Admin');
  perform br_test.ok((public.merchant_basics_review('admin', 'legacy_admin', rev, second_id, 'approve', null) ->> 'replayed')::boolean, 'review replay');
  perform br_test.err(format($s$select public.merchant_basics_review('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'reject', 'late')$s$, second_id), 'VALIDATION_FAILED', 'already decided');

  -- Withdraw and reject.
  r := public.merchant_basics_request_submit('owner', o, l, gen_random_uuid(), '{"tags.cuisine":["Cafe","Western"]}');
  perform public.merchant_basics_request_withdraw('owner', o, l, gen_random_uuid(), (r ->> 'basicsRequestId')::uuid);
  perform br_test.ok((select status from public.merchant_basics_requests where id = (r ->> 'basicsRequestId')::uuid) = 'withdrawn', 'withdrawn');
  perform br_test.err(format($s$select public.merchant_basics_request_withdraw('owner', %L, %L::uuid, gen_random_uuid(), %L::uuid)$s$, o, l, r ->> 'basicsRequestId'), 'RESOURCE_NOT_FOUND', 'withdraw twice');
  r := public.merchant_basics_request_submit('owner', o, l, gen_random_uuid(), '{"profile.name":"ZZ BR Legacy 2"}');
  perform public.merchant_basics_review('admin', 'legacy_admin', gen_random_uuid(), (r ->> 'basicsRequestId')::uuid, 'reject', 'Please send the SSM name');
  perform br_test.ok((select name from public.merchants where id = l) = 'ZZ BR Legacy', 'rejected: unchanged');
  perform br_test.ok(exists (select 1 from jsonb_array_elements(public.merchant_basics_read('owner', o, l) -> 'requests') e
                              where e ->> 'status' = 'rejected' and e ->> 'reviewNote' = 'Please send the SSM name' and e -> 'changes' ->> 'name' = 'ZZ BR Legacy 2'), 'Owner sees the note');

  -- Pending restaurant review freezes requests; suspension blocks them.
  update public.merchants set platform_status = 'PENDING_REVIEW' where id = l;
  perform br_test.err(format(submit, o, l, '{"profile.name":"Y"}'), 'OPERATION_FORBIDDEN', 'frozen while the restaurant is under review');
  perform br_test.ok(public.merchant_basics_read('owner', o, l) ->> 'requestable' = 'false', 'not requestable while under review');
  update public.merchants set platform_status = 'PUBLISHED', platform_restriction = 'suspended' where id = l;
  perform br_test.err(format(submit, o, l, '{"profile.name":"Y"}'), 'MERCHANT_SUSPENDED', 'suspended');
end $$;

-- No direct access for anon/authenticated.
reset role;
set local role anon;
do $$ begin
  perform br_test.err('select count(*) from public.merchant_basics_requests', 'permission denied', 'anon table');
  perform br_test.err($s$select public.merchant_basics_queue('admin', 'legacy_admin')$s$, 'permission denied', 'anon queue');
end $$;
reset role;
set local role authenticated;
do $$ begin
  perform br_test.err($s$select public.merchant_basics_read('admin', 'legacy_admin', '00000000-0000-4000-8000-00000000bb01')$s$, 'permission denied', 'authenticated read');
end $$;
reset role;

select 'ALL BASICS REQUEST BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
