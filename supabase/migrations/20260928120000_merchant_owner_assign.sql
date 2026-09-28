-- =====================================================================
-- Admin assigns (or transfers) a restaurant's Owner in one transaction.
-- =====================================================================
-- /api/admin/merchant-memberships POST used to upsert the new active Owner first and suspend the
-- previous one afterwards, so linking a different person to a restaurant that already had an
-- Owner always failed on merchant_memberships_one_active_owner (reproduced locally 2026-09-28).
-- CH 2026-09-28: Admin must be able to move a restaurant to a new account when a business
-- changes hands.
--
--   public.merchant_owner_assign(admin, merchant_id, user_id)
--       Locks the restaurant row, then its active Owner membership. Same user already active ->
--       noop. Otherwise suspends the previous Owner (audit 'suspended'), then activates the new
--       Owner (insert, or reactivate a suspended row; audit 'linked' with previous_user_id).
--       Returns { status, membershipId, previousUserId }.
--
-- Local first; staging and production each need CH approval, after 20260928100000.
-- Rollback: supabase/rollback/20260928120000_merchant_owner_assign.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create or replace function public.merchant_owner_assign(p_actor_type text, p_actor_id text, p_merchant_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_previous public.merchant_memberships;
  v_membership uuid;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_merchant_id is null or p_user_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'ids are required'); end if;
  -- Lock order as everywhere: restaurant row first, then memberships.
  perform 1 from public.merchants where id = p_merchant_id for update;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;

  select * into v_previous from public.merchant_memberships
   where merchant_id = p_merchant_id and role = 'owner' and status = 'active'
   for update;
  if found and v_previous.user_id = p_user_id then
    return jsonb_build_object('status', 'noop', 'membershipId', v_previous.id, 'previousUserId', null);
  end if;

  if v_previous.id is not null then
    update public.merchant_memberships set status = 'suspended' where id = v_previous.id;
    insert into public.merchant_membership_audit (membership_id, merchant_id, action, previous_user_id, user_id, actor)
    values (v_previous.id, p_merchant_id, 'suspended', v_previous.user_id, v_previous.user_id, 'admin');
  end if;

  insert into public.merchant_memberships (merchant_id, user_id, role, status)
  values (p_merchant_id, p_user_id, 'owner', 'active')
  on conflict (merchant_id, user_id) do update set status = 'active', role = 'owner'
  returning id into v_membership;
  insert into public.merchant_membership_audit (membership_id, merchant_id, action, previous_user_id, user_id, actor)
  values (v_membership, p_merchant_id, 'linked', v_previous.user_id, p_user_id, 'admin');

  return jsonb_build_object('status', 'applied', 'membershipId', v_membership, 'previousUserId', v_previous.user_id);
end;
$$;

revoke all on function public.merchant_owner_assign(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.merchant_owner_assign(text, text, uuid, uuid) to service_role;
do $$
begin
  if has_function_privilege('anon', 'public.merchant_owner_assign(text,text,uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_owner_assign(text,text,uuid,uuid)', 'execute') then
    raise exception 'Owner assign self-check: wrong EXECUTE grants';
  end if;
end $$;

commit;
