-- =====================================================================
-- Merchant feedback: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927160000_merchant_feedback. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-fb-*).
-- =====================================================================
begin;

create schema fb_test;
grant usage on schema fb_test to public;
create function fb_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'FEEDBACK TEST FAILED: %', label; end if; end $f$;
create function fb_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'FEEDBACK TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'FEEDBACK TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema fb_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000fba1', 'zz-fb-owner-a@example.test'),
  ('00000000-0000-4000-8000-00000000fba2', 'zz-fb-owner-b@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000fb01', 'zz-fb-a', 'ZZ FB A', true, 'PUBLISHED', '+60111111111');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000fb01', '00000000-0000-4000-8000-00000000fba1', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000fb01';
  oa text := '00000000-0000-4000-8000-00000000fba1';
  ob text := '00000000-0000-4000-8000-00000000fba2';
  r jsonb;
  req uuid := gen_random_uuid();
  fid uuid;
  sub text := $s$select public.merchant_feedback_submit('owner', %L, %L::uuid, gen_random_uuid(), %L, %L)$s$;
begin
  perform fb_test.err(format(sub, ob, a, 'suggestion', 'hi'), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  perform fb_test.err(format(sub, oa, a, 'other', 'hi'), 'VALIDATION_FAILED', 'unknown topic');
  perform fb_test.err(format(sub, oa, a, 'suggestion', '   '), 'VALIDATION_FAILED', 'empty message');
  perform fb_test.err(format(sub, oa, a, 'suggestion', repeat('x', 2001)), 'VALIDATION_FAILED', 'too long');
  perform fb_test.err(format($s$select public.merchant_feedback_submit('admin', 'legacy_admin', %L::uuid, gen_random_uuid(), 'suggestion', 'x')$s$, a), 'OPERATION_FORBIDDEN', 'Admin does not submit');

  r := public.merchant_feedback_submit('owner', oa, a, req, 'problem', '  The menu does not load  ');
  fid := (r #>> '{feedback,id}')::uuid;
  perform fb_test.ok(r ->> 'status' = 'applied' and r #>> '{feedback,message}' = 'The menu does not load', 'stored, trimmed');
  perform fb_test.ok((public.merchant_feedback_submit('owner', oa, a, req, 'problem', '  The menu does not load  ') ->> 'replayed')::boolean
                     and (select count(*) from public.merchant_feedback where merchant_id = a) = 1, 'replay does not duplicate');

  -- Suspended Owners can still reach the team.
  perform public.merchant_governance_apply('admin', 'legacy_admin', a, gen_random_uuid(), 'suspend', 'zz test');
  perform public.merchant_feedback_submit('owner', oa, a, gen_random_uuid(), 'listing', 'Why was I suspended?');
  perform fb_test.ok((select count(*) from public.merchant_feedback where merchant_id = a) = 2, 'suspended Owner can send feedback');

  -- Admin queue, reply, status; Owner sees the reply.
  r := public.merchant_feedback_queue('admin', 'legacy_admin', 'new');
  perform fb_test.ok((r #>> '{counts,new}')::int >= 2 and r #>> '{items,0,merchantName}' = 'ZZ FB A', 'queue');
  perform fb_test.err($s$select public.merchant_feedback_queue('owner', 'x', null)$s$, 'OPERATION_FORBIDDEN', 'Owner cannot read the queue');
  r := public.merchant_feedback_update('admin', 'legacy_admin', fid, 'resolved', ' Fixed, thank you. ');
  perform fb_test.ok(r #>> '{feedback,status}' = 'resolved' and r #>> '{feedback,reply}' = 'Fixed, thank you.', 'resolved with reply');
  perform fb_test.ok((select jsonb_path_query_first(public.merchant_feedback_list('owner', oa, a), '$[*] ? (@.status == "resolved").reply')) = '"Fixed, thank you."'::jsonb, 'Owner sees the reply');
  perform fb_test.err(format($s$select public.merchant_feedback_list('owner', %L, %L::uuid)$s$, ob, a), 'RESOURCE_NOT_FOUND', 'foreign Owner cannot list');
  perform fb_test.err($s$select public.merchant_feedback_update('admin', 'legacy_admin', gen_random_uuid(), 'read', null)$s$, 'RESOURCE_NOT_FOUND', 'unknown feedback');

  -- Rate limit: 10 per restaurant per hour.
  for i in 3..10 loop
    perform public.merchant_feedback_submit('owner', oa, a, gen_random_uuid(), 'suggestion', 'note ' || i);
  end loop;
  perform fb_test.err(format(sub, oa, a, 'suggestion', 'one more'), 'RATE_LIMITED', 'rate limited');
end $$;

reset role;
do $$
begin
  if has_table_privilege('authenticated', 'public.merchant_feedback', 'select') or has_function_privilege('anon', 'public.merchant_feedback_submit(text,text,uuid,uuid,text,text)', 'execute') then
    raise exception 'FEEDBACK TEST FAILED: browser roles have access';
  end if;
end $$;

select 'ALL FEEDBACK BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
