-- =====================================================================
-- Visitor reports: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260928130000_public_reports. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema pr_test;
grant usage on schema pr_test to public;
create function pr_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'REPORT TEST FAILED: %', label; end if; end $f$;
create function pr_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'REPORT TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'REPORT TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema pr_test to public;

insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-0000000d0e01', 'zz-pr-public', 'ZZ PR Public', true, 'PUBLISHED', '+60111111111'),
  ('00000000-0000-4000-8000-0000000d0e02', 'zz-pr-hidden', 'ZZ PR Hidden', false, 'DRAFT', '+60111111112');
insert into public.articles (id, slug, title, content, category, published, editorial_status) values
  ('00000000-0000-4000-8000-0000000d0ea1', 'zz-pr-story', 'ZZ PR Story', 'x', 'news', true, 'published'),
  ('00000000-0000-4000-8000-0000000d0ea2', 'zz-pr-draft-story', 'ZZ PR Draft', 'x', 'news', false, 'draft');

set local role service_role;

do $$
declare
  h1 text := repeat('a', 64);
  h2 text := repeat('b', 64);
  r jsonb;
  q jsonb;
  rid uuid;
  i int;
  call text := $s$select public.public_report_submit(%L, %L, %L, %L, %L, %L)$s$;
begin
  -- Validation and visibility.
  perform pr_test.err(format(call, 'merchant', 'zz-pr-hidden', 'closed', null, null, h1), 'RESOURCE_NOT_FOUND', 'hidden restaurant looks missing');
  perform pr_test.err(format(call, 'story', 'zz-pr-draft-story', 'rights', null, null, h1), 'RESOURCE_NOT_FOUND', 'draft Story looks missing');
  perform pr_test.err(format(call, 'merchant', 'zz-pr-public', 'rights', null, null, h1), 'VALIDATION_FAILED', 'Story reason on a restaurant');
  perform pr_test.err(format(call, 'merchant', 'zz-pr-public', 'closed', null, 'not-an-email', h1), 'VALIDATION_FAILED', 'bad contact email');
  perform pr_test.err(format(call, 'merchant', 'zz-pr-public', 'closed', null, null, '192.168.0.1'), 'VALIDATION_FAILED', 'raw IP refused');
  perform pr_test.err(format(call, 'merchant', 'zz-pr-public', 'closed', repeat('x', 1001), null, h1), 'VALIDATION_FAILED', 'note length');

  -- Submit, duplicate, other reason.
  r := public.public_report_submit('merchant', 'zz-pr-public', 'closed', '  Shop has been shut for weeks ', ' Me@Example.test ', h1);
  rid := (r ->> 'reportId')::uuid;
  perform pr_test.ok((select note = 'Shop has been shut for weeks' and contact_email = 'me@example.test' and target_name = 'ZZ PR Public' and status = 'new'
                        from public.public_reports where id = rid), 'stored, trimmed');
  perform pr_test.ok(public.public_report_submit('merchant', 'zz-pr-public', 'closed', 'again', null, h1) ->> 'status' = 'duplicate', 'same reporter+reason within 24h');
  perform pr_test.ok(public.public_report_submit('merchant', 'zz-pr-public', 'hours', null, null, h1) ->> 'status' = 'applied', 'another reason counts');
  perform pr_test.ok(public.public_report_submit('merchant', 'zz-pr-public', 'closed', null, null, h2) ->> 'status' = 'applied', 'another reporter counts');
  perform pr_test.ok(public.public_report_submit('story', 'zz-pr-story', 'personal_data', 'That is me in photo 2', null, h2) ->> 'status' = 'applied', 'Story report');

  -- Per-reporter limit: 20 per 24 hours.
  insert into public.public_reports (target_type, merchant_id, target_slug, target_name, reason, reporter_hash)
  select 'merchant', '00000000-0000-4000-8000-0000000d0e01', 'zz-pr-public', 'ZZ PR Public', 'other', repeat('7', 64) from generate_series(1, 20);
  perform pr_test.err(format(call, 'merchant', 'zz-pr-public', 'menu', null, null, repeat('7', 64)), 'REPORT_LIMIT', 'limit per reporter');

  -- Queue and decisions.
  q := public.public_report_queue('admin', 'legacy_admin', 'new');
  perform pr_test.ok((q -> 'counts' ->> 'new')::int >= 4, 'counts');
  perform pr_test.ok(exists (select 1 from jsonb_array_elements(q -> 'items') e where e ->> 'id' = rid::text and (e ->> 'sameTargetOpen')::int >= 1), 'queue shows other open reports for the same page');
  perform pr_test.err($s$select public.public_report_queue('owner', 'x', null)$s$, 'OPERATION_FORBIDDEN', 'Admin only');
  perform public.public_report_decide('admin', 'legacy_admin', rid, 'resolved', 'Called: still open, hours fixed');
  perform pr_test.ok((select status = 'resolved' and decided_at is not null and admin_note like 'Called%' from public.public_reports where id = rid), 'resolved with note');
  perform public.public_report_decide('admin', 'legacy_admin', rid, 'new', null);
  perform pr_test.ok((select status = 'new' and decided_at is null and admin_note like 'Called%' from public.public_reports where id = rid), 'reopened keeps the note');
  perform pr_test.err(format($s$select public.public_report_decide('admin', 'legacy_admin', %L::uuid, 'deleted', null)$s$, rid), 'VALIDATION_FAILED', 'unknown status');

  -- A deleted restaurant keeps the report (unlinked) for the record.
  delete from public.merchants where id = '00000000-0000-4000-8000-0000000d0e01';
  perform pr_test.ok((select merchant_id is null and target_slug = 'zz-pr-public' from public.public_reports where id = rid), 'report survives, unlinked');
  perform pr_test.ok(exists (select 1 from jsonb_array_elements(public.public_report_queue('admin', 'legacy_admin', null) -> 'items') e
                              where e ->> 'id' = rid::text and (e ->> 'targetGone')::boolean), 'queue marks it gone');
end $$;

reset role;
set local role anon;
do $$ begin
  perform pr_test.err('select count(*) from public.public_reports', 'permission denied', 'anon table');
  perform pr_test.err($s$select public.public_report_submit('merchant', 'x', 'closed', null, null, repeat('a', 64))$s$, 'permission denied', 'anon cannot call the RPC directly');
end $$;
reset role;

select 'ALL PUBLIC REPORT BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
