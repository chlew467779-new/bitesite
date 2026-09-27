-- =====================================================================
-- M2-B listing review: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927130000_merchant_listing_review. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-m2b-*). Concurrency of the last slot is covered by the HTTP smoke test.
-- =====================================================================
begin;

create schema m2b_test;
grant usage on schema m2b_test to public;
create function m2b_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'M2B TEST FAILED: %', label; end if; end $f$;
create function m2b_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'M2B TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'M2B TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema m2b_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000b2ba1', 'zz-m2b-owner-a@example.test'),
  ('00000000-0000-4000-8000-0000000b2ba2', 'zz-m2b-owner-b@example.test');
-- A: managed draft as #64 creates it. B: second draft of Owner B. L: legacy restaurant of Owner A.
insert into public.merchants (id, slug, name, state_source, review_status, listing_visibility, platform_restriction) values
  ('00000000-0000-4000-8000-0000000b2b01', 'restaurant-00000000-0000-4000-8000-0000000b2b01', 'ZZ M2B Kopi Ah Seng', 'managed', 'draft', 'hidden', 'none'),
  ('00000000-0000-4000-8000-0000000b2b02', 'restaurant-00000000-0000-4000-8000-0000000b2b02', 'ZZ M2B Two', 'managed', 'draft', 'hidden', 'none');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-0000000b2b03', 'zz-m2b-legacy', 'ZZ M2B Legacy', true, 'PUBLISHED', '+60111111111');
-- An existing slug the generated one collides with.
insert into public.merchants (id, slug, name) values ('00000000-0000-4000-8000-0000000b2b04', 'zz-m2b-kopi-ah-seng', 'ZZ taken');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000b2b01', '00000000-0000-4000-8000-0000000b2ba1', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000b2b03', '00000000-0000-4000-8000-0000000b2ba1', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000b2b02', '00000000-0000-4000-8000-0000000b2ba2', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000b2b01';
  b uuid := '00000000-0000-4000-8000-0000000b2b02';
  leg uuid := '00000000-0000-4000-8000-0000000b2b03';
  oa text := '00000000-0000-4000-8000-0000000b2ba1';
  ob text := '00000000-0000-4000-8000-0000000b2ba2';
  r jsonb;
  s jsonb;
  req uuid := gen_random_uuid();
  sub uuid;
  cat uuid;
  apply text := $s$select public.merchant_listing_apply('owner', %L, %L::uuid, gen_random_uuid(), %L)$s$;
  basics text := $s$select public.merchant_listing_basics_patch('owner', %L, %L::uuid, gen_random_uuid(), %L::jsonb)$s$;
  ex_null jsonb := jsonb_build_object('exists', true, 'value', null);
begin
  -- Listing basics: Admin-only paths stay Admin-only through the normal Owner save.
  perform m2b_test.err(format($s$select public.merchant_field_patch('owner', %L, %L::uuid, gen_random_uuid(), '[{"path":"profile.name","expected":{"exists":true,"value":"ZZ M2B Kopi Ah Seng"},"value":"x"}]'::jsonb)$s$, oa, a),
    'FIELD_NOT_WRITABLE', 'normal Owner save cannot rename');
  r := public.merchant_listing_basics_patch('owner', oa, a, req, jsonb_build_array(
    jsonb_build_object('path', 'location', 'expected', jsonb_build_object('exists', true, 'value',
      jsonb_build_object('address', null, 'area', null, 'latitude', null, 'longitude', null)),
      'value', jsonb_build_object('address', '1 Jalan ZZ, Georgetown', 'area', 'Georgetown', 'latitude', null, 'longitude', null)),
    jsonb_build_object('path', 'tags.cuisine', 'expected', jsonb_build_object('exists', true, 'value', '[]'::jsonb), 'value', '["Chinese"]'::jsonb)));
  perform m2b_test.ok(r ->> 'status' = 'applied' and (select address from public.merchants where id = a) = '1 Jalan ZZ, Georgetown', 'Owner fills basics of a draft');
  perform m2b_test.ok((select actor_type from public.merchant_change_log where merchant_id = a order by created_at desc, revision desc limit 1) = 'owner', 'basics audited as the Owner');
  perform m2b_test.ok(coalesce(current_setting('app.listing_basics', true), '') = '', 'basics flag cleared after the call');
  perform m2b_test.ok((select count(*) from private.merchant_field_registry() where owner_writable) = 12, 'registry back to Owner paths');
  r := public.merchant_listing_basics_patch('owner', oa, a, req, jsonb_build_array(
    jsonb_build_object('path', 'location', 'expected', jsonb_build_object('exists', true, 'value',
      jsonb_build_object('address', null, 'area', null, 'latitude', null, 'longitude', null)),
      'value', jsonb_build_object('address', '1 Jalan ZZ, Georgetown', 'area', 'Georgetown', 'latitude', null, 'longitude', null)),
    jsonb_build_object('path', 'tags.cuisine', 'expected', jsonb_build_object('exists', true, 'value', '[]'::jsonb), 'value', '["Chinese"]'::jsonb)));
  perform m2b_test.ok((r ->> 'replayed')::boolean, 'basics replay');
  perform m2b_test.err(format(basics, oa, a, '[{"path":"profile.tagline","expected":{"exists":true,"value":null},"value":"x"}]'), 'VALIDATION_FAILED', 'basics call only takes basics paths');
  perform m2b_test.err(format(basics, ob, a, '[{"path":"profile.name","expected":{"exists":true,"value":"ZZ M2B Kopi Ah Seng"},"value":"x"}]'), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  perform m2b_test.err(format(basics, oa, leg, '[{"path":"profile.name","expected":{"exists":true,"value":"ZZ M2B Legacy"},"value":"x"}]'), 'FIELD_NOT_WRITABLE', 'legacy restaurant basics stay Admin-only');

  -- Submit requires the checklist.
  s := public.merchant_listing_read('owner', oa, a);
  perform m2b_test.ok(s #>> '{state,checks,contact}' = 'false' and s #>> '{state,checks,dish}' = 'false' and s #>> '{state,checks,address}' = 'true', 'checks reported');
  perform m2b_test.ok(not (s -> 'state' -> 'allowedActions') ? 'submit', 'submit not offered yet');
  perform m2b_test.err(format(apply, oa, a, 'submit'), 'LISTING_INCOMPLETE', 'incomplete submit');
  perform public.merchant_field_patch('owner', oa, a, gen_random_uuid(), jsonb_build_array(
    jsonb_build_object('path', 'profile.phone', 'expected', ex_null, 'value', '+60 4-123 4567')));
  r := public.merchant_menu_apply('owner', oa, a, gen_random_uuid(), '{"type":"create_category","name":"Drinks"}'::jsonb);
  cat := (select id from public.categories where merchant_id = a limit 1);
  perform public.merchant_menu_apply('owner', oa, a, gen_random_uuid(), jsonb_build_object('type', 'create_product', 'categoryId', cat, 'name', 'Kopi O', 'price', 2.5));
  perform m2b_test.ok((public.merchant_listing_read('owner', oa, a) -> 'state' -> 'allowedActions') ? 'submit', 'submit offered when complete');

  perform m2b_test.err(format(apply, oa, leg, 'submit'), 'LISTING_ACTION_NOT_ALLOWED', 'legacy restaurants are not submitted');
  perform m2b_test.err(format(apply, oa, a, 'publish'), 'LISTING_ACTION_NOT_ALLOWED', 'cannot publish a draft');

  -- Pilot capacity is independent of the pending queue (and drafts use neither).
  perform public.merchant_review_capacity_set('admin', 'legacy_admin', 20, 0);
  perform m2b_test.err(format(apply, oa, a, 'submit'), 'PILOT_CAPACITY_FULL', 'pilot full with queue free');
  perform public.merchant_review_capacity_set('admin', 'legacy_admin', 20, 50);
  -- Submit: pending, frozen, snapshot, notification.
  req := gen_random_uuid();
  r := public.merchant_listing_apply('owner', oa, a, req, 'submit');
  perform m2b_test.ok(r ->> 'status' = 'applied' and (select review_status from public.merchants where id = a) = 'pending', 'submitted');
  perform m2b_test.ok((select platform_status from public.merchants where id = a) = 'PENDING_REVIEW' and not (select is_published from public.merchants where id = a), 'pending mirrors, not public');
  sub := (select id from public.merchant_review_submissions where merchant_id = a and status = 'pending');
  perform m2b_test.ok((select snapshot ->> 'name' from public.merchant_review_submissions where id = sub) = 'ZZ M2B Kopi Ah Seng'
                      and jsonb_array_length((select snapshot #> '{menu,products}' from public.merchant_review_submissions where id = sub)) = 1, 'snapshot holds content and menu');
  perform m2b_test.ok(exists (select 1 from public.merchant_notifications where merchant_id = a and kind = 'review_submitted' and audience = 'admin'), 'admin notified');
  perform m2b_test.ok((public.merchant_listing_apply('owner', oa, a, req, 'submit') ->> 'replayed')::boolean, 'submit replay');
  perform m2b_test.ok(public.merchant_listing_apply('owner', oa, a, gen_random_uuid(), 'submit') ->> 'status' = 'noop', 'second submit is a no-op');
  perform m2b_test.err(format($s$select public.merchant_field_patch('owner', %L, %L::uuid, gen_random_uuid(), '[{"path":"profile.tagline","expected":{"exists":true,"value":null},"value":"x"}]'::jsonb)$s$, oa, a),
    'OPERATION_FORBIDDEN', 'pending content frozen for the Owner');
  perform m2b_test.err(format($s$select public.merchant_menu_apply('owner', %L, %L::uuid, gen_random_uuid(), '{"type":"create_category","name":"More"}'::jsonb)$s$, oa, a),
    'OPERATION_FORBIDDEN', 'pending menu frozen');
  perform m2b_test.err(format($s$select public.merchant_field_patch('admin', 'legacy_admin', %L::uuid, gen_random_uuid(), '[{"path":"profile.tagline","expected":{"exists":true,"value":null},"value":"x"}]'::jsonb)$s$, a),
    'OPERATION_FORBIDDEN', 'pending content frozen for Admin');

  -- One pending per Owner; capacity.
  perform public.merchant_review_capacity_set('admin', 'legacy_admin', 1);
  update public.merchants set phone = '+60 4-765 4321', address = '2 Jalan ZZ', cuisine = '{Malay}' where id = b;
  insert into public.categories (id, merchant_id, name) values ('00000000-0000-4000-8000-0000000b2bc2', b, 'Mains');
  insert into public.products (merchant_id, category_id, name) values (b, '00000000-0000-4000-8000-0000000b2bc2', 'Nasi Lemak');
  perform m2b_test.err(format(apply, ob, b, 'submit'), 'REVIEW_CAPACITY_FULL', 'capacity full');
  perform public.merchant_review_capacity_set('admin', 'legacy_admin', 20);
  perform m2b_test.err($s$select public.merchant_review_capacity_set('owner', '00000000-0000-4000-8000-0000000b2ba1', 5)$s$, 'OPERATION_FORBIDDEN', 'Owner cannot set capacity');
  perform m2b_test.ok((public.merchant_review_queue('admin', 'legacy_admin') ->> 'pending')::int >= 1, 'queue counts pending');

  -- Withdraw frees the slot; resubmit.
  r := public.merchant_listing_apply('owner', oa, a, gen_random_uuid(), 'withdraw');
  perform m2b_test.ok((select review_status from public.merchants where id = a) = 'draft' and (select status from public.merchant_review_submissions where id = sub) = 'withdrawn', 'withdrawn');
  perform m2b_test.err(format(apply, oa, a, 'withdraw'), 'LISTING_ACTION_NOT_ALLOWED', 'withdraw needs pending');
  perform public.merchant_listing_apply('owner', oa, a, gen_random_uuid(), 'submit');
  sub := (select id from public.merchant_review_submissions where merchant_id = a and status = 'pending');

  -- Reject needs a note; keeps the draft editable.
  perform m2b_test.err(format($s$select public.merchant_review_decide('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'reject', ' ')$s$, sub), 'VALIDATION_FAILED', 'reject needs a note');
  perform m2b_test.err(format($s$select public.merchant_review_decide('owner', %L, gen_random_uuid(), %L::uuid, 'approve', null)$s$, oa, sub), 'OPERATION_FORBIDDEN', 'Owner cannot decide');
  r := public.merchant_review_decide('admin', 'legacy_admin', gen_random_uuid(), sub, 'reject', 'Please add a real photo of the shop.');
  perform m2b_test.ok((select review_status from public.merchants where id = a) = 'rejected'
                      and (public.merchant_listing_read('owner', oa, a) #>> '{state,lastDecision,note}') = 'Please add a real photo of the shop.', 'rejected with note shown to the Owner');
  perform m2b_test.ok(exists (select 1 from public.merchant_notifications where merchant_id = a and kind = 'review_rejected' and message like 'Please add%'), 'owner notified of rejection');
  perform m2b_test.ok((public.merchant_listing_read('owner', oa, a) #>> '{state,basicsEditable}')::boolean, 'rejected draft editable again');
  perform m2b_test.err(format($s$select public.merchant_review_decide('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'approve', null)$s$, sub), 'VALIDATION_FAILED', 'decided submission cannot be decided again');

  -- Approval validates the exact submitted version.
  perform public.merchant_listing_apply('owner', oa, a, gen_random_uuid(), 'submit');
  sub := (select id from public.merchant_review_submissions where merchant_id = a and status = 'pending');
  reset role;
  update public.products set price = 3.0 where merchant_id = a;  -- a change behind the freeze (e.g. an old Admin path)
  set local role service_role;
  perform m2b_test.ok((public.merchant_review_queue('admin', 'legacy_admin') -> 'items') @> jsonb_build_array(jsonb_build_object('id', sub, 'changed', true)), 'queue flags the change');
  perform m2b_test.err(format($s$select public.merchant_review_decide('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'approve', null)$s$, sub), 'SUBMISSION_CHANGED', 'changed content not approved');
  reset role;
  update public.products set price = 2.5 where merchant_id = a;
  set local role service_role;
  req := gen_random_uuid();
  r := public.merchant_review_decide('admin', 'legacy_admin', req, sub, 'approve', null);
  perform m2b_test.ok((select review_status from public.merchants where id = a) = 'approved' and (select listing_visibility from public.merchants where id = a) = 'hidden'
                      and not (select is_published from public.merchants where id = a), 'approved but still hidden');
  perform m2b_test.ok((public.merchant_review_decide('admin', 'legacy_admin', req, sub, 'approve', null) ->> 'replayed')::boolean, 'decision replay');
  perform m2b_test.err(format(basics, oa, a, '[{"path":"profile.name","expected":{"exists":true,"value":"ZZ M2B Kopi Ah Seng"},"value":"x"}]'), 'FIELD_NOT_WRITABLE', 'basics locked after approval');
  perform m2b_test.err(format(apply, oa, a, 'submit'), 'LISTING_ACTION_NOT_ALLOWED', 'approved restaurants are not resubmitted');

  perform m2b_test.ok((public.merchant_review_queue('admin', 'legacy_admin') ->> 'pending')::int = 0, 'approval releases queue place');
  perform public.merchant_review_capacity_set('admin', 'legacy_admin', 20,
    (public.merchant_review_queue('admin', 'legacy_admin') ->> 'pilotUsed')::int);
  perform m2b_test.err(format(apply, ob, b, 'submit'), 'PILOT_CAPACITY_FULL', 'approved hidden restaurant retains pilot place');
  perform public.merchant_review_capacity_set('admin', 'legacy_admin', 20, 50);

  -- Publish: public, first slug from the name (numbered on collision), hide / publish again.
  req := gen_random_uuid();
  r := public.merchant_listing_apply('owner', oa, a, req, 'publish');
  perform m2b_test.ok((select is_published from public.merchants where id = a) and (select platform_status from public.merchants where id = a) = 'PUBLISHED', 'published and public');
  perform m2b_test.ok(r ->> 'slug' = 'zz-m2b-kopi-ah-seng-2' and r ->> 'previousSlug' = 'restaurant-' || a::text, 'slug from the name, numbered on collision');
  perform m2b_test.ok((select first_published_at from public.merchants where id = a) is not null, 'first publication time');
  perform m2b_test.ok((public.merchant_listing_apply('owner', oa, a, req, 'publish') ->> 'replayed')::boolean, 'publish replay');
  perform m2b_test.ok(public.merchant_listing_apply('owner', oa, a, gen_random_uuid(), 'publish') ->> 'status' = 'noop', 'publish twice is a no-op');
  perform public.merchant_listing_apply('owner', oa, a, gen_random_uuid(), 'hide');
  perform m2b_test.ok(not (select is_published from public.merchants where id = a), 'hidden');
  perform public.merchant_listing_apply('owner', oa, a, gen_random_uuid(), 'publish');
  perform m2b_test.ok((select slug from public.merchants where id = a) = 'zz-m2b-kopi-ah-seng-2', 'slug kept after the first publication');

  -- Suspension: Admin governance still applies to managed rows; Owner cannot act.
  perform public.merchant_governance_apply('admin', 'legacy_admin', a, gen_random_uuid(), 'suspend', 'zz test');
  perform m2b_test.ok(not (select is_published from public.merchants where id = a), 'suspended not public');
  perform m2b_test.err(format(apply, oa, a, 'hide'), 'MERCHANT_SUSPENDED', 'suspended Owner cannot act');
  perform public.merchant_governance_apply('admin', 'legacy_admin', a, gen_random_uuid(), 'unsuspend', 'zz test');
  perform m2b_test.ok((select is_published from public.merchants where id = a), 'lifting restores the public listing');

  -- Public menu minimum still protects the published restaurant.
  perform m2b_test.err(format($s$select public.merchant_menu_apply('owner', %L, %L::uuid, gen_random_uuid(), jsonb_build_object('type','delete_product','id',(select id from public.products where merchant_id = %L::uuid limit 1)))$s$, oa, a, a),
    'PUBLIC_MENU_MINIMUM', 'last dish kept');

  perform m2b_test.ok(private.merchant_slug_base('老字号', b) = 'restaurant-' || left(b::text, 8), 'non-Latin names get a short fallback');
end $$;

reset role;
do $$
begin
  if has_function_privilege('authenticated', 'public.merchant_listing_apply(text,text,uuid,uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.merchant_review_decide(text,text,uuid,uuid,text,text)', 'execute')
     or has_table_privilege('authenticated', 'public.merchant_review_submissions', 'select') then
    raise exception 'M2B TEST FAILED: browser roles have access';
  end if;
end $$;

select 'ALL M2B LISTING REVIEW BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
