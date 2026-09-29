-- =====================================================================
-- Payment methods: BEHAVIOUR tests. Needs migrations through 20260929120000_merchant_payment_methods.
-- Runs inside the caller's transaction; wrap in begin ... rollback.
-- =====================================================================
create schema pm_test;
create function pm_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'PAYMENT TEST FAILED: %', label; end if; end $f$;
create function pm_test.err(stmt text, expected text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if sqlerrm = expected then return; end if;
    raise exception 'PAYMENT TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'PAYMENT TEST FAILED: % did not fail', label;
end $f$;
create function pm_test.patch(p_actor text, p_actor_id text, p_mid uuid, p_value jsonb) returns jsonb
language plpgsql as $f$
declare m public.merchants;
begin
  select * into m from public.merchants where id = p_mid;
  return public.merchant_field_patch(p_actor, p_actor_id, p_mid, gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('path', 'tags.payment',
      'expected', private.merchant_field_snapshot(m, 'tag_array', 'payment_methods'), 'value', p_value)));
end $f$;

select pm_test.ok((select owner_writable and admin_writable and max_length = 3 from private.merchant_field_registry() where path = 'tags.payment'), 'registry row');
select pm_test.ok((select count(*) from private.merchant_field_registry() where path in ('tags.cuisine', 'location', 'profile.name')) = 3, 'other rows kept');

do $$
declare mid uuid; res jsonb; got text[];
begin
  select id into mid from public.merchants where platform_restriction is distinct from 'suspended' order by created_at limit 1;

  res := pm_test.patch('admin', 'legacy_admin', mid, '["Cash", "Cards"]');
  perform pm_test.ok(res ->> 'status' in ('applied', 'noop'), 'admin write: ' || (res ->> 'status'));
  select payment_methods into got from public.merchants where id = mid;
  perform pm_test.ok(got = array['Cash', 'Cards'], 'column written');
  perform pm_test.ok(res -> 'values' -> 'tags.payment' -> 'value' = '["Cash", "Cards"]'::jsonb, 'confirmed value returned');

  res := pm_test.patch('admin', 'legacy_admin', mid, '[]');
  select payment_methods into got from public.merchants where id = mid;
  perform pm_test.ok(got = '{}'::text[], 'cleared to empty');

  perform pm_test.err(format('select pm_test.patch(%L, %L, %L, %L)', 'admin', 'legacy_admin', mid, '["Bitcoin"]'), 'VALIDATION_FAILED', 'unknown method refused');
  perform pm_test.err(format('select pm_test.patch(%L, %L, %L, %L)', 'admin', 'legacy_admin', mid, '["Cash", "Cash"]'), 'VALIDATION_FAILED', 'duplicate refused');
  perform pm_test.err(format('select pm_test.patch(%L, %L, %L, %L)', 'admin', 'legacy_admin', mid, '"Cash"'), 'VALIDATION_FAILED', 'non-array refused');
end $$;

-- An Owner can write it too, when an active Owner membership exists on a restaurant that is not
-- waiting for review.
do $$
declare r record; res jsonb;
begin
  select mm.merchant_id, mm.user_id into r
    from public.merchant_memberships mm join public.merchants m on m.id = mm.merchant_id
   where mm.role = 'owner' and mm.status = 'active' and m.review_status is distinct from 'pending'
     and m.platform_restriction is distinct from 'suspended'
   limit 1;
  if found then
    res := pm_test.patch('owner', r.user_id::text, r.merchant_id, '["Cashless"]');
    perform pm_test.ok(res ->> 'status' in ('applied', 'noop'), 'owner write: ' || (res ->> 'status'));
    perform pm_test.ok((select payment_methods from public.merchants where id = r.merchant_id) = array['Cashless'], 'owner value written');
  else
    raise notice 'no active owner membership; owner write not exercised';
  end if;
end $$;

select 'payment methods behaviour tests passed' as result;
