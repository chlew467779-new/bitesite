-- Local/staging only. Synthetic zz-bn rows are rolled back.
-- Requires 20260928150000_basics_review_notifications.sql.
begin;

create schema bn_test;
grant usage on schema bn_test to public;
create function bn_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'BASICS NOTIFICATION TEST FAILED: %', label; end if; end $f$;
grant execute on all functions in schema bn_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000bba5', 'zz-bn-owner@example.test');
insert into public.merchants (id, slug, name, state_source, review_status, listing_visibility, platform_restriction)
  values ('00000000-0000-4000-8000-00000000bb05', 'zz-bn-restaurant', 'ZZ BN Original', 'managed', 'approved', 'hidden', 'none');
insert into public.merchant_memberships (merchant_id, user_id, role, status)
  values ('00000000-0000-4000-8000-00000000bb05', '00000000-0000-4000-8000-00000000bba5', 'owner', 'active');

set local role service_role;
do $$
declare
  mid uuid := '00000000-0000-4000-8000-00000000bb05';
  owner_id text := '00000000-0000-4000-8000-00000000bba5';
  r jsonb;
  req_id uuid;
begin
  r := public.merchant_basics_request_submit('owner', owner_id, mid, gen_random_uuid(), '{"profile.name":"ZZ BN Approved"}');
  req_id := (r ->> 'basicsRequestId')::uuid;
  perform bn_test.ok(req_id is not null, 'approval request created');
  perform public.merchant_basics_review('admin', 'legacy_admin', gen_random_uuid(), req_id, 'approve', 'Looks good');
  perform bn_test.ok((select count(*) from public.merchant_notifications where merchant_id = mid and audience = 'owner' and kind = 'basics_approved' and message = 'Looks good') = 1, 'approval emits one Owner notification');

  r := public.merchant_basics_request_submit('owner', owner_id, mid, gen_random_uuid(), '{"profile.name":"ZZ BN Rejected"}');
  req_id := (r ->> 'basicsRequestId')::uuid;
  perform public.merchant_basics_review('admin', 'legacy_admin', gen_random_uuid(), req_id, 'reject', 'Use the registered name');
  perform bn_test.ok((select count(*) from public.merchant_notifications where merchant_id = mid and audience = 'owner' and kind = 'basics_rejected' and message = 'Use the registered name') = 1, 'rejection emits one Owner notification');
  perform bn_test.ok((select count(*) from public.merchant_notifications where merchant_id = mid) = 2, 'only two decision notifications');
end $$;

reset role;
select 'ALL BASICS REVIEW NOTIFICATION TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
