-- =====================================================================
-- Three editable drafts per account: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927170000_merchant_draft_limit. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-dl-*).
-- =====================================================================
begin;

create schema dl_test;
grant usage on schema dl_test to public;
create function dl_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'DRAFT LIMIT TEST FAILED: %', label; end if; end $f$;
grant execute on all functions in schema dl_test to public;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000d1a01', 'zz-dl-owner@example.test', now());

set local role service_role;

do $$
declare
  u uuid := '00000000-0000-4000-8000-0000000d1a01';
  first_req uuid := gen_random_uuid();
  r jsonb;
  first_id uuid;
begin
  r := public.merchant_restaurant_create(u, 'ZZ DL One', first_req);
  first_id := (r ->> 'id')::uuid;
  perform public.merchant_restaurant_create(u, 'ZZ DL Two', gen_random_uuid());
  perform public.merchant_restaurant_create(u, 'ZZ DL Three', gen_random_uuid());
  r := public.merchant_restaurant_create(u, 'ZZ DL Four', gen_random_uuid());
  perform dl_test.ok(r ->> 'code' = 'DRAFT_LIMIT', 'fourth editable draft refused');
  perform dl_test.ok((select count(*) from public.merchant_memberships where user_id = u) = 3, 'nothing created for the fourth');
  r := public.merchant_restaurant_create(u, 'ZZ DL One', first_req);
  perform dl_test.ok((r ->> 'id')::uuid = first_id, 'a retry of an earlier request still returns its draft');

  -- A draft that moves on (here: waiting for review) frees a place; rejected counts again.
  reset role;
  update public.merchants set review_status = 'pending' where id = first_id;
  set local role service_role;
  r := public.merchant_restaurant_create(u, 'ZZ DL Four', gen_random_uuid());
  perform dl_test.ok(r ? 'id', 'a place frees up when a draft is submitted');
  reset role;
  update public.merchants set review_status = 'rejected' where id = first_id;
  set local role service_role;
  r := public.merchant_restaurant_create(u, 'ZZ DL Five', gen_random_uuid());
  perform dl_test.ok(r ->> 'code' = 'DRAFT_LIMIT', 'rejected restaurants count as editable');

  -- Discard: archived (not deleted), frees a place, replayable; only never-public drafts.
  r := public.merchant_draft_discard('owner', u::text, first_id, '00000000-0000-4000-8000-0000000d1d01');
  perform dl_test.ok(r ->> 'status' = 'applied' and (select platform_restriction from public.merchants where id = first_id) = 'archived', 'discarded = archived');
  perform dl_test.ok((public.merchant_draft_discard('owner', u::text, first_id, '00000000-0000-4000-8000-0000000d1d01') ->> 'replayed')::boolean, 'discard replay');
  perform dl_test.ok(exists (select 1 from public.merchants where id = first_id), 'not deleted');
  -- Two, Three and Four are still editable drafts: still full. Discard Four, then a place is free.
  perform dl_test.ok(public.merchant_restaurant_create(u, 'ZZ DL Five', gen_random_uuid()) ->> 'code' = 'DRAFT_LIMIT', 'still three editable drafts');
  perform public.merchant_draft_discard('owner', u::text, (select id from public.merchants where name = 'ZZ DL Four'), gen_random_uuid());
  r := public.merchant_restaurant_create(u, 'ZZ DL Five', gen_random_uuid());
  perform dl_test.ok(r ? 'id', 'a discarded draft frees a place');
  begin
    perform public.merchant_draft_discard('owner', '00000000-0000-4000-8000-0000000d1a99', (r ->> 'id')::uuid, gen_random_uuid());
    raise exception 'DRAFT LIMIT TEST FAILED: foreign Owner discarded';
  exception when others then
    if sqlerrm not like 'RESOURCE_NOT_FOUND%' then raise; end if;
  end;
  reset role;
  update public.merchants set review_status = 'approved' where id = (r ->> 'id')::uuid;
  set local role service_role;
  begin
    perform public.merchant_draft_discard('owner', u::text, (r ->> 'id')::uuid, gen_random_uuid());
    raise exception 'DRAFT LIMIT TEST FAILED: approved restaurant discarded';
  exception when others then
    if sqlerrm not like 'LISTING_ACTION_NOT_ALLOWED%' then raise; end if;
  end;
end $$;

reset role;
select 'ALL DRAFT LIMIT BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
