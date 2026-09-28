-- =====================================================================
-- Story submission merchant_id: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260928100000_story_submission_merchant_id. One transaction, ROLLED BACK.
-- =====================================================================
begin;

create schema sm_test;
grant usage on schema sm_test to public;
create function sm_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'STORY MERCHANT TEST FAILED: %', label; end if; end $f$;
create function sm_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'STORY MERCHANT TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'STORY MERCHANT TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema sm_test to public;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000aab1', 'zz-sm-owner@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000aa01', 'zz-sm-a', 'ZZ SM A', true, 'PUBLISHED', '+60111111111'),
  ('00000000-0000-4000-8000-00000000aa02', 'zz-sm-b', 'ZZ SM B', true, 'PUBLISHED', '+60111111112');
insert into public.merchant_memberships (merchant_id, user_id, role, status)
  values ('00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000aab1', 'owner', 'active');

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000aa01';
  b uuid := '00000000-0000-4000-8000-00000000aa02';
  s jsonb;
  sid uuid;
  rid uuid;
begin
  -- The Owner RPC links by id (the trigger fills it from the slug it sets).
  s := public.merchant_story_submission_create('00000000-0000-4000-8000-00000000aab1', a, '{"title":"ZZ story","content":"facts"}');
  sid := (s ->> 'id')::uuid;
  perform sm_test.ok((select merchant_id = a and merchant_slug = 'zz-sm-a' from public.story_submissions where id = sid), 'Owner submission linked');
  perform sm_test.err($s$insert into public.story_submissions (merchant_id, title, content, status) values ('00000000-0000-4000-8000-00000000aa01', 'dup', 'x', 'pending_review')$s$,
                      'duplicate key', 'one pending per restaurant by id');

  -- Admin relayed: slug only -> id resolved; id only -> slug filled; unknown slug stays unlinked.
  insert into public.story_submissions (merchant_slug, channel, title, content) values ('zz-sm-b', 'admin_relayed', 'r1', 'x') returning id into rid;
  perform sm_test.ok((select merchant_id from public.story_submissions where id = rid) = b, 'slug resolves to id');
  insert into public.story_submissions (merchant_id, channel, title, content) values (b, 'admin_relayed', 'r2', 'x') returning id into rid;
  perform sm_test.ok((select merchant_slug from public.story_submissions where id = rid) = 'zz-sm-b', 'id fills slug');
  insert into public.story_submissions (merchant_slug, channel, title, content) values ('zz-sm-nobody', 'admin_relayed', 'r3', 'x') returning id into rid;
  perform sm_test.ok((select merchant_id is null and merchant_slug = 'zz-sm-nobody' from public.story_submissions where id = rid), 'unknown slug stays unlinked');

  -- Moving a submission to another restaurant by slug or by id keeps the pair consistent.
  update public.story_submissions set merchant_slug = 'zz-sm-a' where id = rid;
  perform sm_test.ok((select merchant_id from public.story_submissions where id = rid) = a, 'slug edit relinks');
  update public.story_submissions set merchant_id = b where id = rid;
  perform sm_test.ok((select merchant_slug from public.story_submissions where id = rid) = 'zz-sm-b', 'id edit resyncs slug');
  update public.story_submissions set title = 'r3b' where id = rid;
  perform sm_test.ok((select merchant_id = b and merchant_slug = 'zz-sm-b' from public.story_submissions where id = rid), 'other edits leave the link');
end $$;

-- Slug change (Admin): the cascade updates the slug; the id stays; an old address resolves.
reset role;
do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000aa01';
  rid uuid;
begin
  perform public.merchant_slug_change('admin', 'legacy_admin', a, gen_random_uuid(), 'zz-sm-a-new', 'zz-sm-a');
  perform sm_test.ok(not exists (select 1 from public.story_submissions where merchant_id = a and merchant_slug <> 'zz-sm-a-new'), 'cascade keeps the pair');
  insert into public.story_submissions (merchant_slug, channel, title, content) values ('zz-sm-a', 'admin_relayed', 'old address', 'x') returning id into rid;
  perform sm_test.ok((select merchant_id = a and merchant_slug = 'zz-sm-a-new' from public.story_submissions where id = rid), 'old address resolves via history');

  -- Deleting a restaurant keeps the submission, unlinked.
  delete from public.merchants where id = '00000000-0000-4000-8000-00000000aa02';
  perform sm_test.ok(exists (select 1 from public.story_submissions where merchant_slug = 'zz-sm-b' and merchant_id is null), 'deleted restaurant: history kept, unlinked');
end $$;

-- Backfill logic (same statements as the migration) on rows written without the trigger.
alter table public.story_submissions disable trigger story_submissions_merchant_sync;
insert into public.story_submissions (merchant_slug, channel, title, content) values
  ('zz-sm-a-new', 'admin_relayed', 'bf current', 'x'), ('zz-sm-a', 'admin_relayed', 'bf history', 'x');
alter table public.story_submissions enable trigger story_submissions_merchant_sync;
update public.story_submissions s set merchant_id = m.id from public.merchants m
 where s.merchant_id is null and s.merchant_slug is not null and m.slug = s.merchant_slug;
update public.story_submissions s set merchant_id = h.merchant_id, merchant_slug = m.slug
  from public.merchant_slug_history h join public.merchants m on m.id = h.merchant_id
 where s.merchant_id is null and s.merchant_slug is not null and h.old_slug = s.merchant_slug;
do $$ begin
  perform sm_test.ok((select count(*) from public.story_submissions where title like 'bf %' and merchant_id = '00000000-0000-4000-8000-00000000aa01' and merchant_slug = 'zz-sm-a-new') = 2, 'backfill by current and old slug');
end $$;

set local role anon;
do $$ begin
  perform sm_test.err('select merchant_id from public.story_submissions limit 1', 'permission denied', 'anon cannot read submissions');
end $$;
reset role;

select 'ALL STORY SUBMISSION MERCHANT_ID BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
