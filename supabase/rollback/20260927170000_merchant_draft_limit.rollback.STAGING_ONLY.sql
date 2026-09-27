-- ROLLBACK of 20260927170000_merchant_draft_limit.sql - STAGING ONLY.
-- Restores the #64 (20260927090355) merchant_restaurant_create without the three-draft cap.
-- Roll back the application message for DRAFT_LIMIT first (harmless if left).
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
-- Discarded drafts stay archived (Admin can restore them).
drop function if exists public.merchant_draft_discard(text, text, uuid, uuid);
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
commit;
