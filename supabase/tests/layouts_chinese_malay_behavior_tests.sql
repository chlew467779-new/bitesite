-- =====================================================================
-- Chinese / Malay layouts in the database: BEHAVIOUR tests. Needs 20261004150000.
-- One transaction, ROLLED BACK. Synthetic rows only.
-- =====================================================================
begin;
create schema lay_test;
create function lay_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'LAYOUT TEST FAILED: %', label; end if; end $f$;
create function lay_test.patch(p_actor_id text, p_mid uuid, p_value jsonb) returns jsonb
language plpgsql as $f$
declare m public.merchants;
begin
  select * into m from public.merchants where id = p_mid;
  return public.merchant_field_patch('owner', p_actor_id, p_mid, gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('path', 'presentation.layout',
      'expected', private.merchant_field_snapshot(m, 'layout', 'layout'), 'value', p_value)));
end $f$;

do $$
declare uid uuid := gen_random_uuid(); mid uuid := gen_random_uuid(); res jsonb;
begin
  perform lay_test.ok(private.merchant_persistable_layouts() = array['classic', 'elegant', 'minimal', 'modern', 'rustic', 'chinese', 'malay'], 'seven layouts');
  insert into auth.users (id, email) values (uid, 'lay-test-' || uid || '@example.test');
  insert into public.merchants (id, slug, name, is_published, platform_status) values (mid, 'lay-test-' || left(mid::text, 8), 'Lay Test', true, 'PUBLISHED');
  insert into public.merchant_memberships (merchant_id, user_id, role, status) values (mid, uid, 'owner', 'active');

  res := lay_test.patch(uid::text, mid, '"chinese"');
  perform lay_test.ok(res ->> 'status' = 'applied' and (select layout from public.merchants where id = mid) = 'chinese', 'chinese saved');
  res := lay_test.patch(uid::text, mid, '"malay"');
  perform lay_test.ok(res ->> 'status' = 'applied' and (select layout from public.merchants where id = mid) = 'malay', 'malay saved');
  begin
    perform lay_test.patch(uid::text, mid, '"thai"');
    raise exception 'LAYOUT TEST FAILED: unknown layout accepted';
  exception when others then if sqlerrm like 'LAYOUT TEST FAILED%' then raise; end if; end;
end $$;

select 'ALL CHINESE / MALAY LAYOUT BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
