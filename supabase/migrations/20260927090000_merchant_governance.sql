-- =====================================================================
-- D2-C: narrow Admin governance for restaurant visibility (publish / hide / suspend / lift suspension).
-- =====================================================================
-- D2-B retired the old Admin whole-form save, which was the only way to publish, hide or suspend a
-- restaurant. This adds one dedicated, audited, idempotent operation instead of reopening a general
-- {field, value} write. Admin only (the shared Admin session, recorded as `legacy_admin`).
--
-- Legacy rows (every restaurant today; is_published / platform_status are the source of truth):
--   publish    is_published = true, platform_status = 'PUBLISHED'. Needs one valid contact method.
--              Refused while suspended or archived. Also the Admin decision for PENDING_REVIEW.
--   hide       is_published = false (platform_status unchanged). Allowed while suspended, so the
--              restaurant stays hidden when the suspension is lifted.
--   suspend    platform_status = 'SUSPENDED' (is_published kept, so lifting restores it). Owner
--              writes are refused while suspended (existing rule); Admin may still correct content.
--   unsuspend  platform_status = 'PUBLISHED' if is_published, else 'DRAFT'.
-- Managed rows (self-service, later): only suspend / unsuspend (platform_restriction, the Admin
--   column). Public visibility of managed rows belongs to the Owner publication design (M2), so
--   publish / hide are refused here rather than decided early.
-- Archived restaurants: every action is refused (archive / restore is a later governance contract).
--
-- A reason is required for hide, suspend and unsuspend (optional for publish), up to 500 chars.
-- Each call carries a requestId: the same request replays its result for 7 days; a reused id with
-- another action or reason is refused. An action that is already in effect is a no-op (no write,
-- no audit row). Applied actions are audited by the D1a/D2-A trigger with operation
-- `merchant_governance:<action>` and the reason.
--
-- Local first; staging and production each need CH approval, after 20260927034414.
-- Rollback: supabase/rollback/20260927090000_merchant_governance.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

-- Effective governance state of one row, as the Admin editor shows it.
create or replace function private.merchant_governance_restriction(m public.merchants)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when m.state_source = 'managed' then m.platform_restriction
    when m.platform_status = 'SUSPENDED' then 'suspended'
    when m.platform_status = 'ARCHIVED' then 'archived'
    else 'none'
  end;
$$;

-- What one action would do to this row: 'ok' (it changes something), 'noop' (already in effect),
-- or the reason it is refused: 'archived', 'suspended', 'managed_visibility', 'contact'.
create or replace function private.merchant_governance_check(m public.merchants, p_action text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  restriction text := private.merchant_governance_restriction(m);
begin
  if restriction = 'archived' then
    return 'archived';
  end if;
  if p_action = 'suspend' then
    return case when restriction = 'suspended' then 'noop' else 'ok' end;
  end if;
  if p_action = 'unsuspend' then
    return case when restriction = 'suspended' then 'ok' else 'noop' end;
  end if;
  if m.state_source = 'managed' then
    return 'managed_visibility';
  end if;
  if p_action = 'publish' then
    if restriction = 'suspended' then
      return 'suspended';
    end if;
    if private.merchant_is_public(m) then
      return 'noop';
    end if;
    if not private.merchant_has_valid_contact(m) then
      return 'contact';
    end if;
    return 'ok';
  end if;
  if p_action = 'hide' then
    return case when coalesce(m.is_published, false) then 'ok' else 'noop' end;
  end if;
  return null;
end;
$$;

create or replace function private.merchant_governance_state(m public.merchants)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'stateSource', m.state_source,
    'public', private.merchant_is_public(m),
    'restriction', private.merchant_governance_restriction(m),
    'isPublished', m.is_published,
    'platformStatus', m.platform_status,
    'reviewStatus', m.review_status,
    'listingVisibility', m.listing_visibility,
    'businessStatus', m.business_status,
    'hasValidContact', private.merchant_has_valid_contact(m),
    'allowedActions', coalesce((
      select jsonb_agg(a order by ord)
        from unnest(array['publish', 'hide', 'suspend', 'unsuspend']) with ordinality as t(a, ord)
       where private.merchant_governance_check(m, a) = 'ok'), '[]'::jsonb)
  );
$$;

-- Admin read of the governance state.
create or replace function public.merchant_governance_read(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  select * into m from public.merchants where id = p_merchant_id;
  if not found then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND');
  end if;
  return jsonb_build_object('revision', m.revision, 'updatedAt', m.updated_at, 'state', private.merchant_governance_state(m));
end;
$$;

create or replace function public.merchant_governance_apply(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_request_id  uuid,
  p_action      text,
  p_reason      text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_operation constant text := 'merchant_governance';
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_hash text;
  v_check text;
  v_result jsonb;
  m public.merchants;
  idem public.request_idempotency;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_merchant_id is null or p_request_id is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'merchant and request id are required');
  end if;
  if p_action is null or p_action not in ('publish', 'hide', 'suspend', 'unsuspend') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unknown action');
  end if;
  if v_reason is null and p_action <> 'publish' then
    perform private.merchant_write_error('VALIDATION_FAILED', 'reason_required');
  end if;
  if char_length(v_reason) > 500 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'reason_too_long');
  end if;

  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'v', 1, 'op', v_operation, 'merchant', p_merchant_id, 'action', p_action, 'reason', v_reason)::text, 'UTF8')), 'hex');

  -- Lock the restaurant row, then read the idempotency key.
  select * into m from public.merchants where id = p_merchant_id for update;
  if not found then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND');
  end if;

  select * into idem from public.request_idempotency ri
   where ri.actor_type = p_actor_type and ri.actor_id = p_actor_id and ri.merchant_id = p_merchant_id
     and ri.operation = v_operation and ri.request_id = p_request_id;
  if found then
    if idem.expires_at <= now() then
      perform private.merchant_write_error('IDEMPOTENCY_KEY_EXPIRED');
    end if;
    if idem.payload_hash <> v_hash then
      perform private.merchant_write_error('IDEMPOTENCY_KEY_REUSED');
    end if;
    return idem.result || jsonb_build_object('replayed', true);
  end if;

  v_check := private.merchant_governance_check(m, p_action);
  if v_check in ('archived', 'suspended', 'managed_visibility') then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', v_check);
  elsif v_check = 'contact' then
    perform private.merchant_write_error('PUBLIC_CONTACT_MINIMUM');
  end if;

  if v_check = 'noop' then
    v_result := jsonb_build_object('status', 'noop', 'action', p_action, 'revision', m.revision, 'updatedAt', m.updated_at,
                                   'state', private.merchant_governance_state(m));
    insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
    values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'noop', v_result, now() + interval '7 days');
    return v_result || jsonb_build_object('replayed', false);
  end if;

  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_operation || ':' || p_action, true);
  perform set_config('app.change_reason', coalesce(v_reason, ''), true);

  if m.state_source = 'managed' then
    update public.merchants
       set platform_restriction = case p_action when 'suspend' then 'suspended' else 'none' end
     where id = m.id
    returning * into m;
  elsif p_action = 'publish' then
    update public.merchants
       set is_published = true, platform_status = 'PUBLISHED', first_published_at = coalesce(first_published_at, now())
     where id = m.id
    returning * into m;
  elsif p_action = 'hide' then
    update public.merchants set is_published = false where id = m.id returning * into m;
  elsif p_action = 'suspend' then
    update public.merchants set platform_status = 'SUSPENDED' where id = m.id returning * into m;
  else
    update public.merchants
       set platform_status = case when coalesce(is_published, false) then 'PUBLISHED' else 'DRAFT' end
     where id = m.id
    returning * into m;
  end if;

  -- The settings are transaction-local; clear the reason so later writes in the same
  -- transaction are not audited with it.
  perform set_config('app.change_reason', '', true);

  v_result := jsonb_build_object('status', 'applied', 'action', p_action, 'revision', m.revision, 'updatedAt', m.updated_at,
                                 'state', private.merchant_governance_state(m));
  insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
  values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'applied', v_result, now() + interval '7 days');
  return v_result || jsonb_build_object('replayed', false);
end;
$$;

comment on function public.merchant_governance_apply(text, text, uuid, uuid, text, text) is
  'D2-C Admin governance: publish / hide / suspend / unsuspend one restaurant. service_role only; the server supplies the verified Admin actor. Returns {status: applied|noop, action, revision, updatedAt, state}; raises P0001 with an error code otherwise.';

revoke all on function private.merchant_governance_restriction(public.merchants) from public, anon, authenticated;
revoke all on function private.merchant_governance_check(public.merchants, text) from public, anon, authenticated;
revoke all on function private.merchant_governance_state(public.merchants) from public, anon, authenticated;
revoke all on function public.merchant_governance_read(text, text, uuid) from public, anon, authenticated;
revoke all on function public.merchant_governance_apply(text, text, uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function private.merchant_governance_restriction(public.merchants) to service_role;
grant execute on function private.merchant_governance_check(public.merchants, text) to service_role;
grant execute on function private.merchant_governance_state(public.merchants) to service_role;
grant execute on function public.merchant_governance_read(text, text, uuid) to service_role;
grant execute on function public.merchant_governance_apply(text, text, uuid, uuid, text, text) to service_role;

-- Self-check: only service_role may execute the governance functions.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_governance_read(text,text,uuid)',
    'public.merchant_governance_apply(text,text,uuid,uuid,text,text)',
    'private.merchant_governance_check(public.merchants,text)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'D2-C self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
end $$;

commit;
