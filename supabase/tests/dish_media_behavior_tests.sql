-- =====================================================================
-- Dish photos: BEHAVIOUR tests. Local or staging only.
-- Needs migrations through 20260927150000_merchant_dish_media. One transaction, ROLLED BACK.
-- Synthetic rows only (zz-dsh-*).
-- =====================================================================
begin;

create schema dsh_test;
grant usage on schema dsh_test to public;
create function dsh_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'DISH TEST FAILED: %', label; end if; end $f$;
create function dsh_test.err(stmt text, expected_prefix text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like expected_prefix || '%' then return; end if;
    raise exception 'DISH TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'DISH TEST FAILED: % did not fail', label;
end $f$;
grant execute on all functions in schema dsh_test to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000d5a1', 'zz-dsh-owner-a@example.test'),
  ('00000000-0000-4000-8000-00000000d5a2', 'zz-dsh-owner-b@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-00000000d501', 'zz-dsh-a', 'ZZ DSH A', true, 'PUBLISHED', '+60111111111'),
  ('00000000-0000-4000-8000-00000000d502', 'zz-dsh-b', 'ZZ DSH B', true, 'PUBLISHED', '+60111111112');
insert into public.merchant_memberships (merchant_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000d501', '00000000-0000-4000-8000-00000000d5a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000d502', '00000000-0000-4000-8000-00000000d5a2', 'owner', 'active');
insert into public.categories (id, merchant_id, name) values
  ('00000000-0000-4000-8000-00000000d5c1', '00000000-0000-4000-8000-00000000d501', 'Mains'),
  ('00000000-0000-4000-8000-00000000d5c2', '00000000-0000-4000-8000-00000000d502', 'Mains');
insert into public.products (id, merchant_id, category_id, name, image_url) values
  ('00000000-0000-4000-8000-00000000d5f1', '00000000-0000-4000-8000-00000000d501', '00000000-0000-4000-8000-00000000d5c1', 'Nasi', null),
  ('00000000-0000-4000-8000-00000000d5f2', '00000000-0000-4000-8000-00000000d502', '00000000-0000-4000-8000-00000000d5c2', 'Mee', null);

set local role service_role;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000d501';
  pa uuid := '00000000-0000-4000-8000-00000000d5f1';
  pb uuid := '00000000-0000-4000-8000-00000000d5f2';
  oa text := '00000000-0000-4000-8000-00000000d5a1';
  ob text := '00000000-0000-4000-8000-00000000d5a2';
  path text := 'dish/00000000-0000-4000-8000-00000000d501/00000000-0000-4000-8000-00000000d5f1/' || gen_random_uuid() || '.jpg';
  url text;
  t jsonb;
  r jsonb;
  req uuid := gen_random_uuid();
  tk text := $s$select public.merchant_dish_media_ticket('owner', %L, %L::uuid, %L::uuid, %L, 'image/jpeg')$s$;
begin
  -- Ticket: the dish must be this restaurant's; the path must be for this dish.
  perform dsh_test.err(format(tk, oa, a, pb, 'dish/' || a || '/' || pb || '/' || gen_random_uuid() || '.jpg'), 'RESOURCE_NOT_FOUND', 'another restaurant''s dish');
  perform dsh_test.err(format(tk, ob, a, pa, path), 'RESOURCE_NOT_FOUND', 'foreign Owner');
  perform dsh_test.err(format(tk, oa, a, pa, 'profile/' || a || '/logo/' || gen_random_uuid() || '.jpg'), 'VALIDATION_FAILED', 'profile path refused');
  perform dsh_test.err(format($s$select public.merchant_dish_media_ticket('owner', %L, %L::uuid, %L::uuid, %L, 'image/gif')$s$, oa, a, pa, path), 'VALIDATION_FAILED', 'gif refused');
  t := public.merchant_dish_media_ticket('owner', oa, a, pa, path, 'image/jpeg');
  url := 'http://127.0.0.1:55321/storage/v1/object/public/merchant-media/' || path;

  -- Bind: CAS, single use, own dish only.
  perform dsh_test.err(format($s$select public.merchant_dish_media_bind('owner', %L, %L::uuid, gen_random_uuid(), %L::uuid, %L::uuid, %L, null)$s$, oa, a, pa, t ->> 'uploadId', 'http://evil.example/x.jpg'),
    'VALIDATION_FAILED', 'public url must match the ticket');
  r := public.merchant_dish_media_bind('owner', oa, a, gen_random_uuid(), pa, (t ->> 'uploadId')::uuid, url, 'stale');
  perform dsh_test.ok(r ->> 'status' = 'conflict' and (select image_url from public.products where id = pa) is null, 'stale expected is a conflict');
  r := public.merchant_dish_media_bind('owner', oa, a, req, pa, (t ->> 'uploadId')::uuid, url, null);
  perform dsh_test.ok(r ->> 'status' = 'applied' and (select image_url from public.products where id = pa) = url, 'bound');
  perform dsh_test.ok((public.merchant_dish_media_bind('owner', oa, a, req, pa, (t ->> 'uploadId')::uuid, url, null) ->> 'replayed')::boolean, 'replay');
  perform dsh_test.err(format($s$select public.merchant_dish_media_bind('owner', %L, %L::uuid, gen_random_uuid(), %L::uuid, %L::uuid, %L, %L)$s$, oa, a, pa, t ->> 'uploadId', url, url),
    'VALIDATION_FAILED', 'ticket binds once');

  -- Remove.
  r := public.merchant_dish_media_bind('owner', oa, a, gen_random_uuid(), pa, null, null, url);
  perform dsh_test.ok(r ->> 'status' = 'applied' and (select image_url from public.products where id = pa) is null, 'removed');

  -- Suspended Owner cannot upload; Admin can.
  perform public.merchant_governance_apply('admin', 'legacy_admin', a, gen_random_uuid(), 'suspend', 'zz test');
  perform dsh_test.err(format(tk, oa, a, pa, 'dish/' || a || '/' || pa || '/' || gen_random_uuid() || '.jpg'), 'MERCHANT_SUSPENDED', 'suspended Owner');
  perform public.merchant_dish_media_ticket('admin', 'legacy_admin', a, pa, 'dish/' || a || '/' || pa || '/' || gen_random_uuid() || '.png', 'image/png');
  perform public.merchant_governance_apply('admin', 'legacy_admin', a, gen_random_uuid(), 'unsuspend', 'zz test');

  -- Dish tickets do not use up the logo/cover limit.
  for i in 1..25 loop
    perform public.merchant_dish_media_ticket('owner', oa, a, pa, 'dish/' || a || '/' || pa || '/' || gen_random_uuid() || '.webp', 'image/webp');
  end loop;
  perform public.merchant_media_ticket('owner', oa, a, 'logo', 'profile/' || a || '/logo/' || gen_random_uuid() || '.jpg', 'image/jpeg');
  perform dsh_test.ok(true, 'logo ticket still allowed after 25 dish tickets');
end $$;

reset role;
do $$
begin
  -- Deleting a dish removes its tickets.
  delete from public.products where id = '00000000-0000-4000-8000-00000000d5f1';
  perform dsh_test.ok(not exists (select 1 from public.merchant_media_uploads where product_id = '00000000-0000-4000-8000-00000000d5f1'), 'tickets follow the dish');
  perform dsh_test.err($s$insert into public.merchant_media_uploads (merchant_id, slot, bucket, path, content_type, actor_type, actor_id, expires_at) values ('00000000-0000-4000-8000-00000000d501', 'dish', 'merchant-media', 'x', 'image/jpeg', 'owner', 'x', now())$s$,
    'new row for relation', 'dish ticket needs a product');
end $$;

select 'ALL DISH MEDIA BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
