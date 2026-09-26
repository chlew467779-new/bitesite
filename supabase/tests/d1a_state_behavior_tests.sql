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
-- legacy → managed only through private.convert_merchant_to_managed
-- ---------------------------------------------------------------------
select d1a_test.assert_true(
  (select count(*) > 0 and bool_and(state_source = 'legacy') from public.merchants where slug like 'zz-sec-test-%'),
  'the migration converted no existing merchant (seeded rows are still legacy)');

insert into public.merchants (id, slug, name, state_source, is_published, platform_status, business_status) values
  ('00000000-0000-4000-8000-0000000d1a12', 'zz-d1a-legacy-convert', 'ZZ D1a Legacy Convert', 'legacy', true, 'PUBLISHED', 'OPEN');
create temp table d1a_convert_before as
  select to_jsonb(m) as row_json from public.merchants m where slug = 'zz-d1a-legacy-convert';
create function d1a_test.convert_target_unchanged() returns boolean
language sql as $f$
  select (select to_jsonb(m) from public.merchants m where slug = 'zz-d1a-legacy-convert') = (select row_json from d1a_convert_before)
     and not exists (select 1 from private.merchant_state_conversion_tickets)
     and (select count(*) from public.merchant_change_log where merchant_id = '00000000-0000-4000-8000-0000000d1a12') = 1;  -- the insert only
$f$;

-- Ordinary UPDATEs cannot convert, whoever runs them.
select d1a_test.assert_error(
  $q$update public.merchants set state_source = 'managed' where slug = 'zz-d1a-legacy-convert'$q$,
  'STATE_SOURCE_CONVERSION_FORBIDDEN', null, 'postgres: plain UPDATE of state_source');
select d1a_test.assert_error(
  $q$update public.merchants set state_source = 'managed', review_status = 'approved', listing_visibility = 'public'
     where slug = 'zz-d1a-legacy-convert'$q$,
  'STATE_SOURCE_CONVERSION_FORBIDDEN', null, 'postgres: plain UPDATE with a complete state');
set local role service_role;
select d1a_test.assert_error(
  $q$update public.merchants set state_source = 'managed', review_status = 'approved', listing_visibility = 'public'
     where slug = 'zz-d1a-legacy-convert'$q$,
  'STATE_SOURCE_CONVERSION_FORBIDDEN', null, 'service_role: plain UPDATE');
select d1a_test.assert_error(
  $q$select private.convert_merchant_to_managed('00000000-0000-4000-8000-0000000d1a12', 0, 'approved', 'public', 'none', 'OPEN', 'zz', 'zz')$q$,
  null, '42501', 'service_role runs the conversion');
select d1a_test.assert_error($q$select 1 from private.merchant_state_conversion_tickets$q$, null, '42501', 'service_role reads tickets');
select d1a_test.assert_error(
  $q$insert into private.merchant_state_conversion_tickets (txid, merchant_id, review_status, listing_visibility, platform_restriction, business_status)
     values (pg_current_xact_id(), '00000000-0000-4000-8000-0000000d1a12', 'approved', 'public', 'none', 'OPEN')$q$,
  null, '42501', 'service_role forges a ticket');
select d1a_test.assert_true(
  private.take_state_conversion_ticket('00000000-0000-4000-8000-0000000d1a12', 'approved', 'public', 'none', 'OPEN') is false,
  'service_role cannot obtain a conversion by calling the ticket check');
reset role;
set local role anon;
select d1a_test.assert_error(
  $q$select private.convert_merchant_to_managed('00000000-0000-4000-8000-0000000d1a12', 0, 'approved', 'public', 'none', 'OPEN', 'zz', 'zz')$q$,
  null, '42501', 'anon runs the conversion');
select d1a_test.assert_error(
  $q$select private.take_state_conversion_ticket('00000000-0000-4000-8000-0000000d1a12', 'approved', 'public', 'none', 'OPEN')$q$,
  null, '42501', 'anon calls the ticket check');
reset role;
set local role authenticated;
select d1a_test.assert_error(
  $q$select private.convert_merchant_to_managed('00000000-0000-4000-8000-0000000d1a12', 0, 'approved', 'public', 'none', 'OPEN', 'zz', 'zz')$q$,
  null, '42501', 'authenticated runs the conversion');
select d1a_test.assert_error($q$select 1 from private.merchant_state_conversion_tickets$q$, null, '42501', 'authenticated reads tickets');
reset role;
select d1a_test.assert_true(d1a_test.convert_target_unchanged(), 'refused conversions left the merchant, tickets and audit log untouched');

-- The conversion needs a complete, valid state, the current revision and a legacy row.
do $$
declare
  v_id constant uuid := '00000000-0000-4000-8000-0000000d1a12';
  rev bigint := (select m.revision from public.merchants m where m.id = '00000000-0000-4000-8000-0000000d1a12');
  call_sql constant text := 'select private.convert_merchant_to_managed(%L, %L, %L, %L, %L, %L, %L, %L)';
begin
  perform d1a_test.assert_error(format(call_sql, v_id, rev, null, 'hidden', 'none', 'OPEN', 'CH', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'missing review_status');
  perform d1a_test.assert_error(format(call_sql, v_id, rev, 'approved', null, 'none', 'OPEN', 'CH', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'missing listing_visibility');
  perform d1a_test.assert_error(format(call_sql, v_id, rev, 'approved', 'hidden', null, 'OPEN', 'CH', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'missing platform_restriction');
  perform d1a_test.assert_error(format(call_sql, v_id, rev, 'approved', 'hidden', 'none', null, 'CH', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'missing business_status');
  perform d1a_test.assert_error(format(call_sql, v_id, rev, 'approved', 'hidden', 'none', 'OPEN', ' ', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'blank actor');
  perform d1a_test.assert_error(format(call_sql, v_id, rev, 'approved', 'hidden', 'none', 'OPEN', 'CH', '  '), 'STATE_CONVERSION_INVALID', null, 'blank reason');
  perform d1a_test.assert_error(format(call_sql, v_id, rev, 'published', 'hidden', 'none', 'OPEN', 'CH', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'unknown review_status');
  perform d1a_test.assert_error(format(call_sql, v_id, rev, 'approved', 'visible', 'none', 'OPEN', 'CH', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'unknown listing_visibility');
  perform d1a_test.assert_error(format(call_sql, v_id, rev, 'approved', 'hidden', 'none', 'CLOSED', 'CH', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'unknown business_status');
  perform d1a_test.assert_error(format(call_sql, v_id, null, 'approved', 'hidden', 'none', 'OPEN', 'CH', 'zz reason'), 'STATE_CONVERSION_INVALID', null, 'missing expected revision');
  perform d1a_test.assert_error(format(call_sql, v_id, rev + 1, 'approved', 'hidden', 'none', 'OPEN', 'CH', 'zz reason'), 'STATE_CONVERSION_REVISION_CONFLICT', null, 'stale expected revision');
  perform d1a_test.assert_error(format(call_sql, '00000000-0000-4000-8000-00000000dead', 0, 'approved', 'hidden', 'none', 'OPEN', 'CH', 'zz reason'), 'STATE_CONVERSION_NOT_FOUND', null, 'unknown merchant');
  perform d1a_test.assert_error(
    format(call_sql, '00000000-0000-4000-8000-0000000d1a02', (select revision from public.merchants where slug = 'zz-d1a-hidden'), 'approved', 'public', 'none', 'OPEN', 'CH', 'zz reason'),
    'STATE_CONVERSION_NOT_LEGACY', null, 'converting a managed merchant again');

  -- A conversion inside a transaction that fails later is rolled back with it (ticket, row, audit).
  begin
    perform private.convert_merchant_to_managed(v_id, rev, 'approved', 'public', 'none', 'OPEN', 'CH', 'zz reason');
    perform d1a_test.assert_true((select state_source = 'managed' from public.merchants where id = '00000000-0000-4000-8000-0000000d1a12'), 'conversion took effect inside the transaction');
    raise exception 'zz forced failure after conversion';
  exception when others then
    if sqlerrm <> 'zz forced failure after conversion' then raise; end if;
  end;
end $$;
select d1a_test.assert_true(d1a_test.convert_target_unchanged(), 'failed conversions (and a rolled-back one) left no trace');

-- A ticket only unlocks the exact merchant and state it was written for. (Writing a ticket by hand
-- needs the database owner; this documents the trigger's matching, not an application path.)
insert into private.merchant_state_conversion_tickets (txid, merchant_id, review_status, listing_visibility, platform_restriction, business_status)
  values (pg_current_xact_id(), '00000000-0000-4000-8000-0000000d1a11', 'approved', 'hidden', 'none', 'OPEN');
select d1a_test.assert_error(
  $q$update public.merchants set state_source = 'managed', review_status = 'approved', listing_visibility = 'hidden' where slug = 'zz-d1a-legacy-convert'$q$,
  'STATE_SOURCE_CONVERSION_FORBIDDEN', null, 'a ticket for another merchant');
select d1a_test.assert_error(
  $q$update public.merchants set state_source = 'managed', review_status = 'approved', listing_visibility = 'public' where slug = 'zz-d1a-legacy-published'$q$,
  'STATE_SOURCE_CONVERSION_FORBIDDEN', null, 'a ticket for a different state');
delete from private.merchant_state_conversion_tickets;

-- The successful path.
do $$
declare rev bigint := (select revision from public.merchants where slug = 'zz-d1a-legacy-convert');
begin
  perform private.convert_merchant_to_managed('00000000-0000-4000-8000-0000000d1a12', rev, 'approved', 'hidden', 'none', 'OPEN',
                                              'CH', 'zz per-merchant mapping approved by CH');
  perform d1a_test.assert_true(
    (select state_source = 'managed' and review_status = 'approved' and listing_visibility = 'hidden'
            and platform_restriction = 'none' and business_status = 'OPEN'
            and not is_published and platform_status = 'PUBLISHED' and revision = rev + 1
       from public.merchants where slug = 'zz-d1a-legacy-convert'),
    'conversion writes exactly the given state, derives the mirrors and bumps revision once');
end $$;
select d1a_test.assert_true(not exists (select 1 from private.merchant_state_conversion_tickets), 'the ticket is consumed');
select d1a_test.assert_true(
  (select count(*) = 1 from public.merchant_change_log
    where merchant_id = '00000000-0000-4000-8000-0000000d1a12' and action = 'update'
      and actor_type = 'admin' and actor_id = 'CH' and reason = 'zz per-merchant mapping approved by CH'
      and before ->> 'state_source' = 'legacy' and after ->> 'state_source' = 'managed'
      and 'state_source' = any (changed_paths) and 'is_published' = any (changed_paths)),
  'the conversion is audited with actor, reason and before/after state');
select d1a_test.assert_true(
  current_setting('app.actor_type', true) is distinct from 'admin' and coalesce(current_setting('app.change_reason', true), '') = '',
  'the conversion does not leave its audit settings behind for later statements');
select d1a_test.assert_error(
  $q$update public.merchants set is_published = true where slug = 'zz-d1a-legacy-convert'$q$,
  'LEGACY_STATE_WRITE_FORBIDDEN', null, 'a converted merchant follows the managed rules');
select d1a_test.assert_error(
  $q$update public.merchants set state_source = 'legacy' where slug = 'zz-d1a-legacy-convert'$q$,
  'STATE_SOURCE_DOWNGRADE', null, 'a converted merchant cannot return to legacy');

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
select d1a_test.assert_true((select count(*) from public.merchants where slug like 'zz-d1a-%') = 10, 'service_role sees every merchant');
select d1a_test.assert_true((select count(*) from public.merchant_change_log) > 0, 'service_role reads the audit log');
update public.merchants set review_status = 'approved' where slug = 'zz-d1a-pending';
select d1a_test.assert_true(
  (select platform_status = 'PUBLISHED' and is_published from public.merchants where slug = 'zz-d1a-pending'),
  'service_role state changes go through the same trigger');
reset role;

select 'ALL D1A STATE BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
