-- =====================================================================
-- M6b profile images: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927100000_merchant_profile_media. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-m6b-*). Storage objects are not involved (the server checks bytes).
-- =====================================================================
begin;

create schema m6b_test;
grant usage on schema m6b_test to public;
create function m6b_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'M6B TEST FAILED: %', label; end if; end $f$;
create function m6b_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'M6B TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'M6B TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema m6b_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000b6a01', 'zz-m6b-owner-a@example.test'),
  ('00000000-0000-4000-8000-0000000b6a02', 'zz-m6b-owner-b@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone, logo_image) values
  ('00000000-0000-4000-8000-0000000b6001', 'zz-m6b-a', 'ZZ M6B A', true, 'PUBLISHED', '+60111111111', 'https://old.example/logo.png'),
  ('00000000-0000-4000-8000-0000000b6002', 'zz-m6b-s', 'ZZ M6B S', false, 'SUSPENDED', '+60122222222', null);
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000b6001', '00000000-0000-4000-8000-0000000b6a01', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000b6002', '00000000-0000-4000-8000-0000000b6a02', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000b6001';
  s uuid := '00000000-0000-4000-8000-0000000b6002';
  oa text := '00000000-0000-4000-8000-0000000b6a01';
  ob text := '00000000-0000-4000-8000-0000000b6a02';
  base text := 'http://127.0.0.1:55321/storage/v1/object/public/merchant-media/';
  p1 text := 'profile/00000000-0000-4000-8000-0000000b6001/logo/11111111-1111-4111-8111-111111111111.webp';
  p2 text := 'profile/00000000-0000-4000-8000-0000000b6001/cover/22222222-2222-4222-8222-222222222222.jpg';
  t jsonb;
  t2 jsonb;
  r jsonb;
  req uuid := gen_random_uuid();
  rev0 bigint;
begin
  -- ticket: owner of A; path must be under the restaurant and slot
  t := public.merchant_media_ticket('owner', oa, a, 'logo', p1, 'image/webp');
  perform m6b_test.ok(t ->> 'path' = p1 and (t ->> 'uploadId') is not null, 'ticket issued');
  perform m6b_test.err(format($s$select public.merchant_media_ticket('owner', %L, %L::uuid, 'logo', %L, 'image/webp')$s$, oa, a,
    'profile/00000000-0000-4000-8000-0000000b6002/logo/33333333-3333-4333-8333-333333333333.webp'), 'VALIDATION_FAILED', 'path of another restaurant');
  perform m6b_test.err(format($s$select public.merchant_media_ticket('owner', %L, %L::uuid, 'cover', %L, 'image/webp')$s$, oa, a, p1), 'VALIDATION_FAILED', 'slot/path mismatch');
  perform m6b_test.err(format($s$select public.merchant_media_ticket('owner', %L, %L::uuid, 'logo', %L, 'image/gif')$s$, oa, a, p1), 'VALIDATION_FAILED', 'type');
  perform m6b_test.err(format($s$select public.merchant_media_ticket('owner', %L, %L::uuid, 'logo', %L, 'image/webp')$s$, ob, a,
    'profile/00000000-0000-4000-8000-0000000b6001/logo/44444444-4444-4444-8444-444444444444.webp'), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  perform m6b_test.err(format($s$select public.merchant_media_ticket('owner', %L, %L::uuid, 'logo', %L, 'image/webp')$s$, ob, s,
    'profile/00000000-0000-4000-8000-0000000b6002/logo/55555555-5555-4555-8555-555555555555.webp'), 'MERCHANT_SUSPENDED', 'suspended Owner');

  -- bind: stale expected value is a conflict; matching value applies, audits, replays
  r := public.merchant_media_bind('owner', oa, a, gen_random_uuid(), 'logo', (t ->> 'uploadId')::uuid, base || p1, null);
  perform m6b_test.ok(r ->> 'status' = 'conflict' and r ->> 'current' = 'https://old.example/logo.png', 'stale expected -> conflict');
  perform m6b_test.err(format($s$select public.merchant_media_bind('owner', %L, %L::uuid, gen_random_uuid(), 'logo', %L::uuid, 'https://evil.example/x.webp', 'https://old.example/logo.png')$s$,
    oa, a, t ->> 'uploadId'), 'VALIDATION_FAILED', 'URL not matching the ticket');
  rev0 := (select revision from public.merchants where id = a);
  r := public.merchant_media_bind('owner', oa, a, req, 'logo', (t ->> 'uploadId')::uuid, base || p1, 'https://old.example/logo.png');
  perform m6b_test.ok(r ->> 'status' = 'applied' and (select logo_image from public.merchants where id = a) = base || p1
    and (select revision from public.merchants where id = a) = rev0 + 1
    and exists (select 1 from public.merchant_change_log l where l.merchant_id = a and l.operation = 'merchant_media_bind:logo' and 'logo_image' = any (l.changed_paths)), 'bind applied and audited');
  r := public.merchant_media_bind('owner', oa, a, req, 'logo', (t ->> 'uploadId')::uuid, base || p1, 'https://old.example/logo.png');
  perform m6b_test.ok((r ->> 'replayed')::boolean and (select revision from public.merchants where id = a) = rev0 + 1, 'replay');
  perform m6b_test.err(format($s$select public.merchant_media_bind('owner', %L, %L::uuid, gen_random_uuid(), 'logo', %L::uuid, %L, %L)$s$,
    oa, a, t ->> 'uploadId', base || p1, base || p1), 'VALIDATION_FAILED', 'a ticket binds once');

  -- a logo ticket cannot fill the cover slot; Admin can bind a cover; expired tickets refused
  t2 := public.merchant_media_ticket('admin', 'legacy_admin', a, 'cover', p2, 'image/jpeg');
  perform m6b_test.err(format($s$select public.merchant_media_bind('admin', 'legacy_admin', %L::uuid, gen_random_uuid(), 'logo', %L::uuid, %L, %L)$s$,
    a, t2 ->> 'uploadId', base || p2, base || p1), 'RESOURCE_NOT_FOUND', 'ticket for another slot');
  update public.merchant_media_uploads set expires_at = now() - interval '1 minute' where id = (t2 ->> 'uploadId')::uuid;
  perform m6b_test.err(format($s$select public.merchant_media_bind('admin', 'legacy_admin', %L::uuid, gen_random_uuid(), 'cover', %L::uuid, %L, null)$s$,
    a, t2 ->> 'uploadId', base || p2), 'VALIDATION_FAILED', 'expired ticket');

  -- remove (no ticket) and read
  r := public.merchant_media_bind('admin', 'legacy_admin', a, gen_random_uuid(), 'logo', null, null, base || p1);
  perform m6b_test.ok(r ->> 'status' = 'applied' and (select logo_image from public.merchants where id = a) is null, 'remove');
  r := public.merchant_media_read('owner', oa, a);
  perform m6b_test.ok(r ? 'logo' and r -> 'logo' = 'null'::jsonb, 'read');
  perform m6b_test.err(format($s$select public.merchant_media_read('owner', %L, %L::uuid)$s$, ob, a), 'RESOURCE_NOT_FOUND', 'foreign read');
end $$;

reset role;
set local role authenticated;
select m6b_test.err($q$select public.merchant_media_read('admin', 'legacy_admin', '00000000-0000-4000-8000-0000000b6001')$q$, 'permission denied', 'authenticated cannot call');
select m6b_test.err($q$select * from public.merchant_media_uploads$q$, 'permission denied', 'uploads table is private');
reset role;

select 'ALL M6B PROFILE MEDIA BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
