-- =====================================================================
-- Owner page style and sections: BEHAVIOUR tests. Needs migrations through
-- 20261003150000_owner_page_style. Runs inside the caller's transaction; wrap in begin ... rollback.
-- =====================================================================
create schema ps_test;
create function ps_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'PAGE STYLE TEST FAILED: %', label; end if; end $f$;
create function ps_test.patch(p_actor_id text, p_mid uuid, p_path text, p_kind text, p_target text, p_value jsonb) returns jsonb
language plpgsql as $f$
declare m public.merchants;
begin
  select * into m from public.merchants where id = p_mid;
  return public.merchant_field_patch('owner', p_actor_id, p_mid, gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('path', p_path,
      'expected', private.merchant_field_snapshot(m, p_kind, p_target), 'value', p_value)));
end $f$;

do $$
declare uid uuid := gen_random_uuid(); mid uuid := gen_random_uuid(); res jsonb; snap jsonb; other_layout text;
begin
  insert into auth.users (id, email) values (uid, 'ps-test-' || uid || '@example.test');
  insert into public.merchants (id, slug, name, is_published, platform_status) values (mid, 'ps-test-' || left(mid::text, 8), 'PS Test', true, 'PUBLISHED');
  insert into public.merchant_memberships (merchant_id, user_id, role, status) values (mid, uid, 'owner', 'active');

  -- The Owner now reads the switches they may write, and only those.
  snap := public.merchant_field_snapshot_read('owner', uid::text, mid) -> 'fields';
  perform ps_test.ok(snap ? 'features.hero' and snap ? 'features.appointment' and snap ? 'features.seasonal_popup', 'owner reads writable switches');
  perform ps_test.ok(not (snap ? 'features.events') and not (snap ? 'features.menu') and not (snap ? 'features.reviews'), 'owner does not read closed switches');
  perform ps_test.ok(snap ? 'presentation.layout', 'owner reads the layout');

  select l into other_layout from unnest(private.merchant_persistable_layouts()) l
   where l is distinct from (select layout from public.merchants where id = mid) limit 1;
  res := ps_test.patch(uid::text, mid, 'presentation.layout', 'layout', 'layout', to_jsonb(other_layout));
  perform ps_test.ok(res ->> 'status' = 'applied', 'owner layout write: ' || coalesce(res ->> 'status', res::text));
  perform ps_test.ok((select layout from public.merchants where id = mid) = other_layout, 'layout written');

  begin
    perform ps_test.patch(uid::text, mid, 'presentation.layout', 'layout', 'layout', '"not-a-layout"');
    raise exception 'PAGE STYLE TEST FAILED: unknown layout accepted';
  exception when others then if sqlerrm like 'PAGE STYLE TEST FAILED%' then raise; end if; end;

  -- gallery is off by default; the Owner turns it on.
  res := ps_test.patch(uid::text, mid, 'features.gallery', 'feature', 'gallery', 'true');
  perform ps_test.ok(res ->> 'status' = 'applied', 'owner switch write: ' || coalesce(res ->> 'status', res::text));
  perform ps_test.ok((select features ->> 'gallery' from public.merchants where id = mid) = 'true', 'switch written');

  begin
    perform ps_test.patch(uid::text, mid, 'features.events', 'feature', 'events', 'true');
    raise exception 'PAGE STYLE TEST FAILED: owner wrote events';
  exception when others then if sqlerrm like 'PAGE STYLE TEST FAILED%' then raise; end if; end;

  begin
    perform ps_test.patch(gen_random_uuid()::text, mid, 'features.hero', 'feature', 'hero', 'false');
    raise exception 'PAGE STYLE TEST FAILED: a stranger wrote a switch';
  exception when others then if sqlerrm like 'PAGE STYLE TEST FAILED%' then raise; end if; end;
end $$;

select 'owner page style behaviour tests passed' as result;
