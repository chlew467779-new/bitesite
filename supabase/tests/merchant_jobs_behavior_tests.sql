-- =====================================================================
-- Job posts: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20261004120000_merchant_jobs. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-job-*).
-- =====================================================================
begin;

create schema job_test;
grant usage on schema job_test to public;
create function job_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'JOB TEST FAILED: %', label; end if; end $f$;
create function job_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'JOB TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'JOB TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema job_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000e1a1', 'zz-job-owner-a@example.test'),
  ('00000000-0000-4000-8000-00000000e1a2', 'zz-job-owner-b@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone, whatsapp) values
  ('00000000-0000-4000-8000-00000000e101', 'zz-job-a', 'ZZ JOB A', true, 'PUBLISHED', '+60111111111', '+60111111111'),
  ('00000000-0000-4000-8000-00000000e102', 'zz-job-b', 'ZZ JOB B', false, 'DRAFT', '+60111111112', null);
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000e1a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000e1a2', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000e101';
  b uuid := '00000000-0000-4000-8000-00000000e102';
  oa text := '00000000-0000-4000-8000-00000000e1a1';
  ob text := '00000000-0000-4000-8000-00000000e1a2';
  j1 uuid := '00000000-0000-4000-8000-00000000e201';
  j2 uuid := '00000000-0000-4000-8000-00000000e202';
  r jsonb;
  i integer;
  save text := $s$select public.merchant_job_save('owner', %L, %L::uuid, %L::uuid, %L, %L, %L, %L, %L)$s$;
begin
  -- Validation
  perform job_test.err(format(save, oa, a, gen_random_uuid(), 'x', 'full_time', null, '9-5', 'desc'), 'VALIDATION_FAILED', 'short title');
  perform job_test.err(format(save, oa, a, gen_random_uuid(), 'Cook', 'intern', null, '9-5', 'desc'), 'VALIDATION_FAILED', 'unknown type');
  perform job_test.err(format(save, oa, a, gen_random_uuid(), 'Cook', 'full_time', null, ' ', 'desc'), 'VALIDATION_FAILED', 'hours required');
  perform job_test.err(format(save, oa, a, gen_random_uuid(), 'Cook', 'full_time', null, '9-5', repeat('a', 1001)), 'VALIDATION_FAILED', 'description too long');
  perform job_test.err(format(save, oa, a, gen_random_uuid(), 'Cook', 'full_time', repeat('a', 81), '9-5', 'desc'), 'VALIDATION_FAILED', 'salary too long');

  -- Only public restaurants; only own restaurant
  perform job_test.err(format(save, ob, b, gen_random_uuid(), 'Cook', 'full_time', null, '9-5', 'desc'), 'JOB_NOT_ALLOWED', 'draft restaurant cannot post');
  perform job_test.err(format(save, ob, a, gen_random_uuid(), 'Cook', 'full_time', null, '9-5', 'desc'), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  perform job_test.ok(not (public.merchant_jobs_read('owner', ob, b) ->> 'canPost')::boolean, 'draft canPost false');

  -- Create, retry, update
  r := public.merchant_job_save('owner', oa, a, j1, ' Kitchen helper ', 'part_time', ' RM10/hour ', 'Sat-Sun 10am-4pm', E'Line 1\nLine 2');
  perform job_test.ok(r ->> 'status' = 'created' and r -> 'job' ->> 'title' = 'Kitchen helper' and r -> 'job' ->> 'salary' = 'RM10/hour' and (r -> 'job' ->> 'live')::boolean, 'created');
  perform job_test.ok((select expires_at between now() + interval '29 days' and now() + interval '31 days' from public.merchant_jobs where id = j1), '30 days');
  r := public.merchant_job_save('owner', oa, a, j1, 'Kitchen helper', 'part_time', '', 'Sat-Sun', 'Updated');
  perform job_test.ok(r ->> 'status' = 'updated' and (r -> 'job' -> 'salary') = 'null'::jsonb and (select count(*) from public.merchant_jobs where merchant_id = a) = 1, 'retry/update does not duplicate');
  perform job_test.err(format(save, ob, b, j1, 'Cook', 'full_time', null, '9-5', 'desc'), 'JOB_NOT_ALLOWED', 'other restaurant cannot reuse the id (draft)');
  r := public.merchant_job_save('admin', 'legacy_admin', b, j2, 'Waiter', 'full_time', null, '9-5', 'Admin post');
  perform job_test.ok(r ->> 'status' = 'created' and (select created_by from public.merchant_jobs where id = j2) = 'admin', 'Admin can post for any restaurant');
  perform job_test.err(format(save, oa, a, j2, 'Cook', 'full_time', null, '9-5', 'desc'), 'RESOURCE_NOT_FOUND', 'cannot edit another restaurant''s job');

  -- Close, renew, expiry, limit
  r := public.merchant_job_action('owner', oa, a, j1, 'close');
  perform job_test.ok(r -> 'job' ->> 'status' = 'closed' and not (r -> 'job' ->> 'live')::boolean, 'closed');
  update public.merchant_jobs set expires_at = now() - interval '1 day' where id = j1;
  r := public.merchant_job_action('owner', oa, a, j1, 'renew');
  perform job_test.ok(r -> 'job' ->> 'status' = 'open' and (r -> 'job' ->> 'live')::boolean, 'renewed after expiry');
  for i in 1..9 loop
    perform public.merchant_job_save('owner', oa, a, gen_random_uuid(), 'Job ' || i, 'temporary', null, 'Any', 'desc');
  end loop;
  perform job_test.err(format(save, oa, a, gen_random_uuid(), 'Job 11', 'full_time', null, '9-5', 'desc'), 'JOB_LIMIT', 'eleventh open post refused');
  perform public.merchant_job_action('owner', oa, a, j1, 'close');
  perform public.merchant_job_save('owner', oa, a, gen_random_uuid(), 'Job 11', 'full_time', null, '9-5', 'desc');
  perform job_test.err(format($s$select public.merchant_job_action('owner', %L, %L::uuid, %L::uuid, 'renew')$s$, oa, a, j1), 'JOB_LIMIT', 'renew counts the limit');
  perform job_test.err(format($s$select public.merchant_job_action('owner', %L, %L::uuid, %L::uuid, 'publish')$s$, oa, a, j1), 'VALIDATION_FAILED', 'unknown action');

  -- Admin hide / list
  perform job_test.err(format($s$select public.merchant_job_admin_hide('admin', 'legacy_admin', %L::uuid, true, ' ')$s$, j1), 'VALIDATION_FAILED', 'hide needs a note');
  r := public.merchant_job_admin_hide('admin', 'legacy_admin', j1, true, 'Looks like a scam');
  perform job_test.ok((r -> 'job' ->> 'hidden')::boolean and (public.merchant_jobs_read('owner', oa, a) -> 'jobs') @> jsonb_build_array(jsonb_build_object('id', j1, 'hiddenNote', 'Looks like a scam')), 'Owner sees the hide note');
  r := public.merchant_job_admin_list('admin', 'legacy_admin', 'hidden');
  perform job_test.ok(jsonb_array_length(r -> 'items') >= 1 and (r -> 'items' -> 0 ->> 'id')::uuid = j1, 'hidden filter');
  perform job_test.err($s$select public.merchant_job_admin_list('owner', 'x', 'all')$s$, 'OPERATION_FORBIDDEN', 'list is Admin only');
  r := public.merchant_job_admin_hide('admin', 'legacy_admin', j1, false, null);
  perform job_test.ok(not (r -> 'job' ->> 'hidden')::boolean, 'unhide');

  -- Reports on a job
  perform public.merchant_job_action('owner', oa, a, (select id from public.merchant_jobs where merchant_id = a and title = 'Job 1'), 'close');
  perform public.merchant_job_action('owner', oa, a, j1, 'renew');
  r := public.public_report_submit('job', j1::text, 'scam', 'asks for a deposit', null, repeat('a', 64));
  perform job_test.ok(r ->> 'status' = 'applied' and (select job_id from public.public_reports where id = (r ->> 'reportId')::uuid) = j1, 'job report stored');
  r := public.public_report_submit('job', j1::text, 'scam', null, null, repeat('a', 64));
  perform job_test.ok(r ->> 'status' = 'duplicate', 'duplicate job report');
  perform job_test.err($s$select public.public_report_submit('job', '00000000-0000-4000-8000-00000000e202', 'scam', null, null, repeat('b', 64))$s$, 'RESOURCE_NOT_FOUND', 'job of a draft restaurant cannot be reported');
  perform job_test.err($s$select public.public_report_submit('job', 'not-a-uuid', 'scam', null, null, repeat('b', 64))$s$, 'RESOURCE_NOT_FOUND', 'bad job id');
  perform job_test.err(format($s$select public.public_report_submit('job', %L, 'fake', null, null, repeat('b', 64))$s$, j1), 'VALIDATION_FAILED', 'merchant reason not valid for a job');
  r := public.public_report_queue('admin', 'legacy_admin', 'new');
  perform job_test.ok(exists (select 1 from jsonb_array_elements(r -> 'items') x where x ->> 'targetType' = 'job' and (x ->> 'jobId')::uuid = j1 and x ->> 'slug' = 'zz-job-a' and x ->> 'name' like 'Kitchen helper — ZZ JOB A'), 'queue shows the job');
  perform job_test.ok((public.merchant_job_admin_list('admin', 'legacy_admin', 'all') -> 'items') @> jsonb_build_array(jsonb_build_object('id', j1, 'openReports', 1)), 'admin list counts open reports');
  r := public.public_report_submit('merchant', 'zz-job-a', 'hours', null, null, repeat('c', 64));
  perform job_test.ok(r ->> 'status' = 'applied', 'merchant reports still work');

  -- Delete
  r := public.merchant_job_action('owner', oa, a, j1, 'delete');
  perform job_test.ok(not exists (select 1 from public.merchant_jobs where id = j1)
    and exists (select 1 from public.public_reports where target_type = 'job' and job_id is null), 'delete keeps the report without the job');
end $$;

reset role;
set local role anon;
select job_test.ok((select count(*) from public.merchant_jobs where merchant_id = '00000000-0000-4000-8000-00000000e101') = 9, 'anon sees open unhidden unexpired posts of the public restaurant (9 of 11)');
select job_test.ok((select count(*) from public.merchant_jobs where merchant_id = '00000000-0000-4000-8000-00000000e102') = 0, 'anon does not see a draft restaurant''s post');
select job_test.err($q$select created_by from public.merchant_jobs$q$, 'permission denied', 'created_by is private');
select job_test.err($q$select hidden_note from public.merchant_jobs$q$, 'permission denied', 'hidden_note is private');
select job_test.err($q$insert into public.merchant_jobs (id, merchant_id, title, job_type, hours, description, created_by) values (gen_random_uuid(), '00000000-0000-4000-8000-00000000e101', 'xx', 'full_time', 'x', 'x', 'x')$q$, 'permission denied', 'anon cannot insert');
select job_test.err($q$select public.merchant_job_admin_list('admin', 'legacy_admin', 'all')$q$, 'permission denied', 'anon cannot call');
reset role;
set local role authenticated;
select job_test.err($q$select public.merchant_job_save('owner', '00000000-0000-4000-8000-00000000e1a1', '00000000-0000-4000-8000-00000000e101', gen_random_uuid(), 'Cook', 'full_time', null, '9-5', 'x')$q$, 'permission denied', 'authenticated cannot call save');
reset role;

select 'ALL JOB BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
