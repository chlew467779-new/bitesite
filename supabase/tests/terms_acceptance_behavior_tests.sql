-- Local/staging only. Synthetic zz-terms rows are rolled back.
-- Requires 20260927220000_merchant_terms_acceptance.sql.
begin;

create schema terms_test;
grant usage on schema terms_test to public;
create function terms_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'TERMS TEST FAILED: %', label; end if; end $f$;
grant execute on all functions in schema terms_test to public;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000e1a01', 'zz-terms-owner@example.test', now());

set local role service_role;
do $$
declare
  u uuid := '00000000-0000-4000-8000-0000000e1a01';
  first_req uuid := gen_random_uuid();
  r jsonb;
  first_id uuid;
begin
  r := public.merchant_restaurant_create_v2(u, 'ZZ Terms One', first_req, 'old-version');
  perform terms_test.ok(r ->> 'code' = 'TERMS_OUTDATED', 'outdated version refused');
  perform terms_test.ok((select count(*) from public.merchant_memberships where user_id = u) = 0, 'outdated version created no membership');
  perform terms_test.ok((select count(*) from private.merchant_terms_acceptances where user_id = u) = 0, 'outdated version created no acceptance');

  r := public.merchant_restaurant_create_v2(u, 'ZZ Terms One', first_req, '2026-09-pilot');
  first_id := (r ->> 'id')::uuid;
  perform terms_test.ok(first_id is not null, 'correct version created a draft');
  perform terms_test.ok((select count(*) from private.merchant_terms_acceptances where user_id = u and merchant_id = first_id and terms_version = '2026-09-pilot' and rights_declared) = 1, 'one acceptance recorded');

  r := public.merchant_restaurant_create_v2(u, 'ZZ Terms One', first_req, '2026-09-pilot');
  perform terms_test.ok((r ->> 'id')::uuid = first_id, 'same request returns same restaurant');
  perform terms_test.ok((select count(*) from private.merchant_terms_acceptances where user_id = u) = 1, 'retry did not duplicate acceptance');

  perform public.merchant_restaurant_create_v2(u, 'ZZ Terms Two', gen_random_uuid(), '2026-09-pilot');
  perform public.merchant_restaurant_create_v2(u, 'ZZ Terms Three', gen_random_uuid(), '2026-09-pilot');
  r := public.merchant_restaurant_create_v2(u, 'ZZ Terms Four', gen_random_uuid(), '2026-09-pilot');
  perform terms_test.ok(r ->> 'code' = 'DRAFT_LIMIT', 'fourth draft refused');
  perform terms_test.ok((select count(*) from private.merchant_terms_acceptances where user_id = u) = 3, 'fourth draft created no acceptance');
end $$;

reset role;
select 'ALL TERMS ACCEPTANCE BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
