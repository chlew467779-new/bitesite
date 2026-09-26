-- =====================================================================
-- D1a merchant state foundation: BEHAVIOUR tests. Local or staging only.
-- Needs supabase/staging/10_synthetic_seed.sql and migration
-- 20260926093811_merchant_state_foundation.sql. Everything runs inside one
-- transaction that is ROLLED BACK at the end. All rows are synthetic (zz-d1a-*).
-- Any failure raises an exception that names the failing check.
-- =====================================================================
begin;

create schema d1a_test;
grant usage on schema d1a_test to public;

create function d1a_test.assert_true(cond boolean, label text) returns void
language plpgsql as $f$
begin
  if cond is not true then raise exception 'D1A TEST FAILED: %', label; end if;
end $f$;

-- Runs stmt and requires it to fail with an error whose message starts with expected_prefix
-- (or with the given SQLSTATE when expected_prefix is null).
create function d1a_test.assert_error(stmt text, expected_prefix text, expected_state text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if (expected_prefix is not null and sqlerrm like expected_prefix || '%')
       or (expected_state is not null and sqlstate = expected_state) then
      return;
    end if;
    raise exception 'D1A TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'D1A TEST FAILED: % did not fail', label;
end $f$;

-- ---------------------------------------------------------------------
-- Fixtures (as postgres): managed merchants in every relevant state
-- ---------------------------------------------------------------------
insert into public.merchants (id, slug, name, state_source, review_status, listing_visibility, platform_restriction, business_status) values
  ('00000000-0000-4000-8000-0000000d1a01', 'zz-d1a-public',     'ZZ D1a Public',     'managed', 'approved', 'public', 'none',      'OPEN'),
  ('00000000-0000-4000-8000-0000000d1a02', 'zz-d1a-hidden',     'ZZ D1a Hidden',     'managed', 'approved', 'hidden', 'none',      'OPEN'),
  ('00000000-0000-4000-8000-0000000d1a03', 'zz-d1a-pending',    'ZZ D1a Pending',    'managed', 'pending',  'public', 'none',      'OPEN'),
  ('00000000-0000-4000-8000-0000000d1a04', 'zz-d1a-suspended',  'ZZ D1a Suspended',  'managed', 'approved', 'public', 'suspended', 'OPEN'),
  ('00000000-0000-4000-8000-0000000d1a05', 'zz-d1a-moved',      'ZZ D1a Moved',      'managed', 'approved', 'public', 'none',      'MOVED'),
  ('00000000-0000-4000-8000-0000000d1a06', 'zz-d1a-tempclosed', 'ZZ D1a Temp Closed','managed', 'approved', 'public', 'none',      'TEMPORARILY_CLOSED'),
  ('00000000-0000-4000-8000-0000000d1a07', 'zz-d1a-archived',   'ZZ D1a Archived',   'managed', 'approved', 'public', 'archived',  'OPEN');

-- A legacy row that the old Admin marked SUSPENDED but left is_published = true (AUD-04).
insert into public.merchants (id, slug, name, state_source, is_published, platform_status) values
  ('00000000-0000-4000-8000-0000000d1a10', 'zz-d1a-legacy-suspended', 'ZZ D1a Legacy Suspended', 'legacy', true, 'SUSPENDED'),
  ('00000000-0000-4000-8000-0000000d1a11', 'zz-d1a-legacy-published', 'ZZ D1a Legacy Published', 'legacy', true, 'PUBLISHED');

insert into public.categories (id, merchant_id, name) values
  ('00000000-0000-4000-8000-0000000d1ac1', '00000000-0000-4000-8000-0000000d1a01', 'ZZ D1a Public Category'),
  ('00000000-0000-4000-8000-0000000d1ac4', '00000000-0000-4000-8000-0000000d1a04', 'ZZ D1a Suspended Category'),
  ('00000000-0000-4000-8000-0000000d1ac0', '00000000-0000-4000-8000-0000000d1a10', 'ZZ D1a Legacy Suspended Category');
insert into public.products (merchant_id, category_id, name) values
  ('00000000-0000-4000-8000-0000000d1a01', '00000000-0000-4000-8000-0000000d1ac1', 'ZZ D1a Public Product'),
  ('00000000-0000-4000-8000-0000000d1a04', '00000000-0000-4000-8000-0000000d1ac4', 'ZZ D1a Suspended Product'),
  ('00000000-0000-4000-8000-0000000d1a10', '00000000-0000-4000-8000-0000000d1ac0', 'ZZ D1a Legacy Suspended Product');
insert into public.events (merchant_id, title, date) values
  ('00000000-0000-4000-8000-0000000d1a01', 'ZZ D1a Public Event', current_date),
  ('00000000-0000-4000-8000-0000000d1a02', 'ZZ D1a Hidden Event', current_date),
  ('00000000-0000-4000-8000-0000000d1a04', 'ZZ D1a Suspended Event', current_date);
insert into public.merchant_videos (merchant_id, video_url) values
  ('00000000-0000-4000-8000-0000000d1a01', 'https://example.test/zz-d1a-public'),
  ('00000000-0000-4000-8000-0000000d1a04', 'https://example.test/zz-d1a-suspended');
insert into public.merchant_external_links (merchant_id, link_type, url) values
  ('00000000-0000-4000-8000-0000000d1a01', 'grabfood', 'https://food.grab.com/zz-d1a-public'),
  ('00000000-0000-4000-8000-0000000d1a04', 'grabfood', 'https://food.grab.com/zz-d1a-suspended');

-- ---------------------------------------------------------------------
-- Derived mirrors on managed rows (§7.3)
-- ---------------------------------------------------------------------
select d1a_test.assert_true(
  (select is_published and platform_status = 'PUBLISHED' and first_published_at is not null from public.merchants where slug = 'zz-d1a-public'),
  'approved + public + none + OPEN mirrors to is_published=true / PUBLISHED and records first_published_at');
select d1a_test.assert_true(
  (select not is_published and platform_status = 'PUBLISHED' and first_published_at is null from public.merchants where slug = 'zz-d1a-hidden'),
  'approved but hidden stays unpublished (approval never publishes by itself)');
select d1a_test.assert_true(
  (select not is_published and platform_status = 'PENDING_REVIEW' from public.merchants where slug = 'zz-d1a-pending'),
  'pending mirrors to PENDING_REVIEW and is not public');
select d1a_test.assert_true(
  (select not is_published and platform_status = 'SUSPENDED' from public.merchants where slug = 'zz-d1a-suspended'),
  'suspended mirrors to SUSPENDED and is not public');
select d1a_test.assert_true(
  (select not is_published and platform_status = 'ARCHIVED' from public.merchants where slug = 'zz-d1a-archived'),
  'archived mirrors to ARCHIVED and is not public');
select d1a_test.assert_true(
  (select not is_published from public.merchants where slug = 'zz-d1a-moved'),
  'MOVED is not a normal public page');
select d1a_test.assert_true(
  (select is_published from public.merchants where slug = 'zz-d1a-tempclosed'),
  'TEMPORARILY_CLOSED stays public');
select d1a_test.assert_true(
  (select revision = 0 from public.merchants where slug = 'zz-d1a-public'),
  'a new row starts at revision 0');

-- ---------------------------------------------------------------------
-- Legacy mirrors cannot be written directly on managed rows
-- ---------------------------------------------------------------------
select d1a_test.assert_error(
  $q$update public.merchants set is_published = false where slug = 'zz-d1a-public'$q$,
  'LEGACY_STATE_WRITE_FORBIDDEN', null, 'managed: direct is_published write');
select d1a_test.assert_error(
  $q$update public.merchants set is_published = true where slug = 'zz-d1a-hidden'$q$,
  'LEGACY_STATE_WRITE_FORBIDDEN', null, 'managed: publishing by is_published instead of the state machine');
select d1a_test.assert_error(
  $q$update public.merchants set platform_status = 'PUBLISHED' where slug = 'zz-d1a-suspended'$q$,
  'LEGACY_STATE_WRITE_FORBIDDEN', null, 'managed: lifting a suspension through platform_status');
select d1a_test.assert_error(
  $q$insert into public.merchants (slug, name, state_source, is_published) values ('zz-d1a-bad-insert', 'ZZ', 'managed', true)$q$,
  'LEGACY_STATE_WRITE_FORBIDDEN', null, 'managed: inserting a draft as published');
select d1a_test.assert_error(
  $q$update public.merchants set state_source = 'legacy' where slug = 'zz-d1a-public'$q$,
  'STATE_SOURCE_DOWNGRADE', null, 'managed rows cannot return to legacy');

-- Canonical transitions update the mirrors.
update public.merchants set listing_visibility = 'hidden' where slug = 'zz-d1a-public';
select d1a_test.assert_true(
  (select not is_published and first_published_at is not null from public.merchants where slug = 'zz-d1a-public'),
  'hiding unpublishes but keeps first_published_at');
update public.merchants set listing_visibility = 'public' where slug = 'zz-d1a-public';
select d1a_test.assert_true((select is_published from public.merchants where slug = 'zz-d1a-public'), 're-publishing works through the canonical column');

-- Legacy rows keep today's behaviour: the old Admin can still toggle is_published.
update public.merchants set is_published = false where slug = 'zz-d1a-legacy-published';
select d1a_test.assert_true((select not is_published from public.merchants where slug = 'zz-d1a-legacy-published'), 'legacy: is_published is still writable');
update public.merchants set is_published = true where slug = 'zz-d1a-legacy-published';

-- ---------------------------------------------------------------------
-- revision / updated_at are server-owned
-- ---------------------------------------------------------------------
do $$
declare r0 bigint; r1 bigint; r2 bigint; r3 bigint; u0 timestamptz; u2 timestamptz;
begin
  select revision, updated_at into r0, u0 from public.merchants where slug = 'zz-d1a-hidden';
  update public.merchants set tagline = 'zz changed' where slug = 'zz-d1a-hidden';
  select revision into r1 from public.merchants where slug = 'zz-d1a-hidden';
  update public.merchants set tagline = 'zz changed' where slug = 'zz-d1a-hidden';        -- no-op
  select revision, updated_at into r2, u2 from public.merchants where slug = 'zz-d1a-hidden';
  update public.merchants set revision = 999, updated_at = '2000-01-01' where slug = 'zz-d1a-hidden';  -- client values only
  select revision into r3 from public.merchants where slug = 'zz-d1a-hidden';
  perform d1a_test.assert_true(r1 = r0 + 1, 'a data change increments revision by exactly 1');
  perform d1a_test.assert_true(r2 = r1, 'a no-op update does not increment revision');
  perform d1a_test.assert_true(r3 = r2, 'client-supplied revision/updated_at are ignored');
  perform d1a_test.assert_true(u2 >= u0, 'updated_at is server time');
end $$;

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
select set_config('app.actor_type', 'admin', true);
select set_config('app.actor_id', 'zz-d1a-admin', true);
update public.merchants set platform_restriction = 'suspended' where slug = 'zz-d1a-tempclosed';
select d1a_test.assert_true(
  (select count(*) = 1
     from public.merchant_change_log l
     join public.merchants m on m.id = l.merchant_id
    where m.slug = 'zz-d1a-tempclosed'
      and l.action = 'update'
      and l.actor_type = 'admin'
      and l.actor_id = 'zz-d1a-admin'
      and l.before ->> 'platform_restriction' = 'none'
      and l.after ->> 'platform_restriction' = 'suspended'
      and l.after ->> 'platform_status' = 'SUSPENDED'
      and 'platform_restriction' = any (l.changed_paths)
      and not ('revision' = any (l.changed_paths))),
  'a suspension is audited with actor, before/after state and changed paths');
select d1a_test.assert_true(
  (select count(*) from public.merchant_change_log l join public.merchants m on m.id = l.merchant_id
    where m.slug = 'zz-d1a-hidden' and l.action = 'update') = 1,
  'no-op and ignored-field updates write no audit rows');
select d1a_test.assert_true(
  (select count(*) from public.merchant_change_log l join public.merchants m on m.id = l.merchant_id
    where m.slug = 'zz-d1a-public' and l.action = 'insert') = 1,
  'inserts are audited');
select d1a_test.assert_true(
  (select not (after ? 'reviews') and not (after ? 'email') from public.merchant_change_log l
     join public.merchants m on m.id = l.merchant_id where m.slug = 'zz-d1a-public' and l.action = 'insert'),
  'audit before/after hold state fields only');
select set_config('app.actor_type', 'nonsense', true);
update public.merchants set tagline = 'zz actor check' where slug = 'zz-d1a-archived';
select d1a_test.assert_true(
  (select l.actor_type = 'unknown' from public.merchant_change_log l join public.merchants m on m.id = l.merchant_id
    where m.slug = 'zz-d1a-archived' and l.action = 'update'),
  'an unexpected actor type is recorded as unknown');
select set_config('app.actor_type', '', true);
select set_config('app.actor_id', '', true);

-- ---------------------------------------------------------------------
-- One active owner per merchant
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000d1ae1', 'zz-d1a-owner1@example.test'),
  ('00000000-0000-4000-8000-0000000d1ae2', 'zz-d1a-owner2@example.test');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000d1a01', '00000000-0000-4000-8000-0000000d1ae1', 'owner', 'active');
select d1a_test.assert_error(
  $q$insert into public.merchant_memberships (merchant_id, user_id, role, status)
     values ('00000000-0000-4000-8000-0000000d1a01', '00000000-0000-4000-8000-0000000d1ae2', 'owner', 'active')$q$,
  null, '23505', 'a second active owner for the same merchant');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000d1a01', '00000000-0000-4000-8000-0000000d1ae2', 'owner', 'suspended');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-0000000d1a02', '00000000-0000-4000-8000-0000000d1ae1', 'owner', 'active');
select d1a_test.assert_true(true, 'a suspended former owner is kept, and one user may own several merchants');

-- ---------------------------------------------------------------------
-- What anon and authenticated can read
-- ---------------------------------------------------------------------
set local role anon;
select d1a_test.assert_true(
  (select array_agg(slug order by slug) from public.merchants where slug like 'zz-d1a-%')
    = array['zz-d1a-legacy-published', 'zz-d1a-public'],
  'anon sees only the public managed row and the unrestricted legacy row');
select d1a_test.assert_true((select count(*) from public.merchants where slug = 'zz-sec-test-published') = 1, 'the seeded legacy published merchant is still public');
select d1a_test.assert_true((select count(*) from public.merchants where slug = 'zz-sec-test-draft') = 0, 'the seeded legacy draft is still hidden');
select d1a_test.assert_true(
  (select array_agg(name order by name) from public.categories where name like 'ZZ D1a%') = array['ZZ D1a Public Category'],
  'anon: categories follow the parent (suspended managed and legacy SUSPENDED hidden)');
select d1a_test.assert_true(
  (select array_agg(name order by name) from public.products where name like 'ZZ D1a%') = array['ZZ D1a Public Product'],
  'anon: products follow the parent');
select d1a_test.assert_true(
  (select array_agg(title order by title) from public.events where title like 'ZZ D1a%') = array['ZZ D1a Public Event'],
  'anon: events follow the parent (no more unconditional read)');
select d1a_test.assert_true(
  (select count(*) from public.merchant_videos where video_url like 'https://example.test/zz-d1a-%') = 1,
  'anon: videos follow the parent');
select d1a_test.assert_true(
  (select count(*) from public.merchant_external_links where url like 'https://food.grab.com/zz-d1a-%') = 1,
  'anon: GrabFood links follow the parent');
select d1a_test.assert_error($q$select 1 from public.merchant_change_log limit 1$q$, null, '42501', 'anon reads the audit log');
select d1a_test.assert_error($q$select 1 from public.merchant_stats limit 1$q$, null, '42501', 'anon reads view counts');
select d1a_test.assert_error(
  $q$update public.merchants set review_status = 'approved' where slug = 'zz-d1a-pending'$q$,
  null, '42501', 'anon changes review state');
reset role;

set local role authenticated;
select d1a_test.assert_true(
  (select array_agg(slug order by slug) from public.merchants where slug like 'zz-d1a-%')
    = array['zz-d1a-legacy-published', 'zz-d1a-public'],
  'authenticated sees the same public rows as anon');
select d1a_test.assert_error($q$select 1 from public.merchant_change_log limit 1$q$, null, '42501', 'authenticated reads the audit log');
select d1a_test.assert_error($q$select 1 from public.merchant_stats limit 1$q$, null, '42501', 'authenticated reads view counts');
select d1a_test.assert_error(
  $q$insert into public.merchant_change_log (merchant_id, action, revision) values ('00000000-0000-4000-8000-0000000d1a01', 'update', 1)$q$,
  null, '42501', 'authenticated forges an audit row');
reset role;

set local role service_role;
select d1a_test.assert_true((select count(*) from public.merchants where slug like 'zz-d1a-%') = 9, 'service_role sees every merchant');
select d1a_test.assert_true((select count(*) from public.merchant_change_log) > 0, 'service_role reads the audit log');
update public.merchants set review_status = 'approved' where slug = 'zz-d1a-pending';
select d1a_test.assert_true(
  (select platform_status = 'PUBLISHED' and is_published from public.merchants where slug = 'zz-d1a-pending'),
  'service_role state changes go through the same trigger');
reset role;

select 'ALL D1A STATE BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
