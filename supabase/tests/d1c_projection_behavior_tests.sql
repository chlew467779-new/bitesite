-- =====================================================================
-- D1c Story projection: BEHAVIOUR tests. Local or staging only.
-- Needs supabase/staging/10_synthetic_seed.sql and migrations up to
-- 20260926131040_article_public_projection.sql. Everything runs inside one
-- transaction that is ROLLED BACK at the end. All rows are synthetic (zz-d1c-*).
-- Any failure raises an exception that names the failing check.
-- =====================================================================
begin;

create schema d1c_test;
grant usage on schema d1c_test to public;

create function d1c_test.assert_true(cond boolean, label text) returns void
language plpgsql as $f$
begin
  if cond is not true then raise exception 'D1C TEST FAILED: %', label; end if;
end $f$;

create function d1c_test.assert_error(stmt text, expected_state text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'D1C TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'D1C TEST FAILED: % did not fail', label;
end $f$;

-- ---------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------
insert into public.articles (slug, title, content, category, author, published, editorial_status,
                             review_notes, reviewed_by, rights_declared, generated_copy, view_count) values
  ('zz-d1c-public', 'ZZ D1c Public', 'zz body', 'zz-d1c', 'ZZ Author', true, 'published',
   'zz private review note', 'zz-reviewer', true, '{"zz":"ai draft"}', 1234),
  ('zz-d1c-published-but-rejected', 'ZZ D1c Rejected', 'zz body', 'zz-d1c', 'ZZ Author', true, 'rejected',
   null, null, true, null, 0),
  ('zz-d1c-published-but-draft', 'ZZ D1c Draft Flagged', 'zz body', 'zz-d1c', 'ZZ Author', true, 'draft',
   null, null, true, null, 0),
  ('zz-d1c-editorial-only', 'ZZ D1c Editorial Only', 'zz body', 'zz-d1c', 'ZZ Author', false, 'published',
   null, null, true, null, 0),
  ('zz-d1c-draft', 'ZZ D1c Draft', 'zz body', 'zz-d1c', 'ZZ Author', false, 'draft',
   null, null, false, null, 0);

select d1c_test.assert_true(
  (select array_agg(slug order by slug) from public.articles where slug like 'zz-d1c-%' and private.article_is_public(articles))
    = array['zz-d1c-public'],
  'only published + editorially published Stories satisfy the predicate');

-- ---------------------------------------------------------------------
-- anon and authenticated: same rows, public columns only
-- ---------------------------------------------------------------------
do $$
declare
  r text;
  c text;
  public_select text := 'id, slug, title, excerpt, content, cover_image, category, tags, merchant_slug, author, '
    || 'background_style, published_at, end_at, created_at, updated_at';
  n int;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);

    -- The exact column list the application sends (PUBLIC_ARTICLE_SELECT).
    execute format('select count(*) from (select %s from public.articles where slug like %L) s', public_select, 'zz-d1c-%') into n;
    perform d1c_test.assert_true(n = 1, format('%s: the public column list works and returns only the one public zz-d1c Story', r));
    perform d1c_test.assert_true(
      (select array_agg(slug) from public.articles where slug like 'zz-d1c-%') = array['zz-d1c-public'],
      format('%s: rejected/draft Stories stay hidden even when the published flag is still true', r));

    foreach c in array array['published', 'view_count', 'editorial_status', 'rights_declared', 'review_notes',
                             'submitted_at', 'reviewed_at', 'reviewed_by', 'generated_copy', 'generated_copy_at'] loop
      perform d1c_test.assert_error(format('select %I from public.articles limit 1', c), '42501',
        format('%s reads private column articles.%s', r, c));
    end loop;
    perform d1c_test.assert_error('select * from public.articles limit 1', '42501', format('%s: select * on articles', r));
    perform d1c_test.assert_error('select a from public.articles a limit 1', '42501', format('%s: whole-row reference on articles', r));
    perform d1c_test.assert_error('select count(*) from public.articles where published', '42501',
      format('%s: filtering on the private published flag', r));
    perform d1c_test.assert_error($q$select count(*) from public.articles where editorial_status = 'published'$q$, '42501',
      format('%s: filtering on editorial_status', r));
    perform d1c_test.assert_error('select slug from public.articles order by view_count desc limit 1', '42501',
      format('%s: ordering by view_count', r));
    perform d1c_test.assert_error($q$update public.articles set title = 'zz' where slug = 'zz-d1c-public'$q$, '42501',
      format('%s updates articles', r));

    reset role;
  end loop;
end $$;

-- Rejecting a Story hides it at once, even if the published flag is left behind.
update public.articles set editorial_status = 'rejected' where slug = 'zz-d1c-public';
set local role anon;
select d1c_test.assert_true((select count(*) from public.articles where slug = 'zz-d1c-public') = 0, 'anon: a just-rejected Story disappears');
reset role;
update public.articles set editorial_status = 'published' where slug = 'zz-d1c-public';

-- ---------------------------------------------------------------------
-- service_role keeps full access for server code
-- ---------------------------------------------------------------------
set local role service_role;
select d1c_test.assert_true((select count(*) from public.articles where slug like 'zz-d1c-%') = 5, 'service_role sees every Story');
select d1c_test.assert_true(
  (select review_notes = 'zz private review note' and view_count = 1234 and generated_copy is not null
     from public.articles where slug = 'zz-d1c-public'),
  'service_role reads private columns');
reset role;

select 'ALL D1C PROJECTION BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
