-- =====================================================================
-- Notification delivery: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927190000_notification_delivery. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema nd_test;
grant usage on schema nd_test to public;
create function nd_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'NOTIFY TEST FAILED: %', label; end if; end $f$;
grant execute on all functions in schema nd_test to public;

-- Earlier synthetic outbox rows would interfere; park them for this transaction only.
update public.merchant_notifications set delivered_at = now() where delivered_at is null;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a0a1', 'zz-nd-owner@example.test');
insert into public.merchants (id, slug, name) values ('00000000-0000-4000-8000-00000000a001', 'zz-nd-a', 'ZZ ND A');
insert into public.merchant_memberships (merchant_id, user_id, role, status)
  values ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a0a1', 'owner', 'active');
insert into public.merchant_notifications (id, merchant_id, audience, kind, message) values
  ('00000000-0000-4000-8000-00000000a0b1', '00000000-0000-4000-8000-00000000a001', 'owner', 'review_rejected', 'Add a photo'),
  ('00000000-0000-4000-8000-00000000a0b2', '00000000-0000-4000-8000-00000000a001', 'admin', 'review_submitted', null);

set local role service_role;

do $$
declare
  r jsonb;
begin
  r := public.merchant_notification_claim(1);
  perform nd_test.ok(jsonb_array_length(r) = 1 and r #>> '{0,id}' = '00000000-0000-4000-8000-00000000a0b1', 'oldest first, limit respected');
  perform nd_test.ok(r #>> '{0,ownerUserId}' = '00000000-0000-4000-8000-00000000a0a1' and r #>> '{0,merchantName}' = 'ZZ ND A', 'recipient data');
  r := public.merchant_notification_claim(10);
  perform nd_test.ok(jsonb_array_length(r) = 1 and r #>> '{0,id}' = '00000000-0000-4000-8000-00000000a0b2', 'claimed rows are not handed out again while leased');

  perform public.merchant_notification_finish('00000000-0000-4000-8000-00000000a0b1', true, null);
  perform public.merchant_notification_finish('00000000-0000-4000-8000-00000000a0b2', false, 'provider timeout');
  perform nd_test.ok((select delivered_at is not null from public.merchant_notifications where id = '00000000-0000-4000-8000-00000000a0b1'), 'delivered');
  perform nd_test.ok((select last_error from public.merchant_notifications where id = '00000000-0000-4000-8000-00000000a0b2') = 'provider timeout', 'failure recorded');
  r := public.merchant_notification_claim(10);
  perform nd_test.ok(jsonb_array_length(r) = 1 and (r #>> '{0,attempts}')::int = 2, 'failed row retried; delivered row never again');

  -- After 5 attempts a row is left alone.
  perform public.merchant_notification_finish('00000000-0000-4000-8000-00000000a0b2', false, 'x');
  update public.merchant_notifications set attempts = 5 where id = '00000000-0000-4000-8000-00000000a0b2';
  perform nd_test.ok(jsonb_array_length(public.merchant_notification_claim(10)) = 0, 'gives up after 5 attempts');
end $$;

reset role;
do $$
begin
  if has_function_privilege('authenticated', 'public.merchant_notification_claim(integer)', 'execute') then
    raise exception 'NOTIFY TEST FAILED: browser roles can claim';
  end if;
end $$;

select 'ALL NOTIFICATION DELIVERY BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
