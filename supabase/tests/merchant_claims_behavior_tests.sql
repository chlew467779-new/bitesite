-- =====================================================================
-- Merchant claims: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260928110000_merchant_claims. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema mc_test;
grant usage on schema mc_test to public;
create function mc_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'CLAIM TEST FAILED: %', label; end if; end $f$;
create function mc_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'CLAIM TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'CLAIM TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema mc_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000c1a01', 'zz-mc-one@kopiahseng.my'),
  ('00000000-0000-4000-8000-0000000c1a02', 'zz-mc-two@gmail.com'),
  ('00000000-0000-4000-8000-0000000c1a03', 'zz-mc-owner@example.test');
-- P: public, no Owner. O: public with an Owner. H: hidden, no Owner.
insert into public.merchants (id, slug, name, is_published, platform_status, phone, website) values
  ('00000000-0000-4000-8000-0000000c1b01', 'zz-mc-public', 'ZZ MC Public', true, 'PUBLISHED', '+60111111111', 'https://www.kopiahseng.my/menu'),
  ('00000000-0000-4000-8000-0000000c1b02', 'zz-mc-owned', 'ZZ MC Owned', true, 'PUBLISHED', '+60111111112', null),
  ('00000000-0000-4000-8000-0000000c1b03', 'zz-mc-hidden', 'ZZ MC Hidden', false, 'DRAFT', '+60111111113', null);
insert into public.merchant_memberships (merchant_id, user_id, role, status)
  values ('00000000-0000-4000-8000-0000000c1b02', '00000000-0000-4000-8000-0000000c1a03', 'owner', 'active');

set local role service_role;

do $$
declare
  p uuid := '00000000-0000-4000-8000-0000000c1b01';
  o uuid := '00000000-0000-4000-8000-0000000c1b02';
  h uuid := '00000000-0000-4000-8000-0000000c1b03';
  u1 uuid := '00000000-0000-4000-8000-0000000c1a01';
  u2 uuid := '00000000-0000-4000-8000-0000000c1a02';
  u3 uuid := '00000000-0000-4000-8000-0000000c1a03';
  req uuid := gen_random_uuid();
  r jsonb;
  c1 uuid;
  c2 uuid;
  submit text := $s$select public.merchant_claim_submit(%L::uuid, 'x@example.test', gen_random_uuid(), %L::uuid, %L, 'Ah Seng', '+60 12-345 6789', 'SSM 202301234567, call the shop phone after 3pm')$s$;
begin
  -- Target lookup: public restaurants only; old slugs resolve.
  perform mc_test.ok(public.merchant_claim_target(u1, 'zz-mc-public') ->> 'status' = 'available', 'target available');
  perform mc_test.ok(public.merchant_claim_target(u1, 'zz-mc-owned') ->> 'status' = 'managed', 'target managed');
  perform mc_test.ok(public.merchant_claim_target(u3, 'zz-mc-owned') ->> 'status' = 'already_owner', 'target own restaurant');
  perform mc_test.err($s$select public.merchant_claim_target('00000000-0000-4000-8000-0000000c1a01', 'zz-mc-hidden')$s$, 'RESOURCE_NOT_FOUND', 'hidden restaurant looks missing');

  -- Refusals.
  perform mc_test.err(format(submit, u1, o, 'owner'), 'CLAIM_NOT_AVAILABLE', 'restaurant with an Owner');
  perform mc_test.err(format(submit, u1, h, 'owner'), 'RESOURCE_NOT_FOUND', 'hidden restaurant');
  perform mc_test.err(format(submit, u1, p, 'boss'), 'VALIDATION_FAILED', 'relationship');
  perform mc_test.err(format($s$select public.merchant_claim_submit(%L::uuid, null, gen_random_uuid(), %L::uuid, 'owner', 'A', 'abc', 'long enough evidence')$s$, u1, p), 'VALIDATION_FAILED', 'phone format');
  perform mc_test.err(format($s$select public.merchant_claim_submit(%L::uuid, null, gen_random_uuid(), %L::uuid, 'owner', 'A', '+6012345678', 'short')$s$, u1, p), 'VALIDATION_FAILED', 'evidence length');

  -- Submit with a matching business email domain; replay; one pending per account.
  r := public.merchant_claim_submit(u1, 'zz-mc-one@kopiahseng.my', req, p, 'owner', ' Ah Seng ', '+60 12-345 6789', 'SSM 202301234567, call the shop phone after 3pm');
  c1 := (r ->> 'claimId')::uuid;
  perform mc_test.ok((select email_domain_match and contact_name = 'Ah Seng' from public.merchant_claims where id = c1), 'stored, trimmed, domain matches');
  perform mc_test.ok((public.merchant_claim_submit(u1, 'zz-mc-one@kopiahseng.my', req, p, 'owner', ' Ah Seng ', '+60 12-345 6789', 'SSM 202301234567, call the shop phone after 3pm') ->> 'replayed')::boolean, 'replay');
  perform mc_test.err(format(submit, u1, p, 'manager'), 'CLAIM_ONE_PENDING', 'one pending claim per account');
  perform mc_test.ok(exists (select 1 from public.merchant_notifications where merchant_id = p and kind = 'claim_submitted' and audience = 'admin'), 'Admin notified');
  perform mc_test.ok(public.merchant_claim_target(u1, 'zz-mc-public') -> 'myPending' ->> 'id' = c1::text, 'target shows my pending claim');

  -- A second claimant (free mail never matches).
  r := public.merchant_claim_submit(u2, 'zz-mc-two@gmail.com', gen_random_uuid(), p, 'manager', 'Mei', '0123456789', 'I manage the shop on weekends');
  c2 := (r ->> 'claimId')::uuid;
  perform mc_test.ok(not (select email_domain_match from public.merchant_claims where id = c2), 'free mail never matches');
  perform mc_test.ok(jsonb_array_length(public.merchant_claim_queue('admin', 'legacy_admin')) = 2, 'queue has both');
  perform mc_test.ok((select (e ->> 'otherPending')::int from jsonb_array_elements(public.merchant_claim_queue('admin', 'legacy_admin')) e where e ->> 'id' = c1::text) = 1, 'queue counts competing claims');

  -- Decisions.
  perform mc_test.err(format($s$select public.merchant_claim_decide('owner', %L, gen_random_uuid(), %L::uuid, 'approve', null)$s$, u1, c1), 'OPERATION_FORBIDDEN', 'only Admin decides');
  perform mc_test.err(format($s$select public.merchant_claim_decide('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'reject', '')$s$, c1), 'VALIDATION_FAILED', 'reject needs a note');
  r := public.merchant_claim_decide('admin', 'legacy_admin', gen_random_uuid(), c1, 'approve', 'Called the shop, confirmed.');
  perform mc_test.ok(exists (select 1 from public.merchant_memberships where merchant_id = p and user_id = u1 and role = 'owner' and status = 'active'), 'membership created');
  perform mc_test.ok(exists (select 1 from public.merchant_membership_audit where merchant_id = p and user_id = u1 and action = 'linked'), 'membership audited');
  perform mc_test.ok((select status from public.merchant_claims where id = c2) = 'superseded', 'competing claim superseded');
  perform mc_test.ok((select count(*) from public.merchant_notifications where merchant_id = p and kind = 'claim_approved' and recipient_user_id = u1) = 1, 'claimant notified');
  perform mc_test.ok((select count(*) from public.merchant_notifications where merchant_id = p and kind = 'claim_rejected' and recipient_user_id = u2) = 1, 'other claimant notified');
  perform mc_test.ok(public.merchant_claim_target(u1, 'zz-mc-public') ->> 'status' = 'already_owner', 'now the Owner');
  perform mc_test.ok(public.merchant_claims_mine(u2) -> 0 ->> 'status' = 'superseded', 'other claimant sees the outcome');
  perform mc_test.err(format($s$select public.merchant_claim_decide('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'approve', null)$s$, c1), 'VALIDATION_FAILED', 'already decided');

  -- Owner exists at approval time (claim made before an Admin linked someone): refused.
  delete from public.merchant_memberships where merchant_id = p;
  r := public.merchant_claim_submit(u2, 'zz-mc-two@gmail.com', gen_random_uuid(), p, 'manager', 'Mei', '0123456789', 'I manage the shop on weekends');
  c2 := (r ->> 'claimId')::uuid;
  insert into public.merchant_memberships (merchant_id, user_id, role, status) values (p, u3, 'owner', 'active');
  perform mc_test.err(format($s$select public.merchant_claim_decide('admin', 'legacy_admin', gen_random_uuid(), %L::uuid, 'approve', null)$s$, c2), 'CLAIM_OWNER_EXISTS', 'owner appeared meanwhile');
  r := public.merchant_claim_decide('admin', 'legacy_admin', gen_random_uuid(), c2, 'reject', 'This restaurant is already managed.');
  perform mc_test.ok((select status from public.merchant_claims where id = c2) = 'rejected', 'rejected');

  -- Withdraw.
  delete from public.merchant_memberships where merchant_id = p;
  r := public.merchant_claim_submit(u2, 'zz-mc-two@gmail.com', gen_random_uuid(), p, 'manager', 'Mei', '0123456789', 'I manage the shop on weekends');
  perform mc_test.err(format($s$select public.merchant_claim_withdraw(%L::uuid, gen_random_uuid(), %L::uuid)$s$, u1, r ->> 'claimId'), 'RESOURCE_NOT_FOUND', 'cannot withdraw someone else''s claim');
  perform public.merchant_claim_withdraw(u2, gen_random_uuid(), (r ->> 'claimId')::uuid);
  perform mc_test.ok((select status from public.merchant_claims where id = (r ->> 'claimId')::uuid) = 'withdrawn', 'withdrawn');

  -- Delivery picks the explicit recipient for claim rows.
  update public.merchant_notifications set delivered_at = now() where kind not like 'claim_%';
  perform mc_test.ok(exists (select 1 from jsonb_array_elements(public.merchant_notification_claim(50)) e
                              where e ->> 'kind' = 'claim_rejected' and e ->> 'ownerUserId' = u2::text), 'delivery goes to the claimant');
end $$;

-- Domain matching rules.
reset role;
do $$ begin
  perform mc_test.ok(private.merchant_claim_domain_match('a@shop.my', 'https://shop.my'), 'same domain');
  perform mc_test.ok(private.merchant_claim_domain_match('a@shop.my', 'https://order.shop.my/x'), 'subdomain site');
  perform mc_test.ok(not private.merchant_claim_domain_match('a@evilshop.my', 'https://shop.my'), 'suffix is not a match');
  perform mc_test.ok(not private.merchant_claim_domain_match('a@gmail.com', 'https://gmail.com'), 'free mail never');
  perform mc_test.ok(not private.merchant_claim_domain_match('a@shop.my', null), 'no website');
end $$;

set local role anon;
do $$ begin
  perform mc_test.err('select count(*) from public.merchant_claims', 'permission denied', 'anon table');
  perform mc_test.err($s$select public.merchant_claims_mine('00000000-0000-4000-8000-0000000c1a01')$s$, 'permission denied', 'anon RPC');
end $$;
reset role;
set local role authenticated;
do $$ begin
  perform mc_test.err($s$select public.merchant_claim_queue('admin', 'legacy_admin')$s$, 'permission denied', 'authenticated queue');
end $$;
reset role;

select 'ALL MERCHANT CLAIM BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
