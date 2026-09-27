-- Run after the new migration, on a local database only. All fixtures roll back.
begin;
create schema password_test;
create function password_test.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'AUTH TEST FAILED: %', label; end if; end $$;
grant usage on schema password_test to service_role;
grant execute on all functions in schema password_test to service_role;
insert into auth.users(id, email, email_confirmed_at) values
 ('00000000-0000-4000-8000-0000000a0011', 'zz-password-a@example.test', now()),
 ('00000000-0000-4000-8000-0000000a0012', 'zz-password-b@example.test', now()),
 ('00000000-0000-4000-8000-0000000a0013', 'zz-password-unconfirmed@example.test', null);
set local role service_role;
do $$
declare gate jsonb; result jsonb; mid uuid; retry jsonb; source text := repeat('a', 64); other_source text := repeat('b', 64);
begin
  for i in 1..5 loop
    gate := public.merchant_password_attempt_begin(source);
    perform password_test.check_true((gate->>'allowed')::boolean, 'first five attempts allowed');
    perform password_test.check_true(not (public.merchant_password_attempt_begin(source)->>'allowed')::boolean, 'overlapping attempt rejected');
    perform password_test.check_true(not (public.merchant_password_attempt_finish(source, gen_random_uuid(), 'success')->>'accepted')::boolean, 'foreign lease cannot reset failures');
    result := public.merchant_password_attempt_finish(source, (gate->>'ticket')::uuid, 'failure');
    perform password_test.check_true((result->>'retry_after')::int = case when i=5 then 900 else 0 end, 'fifth failure starts fifteen-minute cooldown');
    perform password_test.check_true(not (public.merchant_password_attempt_finish(source, (gate->>'ticket')::uuid, 'success')->>'accepted')::boolean, 'spent lease cannot reset failures');
  end loop;
  perform password_test.check_true(not (public.merchant_password_attempt_begin(source)->>'allowed')::boolean, 'sixth attempt blocked');
  gate := public.merchant_password_attempt_begin(other_source);
  perform password_test.check_true((gate->>'allowed')::boolean, 'other source unaffected');
  perform public.merchant_password_attempt_finish(other_source, (gate->>'ticket')::uuid, 'success');
  update private.merchant_password_sources set blocked_until=now()-interval '1 second' where source_key=source;
  gate := public.merchant_password_attempt_begin(source);
  perform password_test.check_true((gate->>'allowed')::boolean, 'cooldown expires');
  perform public.merchant_password_attempt_finish(source, (gate->>'ticket')::uuid, 'failure');
  gate := public.merchant_password_attempt_begin(source);
  perform public.merchant_password_attempt_finish(source, (gate->>'ticket')::uuid, 'success');
  perform password_test.check_true((select failures=0 from private.merchant_password_sources where source_key=source), 'success resets failures');
  gate := public.merchant_password_attempt_begin(source);
  perform public.merchant_password_attempt_finish(source, (gate->>'ticket')::uuid, 'other');
  perform password_test.check_true((select failures=0 from private.merchant_password_sources where source_key=source), 'service error does not count as bad password');
  result := public.merchant_restaurant_create('00000000-0000-4000-8000-0000000a0013', 'Unconfirmed', gen_random_uuid());
  perform password_test.check_true(result->>'code'='AUTH_REQUIRED', 'unconfirmed cannot create');
  result := public.merchant_restaurant_create('00000000-0000-4000-8000-0000000a0011', 'ZZ Password Draft', '00000000-0000-4000-8000-0000000a0021');
  mid := (result->>'id')::uuid;
  perform password_test.check_true((select state_source='managed' and review_status='draft' and listing_visibility='hidden' and not is_published from public.merchants where id=mid), 'new draft private');
  perform password_test.check_true((select count(*)=1 from public.merchant_memberships where merchant_id=mid and user_id='00000000-0000-4000-8000-0000000a0011' and role='owner' and status='active'), 'owner set in same transaction');
  perform password_test.check_true((select count(*)=1 from public.merchant_membership_audit where merchant_id=mid and actor='owner'), 'membership creation audited');
  perform password_test.check_true((select count(*)=1 from public.merchant_change_log where merchant_id=mid and actor_type='owner' and actor_id='00000000-0000-4000-8000-0000000a0011'), 'restaurant creation attributed to verified owner');
  perform password_test.check_true((select email is null from public.merchants where id=mid), 'login email not copied into public contact');
  retry := public.merchant_restaurant_create('00000000-0000-4000-8000-0000000a0011', 'ZZ Password Draft', '00000000-0000-4000-8000-0000000a0021');
  perform password_test.check_true(retry=result, 'retry returns same draft');
  retry := public.merchant_restaurant_create('00000000-0000-4000-8000-0000000a0011', 'Changed name', '00000000-0000-4000-8000-0000000a0021');
  perform password_test.check_true(retry->>'code'='REQUEST_CONFLICT', 'changed replay rejected');
  retry := public.merchant_restaurant_create('00000000-0000-4000-8000-0000000a0012', 'ZZ Other Draft', '00000000-0000-4000-8000-0000000a0021');
  perform password_test.check_true(retry->>'id'<>result->>'id', 'request ID scoped to account');
  update public.merchant_memberships set status='suspended' where merchant_id=mid;
  retry := public.merchant_restaurant_create('00000000-0000-4000-8000-0000000a0011', 'ZZ Password Draft', '00000000-0000-4000-8000-0000000a0021');
  perform password_test.check_true(retry->>'code'='REQUEST_CONFLICT', 'replay does not restore suspended ownership');
end $$;
reset role;
-- Force membership failure to prove there is no orphan restaurant or request record.
create function password_test.fail_membership() returns trigger language plpgsql as $$
begin
  if new.user_id = '00000000-0000-4000-8000-0000000a0011' then raise exception 'SYNTHETIC_MEMBERSHIP_FAILURE'; end if;
  return new;
end $$;
create trigger password_test_fail before insert on public.merchant_memberships for each row execute function password_test.fail_membership();
set local role service_role;
do $$
begin
  begin
    perform public.merchant_restaurant_create('00000000-0000-4000-8000-0000000a0011', 'ZZ Forced Rollback', '00000000-0000-4000-8000-0000000a0099');
    raise exception 'Membership failure should reject the transaction';
  exception when others then
    if sqlerrm <> 'SYNTHETIC_MEMBERSHIP_FAILURE' then raise; end if;
  end;
  perform password_test.check_true(not exists(select 1 from public.merchants where name='ZZ Forced Rollback'), 'failed membership leaves no orphan draft');
  perform password_test.check_true(not exists(select 1 from private.merchant_onboarding_requests where request_id='00000000-0000-4000-8000-0000000a0099'), 'failed membership leaves no retry record');
end $$;
reset role;
drop trigger password_test_fail on public.merchant_memberships;
do $$
begin
  if has_function_privilege('anon', 'public.merchant_restaurant_create(uuid,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.merchant_restaurant_create(uuid,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.merchant_password_attempt_begin(text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.merchant_password_attempt_finish(text,uuid,text)', 'EXECUTE') then
    raise exception 'Browser roles must not call auth/onboarding RPCs';
  end if;
end $$;
select 'PASSWORD + ONBOARDING SQL PASS';
rollback;
