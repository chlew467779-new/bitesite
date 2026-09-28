-- =====================================================================
-- Slug history and redirects: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927140000_merchant_slug_history. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-slg-*).
-- =====================================================================
begin;

create schema slg_test;
grant usage on schema slg_test to public;
create function slg_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'SLUG TEST FAILED: %', label; end if; end $f$;
create function slg_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'SLUG TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'SLUG TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema slg_test to public;

-- A: published legacy restaurant without first_published_at (as older rows are). B: another restaurant.
-- H: hidden legacy restaurant. D: never-public managed draft with the server-made address.
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000510a', 'zz-slg-old', 'ZZ SLG A', true, 'PUBLISHED', '+60111111111'),
  ('00000000-0000-4000-8000-00000000510b', 'zz-slg-b', 'ZZ SLG B', true, 'PUBLISHED', '+60111111112'),
  ('00000000-0000-4000-8000-00000000510c', 'zz-slg-hidden', 'ZZ SLG H', false, 'DRAFT', null);
insert into public.merchants (id, slug, name, state_source, review_status, listing_visibility, platform_restriction) values
  ('00000000-0000-4000-8000-00000000510d', 'restaurant-00000000-0000-4000-8000-00000000510d', 'ZZ SLG D', 'managed', 'draft', 'hidden', 'none');
insert into public.articles (id, slug, title, content, category, merchant_slug)
  values ('00000000-0000-4000-8000-0000000051a1', 'zz-slg-story', 'ZZ SLG Story', 'x', 'food', 'zz-slg-old');
insert into public.story_submissions (id, merchant_slug, title, content)
  values ('00000000-0000-4000-8000-0000000051b1', 'zz-slg-old', 'ZZ SLG submission', 'x');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000510a';
  b uuid := '00000000-0000-4000-8000-00000000510b';
  h uuid := '00000000-0000-4000-8000-00000000510c';
  d uuid := '00000000-0000-4000-8000-00000000510d';
  r jsonb;
  req uuid := gen_random_uuid();
  chg text := $s$select public.merchant_slug_change(%L, %L, %L::uuid, gen_random_uuid(), %L, %L)$s$;
begin
  perform slg_test.err(format(chg, 'owner', '00000000-0000-4000-8000-000000000001', a, 'zz-slg-new', 'zz-slg-old'), 'OPERATION_FORBIDDEN', 'Owner cannot rename');
  perform slg_test.err(format(chg, 'admin', 'legacy_admin', a, 'ZZ SLG New!', 'zz-slg-old'), 'VALIDATION_FAILED', 'format');
  perform slg_test.err(format(chg, 'admin', 'legacy_admin', a, 'zz-slg-b', 'zz-slg-old'), 'SLUG_TAKEN', 'another restaurant''s current slug');

  -- Stale expected value is a conflict, not an overwrite.
  r := public.merchant_slug_change('admin', 'legacy_admin', a, gen_random_uuid(), 'zz-slg-new', 'zz-slg-stale');
  perform slg_test.ok(r ->> 'status' = 'conflict' and r ->> 'slug' = 'zz-slg-old', 'conflict returns the current slug');

  r := public.merchant_slug_change('admin', 'legacy_admin', a, req, ' ZZ-SLG-NEW ', 'zz-slg-old');
  perform slg_test.ok(r ->> 'status' = 'applied' and (select slug from public.merchants where id = a) = 'zz-slg-new', 'renamed (trimmed, lower case)');
  perform slg_test.ok((public.merchant_slug_change('admin', 'legacy_admin', a, req, ' ZZ-SLG-NEW ', 'zz-slg-old') ->> 'replayed')::boolean, 'replay');
  perform slg_test.ok(exists (select 1 from public.merchant_slug_history where old_slug = 'zz-slg-old' and merchant_id = a), 'old address recorded for a legacy row without first_published_at');
  perform slg_test.ok((select merchant_slug from public.articles where id = '00000000-0000-4000-8000-0000000051a1') = 'zz-slg-new', 'article follows (FK cascade)');
  perform slg_test.ok((select merchant_slug from public.story_submissions where id = '00000000-0000-4000-8000-0000000051b1') = 'zz-slg-new', 'submission follows');
  perform slg_test.ok((select changed_paths from public.merchant_change_log where merchant_id = a order by created_at desc, revision desc limit 1) @> array['slug'], 'audited');
  perform slg_test.ok(public.merchant_slug_change('admin', 'legacy_admin', a, gen_random_uuid(), 'zz-slg-new', 'zz-slg-new') ->> 'status' = 'noop', 'same slug is a no-op');

  -- Old addresses stay with their restaurant.
  perform slg_test.err(format(chg, 'admin', 'legacy_admin', b, 'zz-slg-old', 'zz-slg-b'), 'SLUG_TAKEN', 'history slug refused for another restaurant');
  reset role;
  perform slg_test.err($s$insert into public.merchants (slug, name) values ('zz-slg-old', 'ZZ SLG thief')$s$, 'SLUG_TAKEN', 'direct insert of a history slug refused (Admin create path)');
  perform slg_test.err($s$update public.merchants set slug = 'zz-slg-old' where id = '00000000-0000-4000-8000-00000000510b'$s$, 'SLUG_TAKEN', 'direct update refused');
  set local role service_role;

  -- Changing back removes the address from history and records the newer one.
  r := public.merchant_slug_change('admin', 'legacy_admin', a, gen_random_uuid(), 'zz-slg-old', 'zz-slg-new');
  perform slg_test.ok(not exists (select 1 from public.merchant_slug_history where old_slug = 'zz-slg-old')
                      and exists (select 1 from public.merchant_slug_history where old_slug = 'zz-slg-new' and merchant_id = a), 'change back');
  perform slg_test.ok(jsonb_array_length(public.merchant_slug_read('admin', 'legacy_admin', a) -> 'redirects') = 1, 'read lists redirects');

  -- Never-public M2-B draft address is not kept.
  reset role;
  update public.merchants set slug = 'zz-slg-draft-named' where id = d;
  set local role service_role;
  perform slg_test.ok(not exists (select 1 from public.merchant_slug_history where merchant_id = d), 'draft address not recorded');

  -- Hidden restaurant: rename recorded, but anon cannot see it.
  perform public.merchant_slug_change('admin', 'legacy_admin', h, gen_random_uuid(), 'zz-slg-hidden-2', 'zz-slg-hidden');
end $$;

-- Public read: only restaurants that are public now.
reset role;
set local role anon;
do $$
begin
  perform slg_test.ok(exists (select 1 from public.merchant_slug_history where old_slug = 'zz-slg-new'), 'anon sees the old address of a public restaurant');
  perform slg_test.ok(not exists (select 1 from public.merchant_slug_history where old_slug = 'zz-slg-hidden'), 'anon cannot see a hidden restaurant''s old address');
  perform slg_test.err($s$insert into public.merchant_slug_history (old_slug, merchant_id) values ('zz-slg-x', '00000000-0000-4000-8000-00000000510b')$s$, 'permission denied', 'anon cannot write');
end $$;
reset role;

select 'ALL SLUG HISTORY BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
