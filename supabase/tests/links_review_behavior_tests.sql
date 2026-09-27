-- =====================================================================
-- Link review queue: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927120000_merchant_link_review. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-lnk-*).
-- =====================================================================
begin;

create schema lnk_test;
grant usage on schema lnk_test to public;
create function lnk_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'LINK TEST FAILED: %', label; end if; end $f$;
create function lnk_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'LINK TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'LINK TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema lnk_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000f1a1', 'zz-lnk-owner-a@example.test'),
  ('00000000-0000-4000-8000-00000000f1a2', 'zz-lnk-owner-b@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone, website) values
  ('00000000-0000-4000-8000-00000000f101', 'zz-lnk-a', 'ZZ LNK A', true, 'PUBLISHED', '+60111111111', 'https://old.example.com');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000f1a1', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000f101';
  oa text := '00000000-0000-4000-8000-00000000f1a1';
  ob text := '00000000-0000-4000-8000-00000000f1a2';
  r jsonb;
  req uuid := gen_random_uuid();
  l1 uuid;
  l2 uuid;
  sub text := $s$select public.merchant_link_request_submit('owner', %L, %L::uuid, gen_random_uuid(), %L, %L)$s$;
begin
  -- URL rules
  perform lnk_test.ok(private.merchant_link_problem('website', 'https://shop.example.com/a?b=1') is null, 'normal website');
  perform lnk_test.ok(private.merchant_link_problem('website', 'http://shop.example.com') = 'https_only', 'http refused');
  perform lnk_test.ok(private.merchant_link_problem('website', 'javascript:alert(1)') = 'https_only', 'javascript refused');
  perform lnk_test.ok(private.merchant_link_problem('website', 'https://user:pw@shop.example.com') = 'credentials', 'credentials refused');
  perform lnk_test.ok(private.merchant_link_problem('website', 'https://127.0.0.1/x') = 'host', 'IP refused');
  perform lnk_test.ok(private.merchant_link_problem('instagram', 'https://www.instagram.com/zz') is null, 'instagram ok');
  perform lnk_test.ok(private.merchant_link_problem('instagram', 'https://instagram.com.evil.io/zz') = 'host_instagram', 'look-alike refused');
  perform lnk_test.ok(private.merchant_link_problem('grabfood', 'https://food.grab.com/my/en/restaurant/x') is null, 'grab ok');
  perform lnk_test.ok(private.merchant_link_problem('grabfood', 'https://notgrab.com/x') = 'host_grabfood', 'grab look-alike refused');

  -- Owner submits; nothing public changes yet
  r := public.merchant_link_request_submit('owner', oa, a, req, 'website', ' https://new.example.com ');
  l1 := (r ->> 'linkRequestId')::uuid;
  perform lnk_test.ok(r ->> 'status' = 'applied' and (select website from public.merchants where id = a) = 'https://old.example.com', 'request recorded, link unchanged');
  r := public.merchant_link_request_submit('owner', oa, a, req, 'website', ' https://new.example.com ');
  perform lnk_test.ok((r ->> 'replayed')::boolean, 'replay');
  perform lnk_test.err(format(sub, oa, a, 'instagram', 'https://evil.io/x'), 'INVALID_LINK', 'bad instagram');
  perform lnk_test.err(format(sub, ob, a, 'website', 'https://x.example.com'), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  perform lnk_test.err(format($s$select public.merchant_link_request_submit('admin', 'legacy_admin', %L::uuid, gen_random_uuid(), 'website', 'https://x.example.com')$s$, a), 'OPERATION_FORBIDDEN', 'Admin uses admin_set');

  -- a newer request supersedes; approve applies
  r := public.merchant_link_request_submit('owner', oa, a, gen_random_uuid(), 'website', 'https://newer.example.com');
  l2 := (r ->> 'linkRequestId')::uuid;
  perform lnk_test.ok((select status from public.merchant_link_requests where id = l1) = 'superseded', 'older request superseded');
  perform lnk_test.err(format($s$select public.merchant_link_review('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'reject', ' ')$s$, l2), 'VALIDATION_FAILED', 'reject needs a note');
  r := public.merchant_link_review('admin', 'legacy_admin', gen_random_uuid(), l2, 'approve', null);
  perform lnk_test.ok((select website from public.merchants where id = a) = 'https://newer.example.com'
    and exists (select 1 from public.merchant_change_log where merchant_id = a and operation = 'merchant_link_review:website'), 'approve applies and audits');

  -- GrabFood (separate table) and stale approval
  r := public.merchant_link_request_submit('owner', oa, a, gen_random_uuid(), 'grabfood', 'https://food.grab.com/my/en/restaurant/zz');
  l1 := (r ->> 'linkRequestId')::uuid;
  r := public.merchant_link_admin_set('admin', 'legacy_admin', a, gen_random_uuid(), 'grabfood', 'https://food.grab.com/my/en/restaurant/admin', null);
  perform lnk_test.ok(r ->> 'status' = 'applied' and (select status from public.merchant_link_requests where id = l1) = 'superseded', 'Admin edit supersedes the pending request');
  r := public.merchant_link_request_submit('owner', oa, a, gen_random_uuid(), 'grabfood', null);
  l2 := (r ->> 'linkRequestId')::uuid;
  update public.merchant_external_links set url = 'https://food.grab.com/changed' where merchant_id = a and link_type = 'grabfood';
  perform lnk_test.err(format($s$select public.merchant_link_review('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'approve', null)$s$, l2), 'LINK_CHANGED_SINCE_REQUEST', 'stale approval refused');
  r := public.merchant_link_review('admin', 'legacy_admin', gen_random_uuid(), l2, 'reject', 'Link changed meanwhile');
  perform lnk_test.ok((select status from public.merchant_link_requests where id = l2) = 'rejected', 'reject');

  -- Admin direct set with compare-and-set; withdraw; read and queue
  r := public.merchant_link_admin_set('admin', 'legacy_admin', a, gen_random_uuid(), 'instagram', 'https://instagram.com/zz', 'https://stale');
  perform lnk_test.ok(r ->> 'status' = 'conflict', 'admin_set conflict');
  r := public.merchant_link_request_submit('owner', oa, a, gen_random_uuid(), 'facebook', 'https://facebook.com/zz');
  r := public.merchant_link_request_withdraw('owner', oa, a, gen_random_uuid(), (r ->> 'linkRequestId')::uuid);
  perform lnk_test.ok(not exists (select 1 from public.merchant_link_requests where merchant_id = a and status = 'pending'), 'withdrawn');
  r := public.merchant_links_read('owner', oa, a);
  perform lnk_test.ok(r -> 'links' ->> 'website' = 'https://newer.example.com' and jsonb_array_length(r -> 'requests') >= 1, 'read');
  r := public.merchant_link_request_submit('owner', oa, a, gen_random_uuid(), 'menu_pdf_url', 'https://files.example.com/menu.pdf');
  perform lnk_test.ok(jsonb_array_length(public.merchant_link_queue('admin', 'legacy_admin')) >= 1, 'queue');
  perform lnk_test.err($s$select public.merchant_link_queue('owner', 'x')$s$, 'OPERATION_FORBIDDEN', 'queue is Admin only');
end $$;

reset role;
set local role authenticated;
select lnk_test.err($q$select public.merchant_link_queue('admin', 'legacy_admin')$q$, 'permission denied', 'authenticated cannot call');
select lnk_test.err($q$select * from public.merchant_link_requests$q$, 'permission denied', 'request table is private');
reset role;

select 'ALL LINK REVIEW BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
