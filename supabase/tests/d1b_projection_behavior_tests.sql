-- =====================================================================
-- D1b public projection: BEHAVIOUR tests. Local or staging only.
-- Needs supabase/staging/10_synthetic_seed.sql and migrations up to
-- 20260926101050_merchant_public_projection.sql. Everything runs inside one
-- transaction that is ROLLED BACK at the end. All rows are synthetic (zz-d1b-*).
-- Any failure raises an exception that names the failing check.
-- =====================================================================
begin;

create schema d1b_test;
grant usage on schema d1b_test to public;

create function d1b_test.assert_true(cond boolean, label text) returns void
language plpgsql as $f$
begin
  if cond is not true then raise exception 'D1B TEST FAILED: %', label; end if;
end $f$;

-- Runs stmt and requires it to fail with the given SQLSTATE.
create function d1b_test.assert_error(stmt text, expected_state text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'D1B TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'D1B TEST FAILED: % did not fail', label;
end $f$;

-- ---------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------
insert into public.merchants (id, slug, name, state_source, review_status, listing_visibility, platform_restriction, business_status,
                              email, reviews, settings, reference_website) values
  ('00000000-0000-4000-8000-0000000d1b01', 'zz-d1b-public', 'ZZ D1b Public', 'managed', 'approved', 'public', 'none', 'OPEN',
   'hello@example.test', '[{"author":"ZZ Fake","text":"zz fake review"}]', '{"zz_private":"secret-setting"}', 'https://example.test/zz-reference'),
  ('00000000-0000-4000-8000-0000000d1b02', 'zz-d1b-hidden', 'ZZ D1b Hidden', 'managed', 'approved', 'hidden', 'none', 'OPEN',
   null, null, '{}', null),
  ('00000000-0000-4000-8000-0000000d1b03', 'zz-d1b-suspended', 'ZZ D1b Suspended', 'managed', 'approved', 'public', 'suspended', 'OPEN',
   null, null, '{}', null);
insert into public.merchants (id, slug, name, state_source, is_published, platform_status) values
  ('00000000-0000-4000-8000-0000000d1b10', 'zz-d1b-legacy-live', 'ZZ D1b Legacy Live', 'legacy', true, 'PUBLISHED'),
  ('00000000-0000-4000-8000-0000000d1b11', 'zz-d1b-legacy-suspended', 'ZZ D1b Legacy Suspended', 'legacy', true, 'SUSPENDED');

insert into public.categories (id, merchant_id, name) values
  ('00000000-0000-4000-8000-0000000d1bc1', '00000000-0000-4000-8000-0000000d1b01', 'ZZ D1b Public Category'),
  ('00000000-0000-4000-8000-0000000d1bc2', '00000000-0000-4000-8000-0000000d1b02', 'ZZ D1b Hidden Category'),
  ('00000000-0000-4000-8000-0000000d1bc3', '00000000-0000-4000-8000-0000000d1b03', 'ZZ D1b Suspended Category'),
  ('00000000-0000-4000-8000-0000000d1bca', '00000000-0000-4000-8000-0000000d1b10', 'ZZ D1b Legacy Live Category'),
  ('00000000-0000-4000-8000-0000000d1bcb', '00000000-0000-4000-8000-0000000d1b11', 'ZZ D1b Legacy Suspended Category');
insert into public.products (merchant_id, category_id, name) values
  ('00000000-0000-4000-8000-0000000d1b01', '00000000-0000-4000-8000-0000000d1bc1', 'ZZ D1b Public Product'),
  ('00000000-0000-4000-8000-0000000d1b02', '00000000-0000-4000-8000-0000000d1bc2', 'ZZ D1b Hidden Product'),
  ('00000000-0000-4000-8000-0000000d1b11', '00000000-0000-4000-8000-0000000d1bcb', 'ZZ D1b Legacy Suspended Product');
insert into public.events (merchant_id, title, date) values
  ('00000000-0000-4000-8000-0000000d1b01', 'ZZ D1b Public Event', current_date),
  ('00000000-0000-4000-8000-0000000d1b03', 'ZZ D1b Suspended Event', current_date);
insert into public.merchant_videos (merchant_id, video_url) values
  ('00000000-0000-4000-8000-0000000d1b01', 'https://example.test/zz-d1b-public'),
  ('00000000-0000-4000-8000-0000000d1b02', 'https://example.test/zz-d1b-hidden');
insert into public.merchant_external_links (merchant_id, link_type, url) values
  ('00000000-0000-4000-8000-0000000d1b01', 'grabfood', 'https://food.grab.com/zz-d1b-public'),
  ('00000000-0000-4000-8000-0000000d1b03', 'grabfood', 'https://food.grab.com/zz-d1b-suspended');

-- ---------------------------------------------------------------------
-- The id predicate matches the row predicate
-- ---------------------------------------------------------------------
select d1b_test.assert_true(
  (select bool_and(private.merchant_id_is_public(m.id) = private.merchant_is_public(m)) from public.merchants m),
  'merchant_id_is_public(id) agrees with merchant_is_public(row) for every merchant');
select d1b_test.assert_true(private.merchant_id_is_public('00000000-0000-4000-8000-00000000dead') = false, 'an unknown id is not public');
select d1b_test.assert_true(private.merchant_id_is_public(null) = false, 'a null id is not public');

-- ---------------------------------------------------------------------
-- anon and authenticated: same rows, public columns only
-- ---------------------------------------------------------------------
do $$
declare
  r text;
  c text;
  public_select text := 'id, slug, name, tagline, description, cuisine_type, cuisine, amenities, occasion, tags, area, '
    || 'address, latitude, longitude, phone, whatsapp, email, website, instagram, facebook, cover_image, logo_image, '
    || 'operating_hours, dress_code, menu_pdf_url, video_url, video_type, video_caption, payment_methods, layout, '
    || 'features, status, business_status, created_at, updated_at';
  n int;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);

    -- The exact column list the application sends (PUBLIC_MERCHANT_SELECT).
    execute format('select count(*) from (select %s from public.merchants where slug like %L) s', public_select, 'zz-d1b-%') into n;
    perform d1b_test.assert_true(n = 2, format('%s: the public column list works and returns only the 2 public zz-d1b rows', r));
    perform d1b_test.assert_true(
      (select array_agg(slug order by slug) from public.merchants where slug like 'zz-d1b-%') = array['zz-d1b-legacy-live', 'zz-d1b-public'],
      format('%s: hidden, suspended and legacy SUSPENDED merchants stay invisible', r));
    perform d1b_test.assert_true(
      (select email from public.merchants where slug = 'zz-d1b-public') = 'hello@example.test',
      format('%s: the restaurant''s public contact email is readable', r));

    foreach c in array array['reviews', 'settings', 'reference_website', 'custom_style', 'style', 'is_published',
                             'platform_status', 'review_status', 'listing_visibility', 'platform_restriction',
                             'state_source', 'revision', 'first_published_at'] loop
      perform d1b_test.assert_error(format('select %I from public.merchants limit 1', c), '42501',
        format('%s reads private column merchants.%s', r, c));
    end loop;
    perform d1b_test.assert_error('select * from public.merchants limit 1', '42501', format('%s: select * on merchants', r));
    perform d1b_test.assert_error('select m from public.merchants m limit 1', '42501', format('%s: whole-row reference on merchants', r));
    perform d1b_test.assert_error('select count(*) from public.merchants where is_published', '42501',
      format('%s: filtering on the private is_published mirror', r));
    perform d1b_test.assert_error('select slug from public.merchants order by revision limit 1', '42501',
      format('%s: ordering by a private column', r));
    -- What a PostgREST embed such as categories?select=*,merchants(reviews) turns into.
    perform d1b_test.assert_error(
      'select m.reviews from public.categories c join public.merchants m on m.id = c.merchant_id limit 1', '42501',
      format('%s: reading a private merchant column through a child-table join', r));

    -- Child tables still follow the parent, now through merchant_id_is_public.
    perform d1b_test.assert_true(
      (select array_agg(name order by name) from public.categories where name like 'ZZ D1b%')
        = array['ZZ D1b Legacy Live Category', 'ZZ D1b Public Category'],
      format('%s: categories follow the parent', r));
    perform d1b_test.assert_true(
      (select array_agg(name order by name) from public.products where name like 'ZZ D1b%') = array['ZZ D1b Public Product'],
      format('%s: products follow the parent', r));
    perform d1b_test.assert_true(
      (select array_agg(title order by title) from public.events where title like 'ZZ D1b%') = array['ZZ D1b Public Event'],
      format('%s: events follow the parent', r));
    perform d1b_test.assert_true(
      (select count(*) from public.merchant_videos where video_url like 'https://example.test/zz-d1b-%') = 1,
      format('%s: videos follow the parent', r));
    perform d1b_test.assert_true(
      (select count(*) from public.merchant_external_links where url like 'https://food.grab.com/zz-d1b-%') = 1,
      format('%s: GrabFood links follow the parent', r));
    perform d1b_test.assert_true(
      (select count(*) from public.categories c join public.merchants m on m.id = c.merchant_id
        where c.name like 'ZZ D1b%') = 2,
      format('%s: a child-to-parent join on public columns still works', r));

    -- Writes stay closed.
    perform d1b_test.assert_error($q$update public.merchants set name = 'zz' where slug = 'zz-d1b-public'$q$, '42501',
      format('%s updates merchants', r));

    reset role;
  end loop;
end $$;

-- Hiding a merchant hides its children at once (no cached parent state).
update public.merchants set listing_visibility = 'hidden' where slug = 'zz-d1b-public';
set local role anon;
select d1b_test.assert_true((select count(*) from public.merchants where slug = 'zz-d1b-public') = 0, 'anon: a just-hidden merchant disappears');
select d1b_test.assert_true((select count(*) from public.products where name = 'ZZ D1b Public Product') = 0, 'anon: its products disappear with it');
select d1b_test.assert_true((select count(*) from public.events where title = 'ZZ D1b Public Event') = 0, 'anon: its events disappear with it');
reset role;
update public.merchants set listing_visibility = 'public' where slug = 'zz-d1b-public';

-- ---------------------------------------------------------------------
-- service_role keeps full access for server code
-- ---------------------------------------------------------------------
set local role service_role;
select d1b_test.assert_true((select count(*) from public.merchants where slug like 'zz-d1b-%') = 5, 'service_role sees every merchant');
select d1b_test.assert_true(
  (select reviews is not null and settings ->> 'zz_private' = 'secret-setting' and revision >= 0
     from public.merchants where slug = 'zz-d1b-public'),
  'service_role reads private columns');
reset role;

select 'ALL D1B PROJECTION BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
