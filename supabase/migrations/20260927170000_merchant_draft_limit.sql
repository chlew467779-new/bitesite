-- =====================================================================
-- M2-A completion: at most three editable self-service drafts per account.
-- =====================================================================
-- FINAL_AUDIT M2-A: "a per-user cap of three editable draft/rejected merchants ... The fourth
-- editable draft is rejected; existing drafts remain editable." #64 created drafts without a cap.
--
-- public.merchant_restaurant_create (from 20260927090355) is replaced with the same body plus one
-- check on the new-draft path: if the account already owns three managed restaurants in
-- review_status draft or rejected, it returns {code: 'DRAFT_LIMIT'} and creates nothing. The
-- account row is already locked by private.lock_confirmed_onboarding_user, so concurrent creates
-- by one account are serialized and cannot exceed the cap. Retries of an earlier request still
-- return the draft they created. Pending/approved restaurants do not count.
--
-- Local first; staging and production each need CH approval, after 20260927160000.
-- Rollback: supabase/rollback/20260927170000_merchant_draft_limit.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create or replace function public.merchant_restaurant_create(p_actor_user_id uuid, p_name text, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare m uuid; membership uuid; previous private.merchant_onboarding_requests; restaurant_name text := btrim(p_name);
begin
  -- The API supplies the getUser-verified identity; browsers cannot execute this function.
  -- Lock the user to serialize retry requests and recheck email confirmation in the transaction.
  if not private.lock_confirmed_onboarding_user(p_actor_user_id) then return jsonb_build_object('code', 'AUTH_REQUIRED'); end if;
  if restaurant_name is null or char_length(restaurant_name) not between 1 and 120 or p_request_id is null then
    return jsonb_build_object('code', 'INVALID_INPUT');
  end if;
  select * into previous from private.merchant_onboarding_requests where user_id = p_actor_user_id and request_id = p_request_id;
  if found then
    if previous.name <> restaurant_name then return jsonb_build_object('code', 'REQUEST_CONFLICT'); end if;
    -- Retries may not restore access after ownership is suspended or transferred.
    if not exists(select 1 from public.merchant_memberships where merchant_id = previous.merchant_id and user_id = p_actor_user_id and role = 'owner' and status = 'active') then
      return jsonb_build_object('code', 'REQUEST_CONFLICT');
    end if;
    select id into m from public.merchants where id = previous.merchant_id;
  else
    -- At most three editable self-service drafts per account (the account row is locked above).
    if (select count(*) from public.merchants mer
          join public.merchant_memberships mm on mm.merchant_id = mer.id
         where mm.user_id = p_actor_user_id and mm.role = 'owner' and mm.status = 'active'
           and mer.state_source = 'managed' and mer.review_status in ('draft', 'rejected')) >= 3 then
      return jsonb_build_object('code', 'DRAFT_LIMIT');
    end if;
    m := gen_random_uuid();
    perform set_config('app.actor_type', 'owner', true);
    perform set_config('app.actor_id', p_actor_user_id::text, true);
    perform set_config('app.request_id', p_request_id::text, true);
    insert into public.merchants(id, name, slug, state_source, review_status, listing_visibility, platform_restriction)
      values(m, restaurant_name, 'restaurant-' || m::text, 'managed', 'draft', 'hidden', 'none');
    insert into public.merchant_memberships(merchant_id, user_id, role, status)
      values(m, p_actor_user_id, 'owner', 'active') returning id into membership;
    insert into public.merchant_membership_audit(membership_id, merchant_id, action, user_id, actor)
      values(membership, m, 'linked', p_actor_user_id, 'owner');
    insert into private.merchant_onboarding_requests values(p_actor_user_id, p_request_id, m, restaurant_name);
  end if;
  return (select jsonb_build_object('id', id, 'name', name, 'slug', slug) from public.merchants where id = m);
end $$;

revoke all on function public.merchant_restaurant_create(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.merchant_restaurant_create(uuid, text, uuid) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.merchant_restaurant_create(uuid,text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_restaurant_create(uuid,text,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.merchant_restaurant_create(uuid,text,uuid)', 'execute') then
    raise exception 'Draft limit self-check: wrong EXECUTE grants';
  end if;
end $$;

commit;
