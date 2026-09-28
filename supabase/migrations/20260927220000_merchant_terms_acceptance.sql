-- Merchant terms acceptance for self-service restaurant creation (pilot).
-- Local first; hosted environments require separate approval.
begin;

create table private.merchant_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  terms_version text not null,
  rights_declared boolean not null check (rights_declared),
  accepted_at timestamptz not null default now(),
  unique (user_id, merchant_id, terms_version)
);
alter table private.merchant_terms_acceptances enable row level security;
revoke all on private.merchant_terms_acceptances from public, anon, authenticated;
grant select, insert on private.merchant_terms_acceptances to service_role;

create function public.merchant_restaurant_create_v2(p_actor_user_id uuid, p_name text, p_request_id uuid, p_terms_version text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare m uuid; membership uuid; previous private.merchant_onboarding_requests; restaurant_name text := btrim(p_name);
begin
  if p_terms_version is distinct from '2026-09-pilot' then return jsonb_build_object('code', 'TERMS_OUTDATED'); end if;
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
           and mer.state_source = 'managed' and mer.review_status in ('draft', 'rejected')
           and mer.platform_restriction <> 'archived') >= 3 then
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
    insert into private.merchant_terms_acceptances(user_id, merchant_id, terms_version, rights_declared)
      values(p_actor_user_id, m, p_terms_version, true);
  end if;
  return (select jsonb_build_object('id', id, 'name', name, 'slug', slug) from public.merchants where id = m);
end $$;

revoke all on function public.merchant_restaurant_create_v2(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.merchant_restaurant_create_v2(uuid, text, uuid, text) to service_role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'private.merchant_terms_acceptances'::regclass) then
    raise exception 'Merchant terms self-check: RLS is off';
  end if;
  if has_table_privilege('anon', 'private.merchant_terms_acceptances', 'select')
     or has_table_privilege('authenticated', 'private.merchant_terms_acceptances', 'select')
     or not has_table_privilege('service_role', 'private.merchant_terms_acceptances', 'insert') then
    raise exception 'Merchant terms self-check: wrong table grants';
  end if;
  if has_function_privilege('anon', 'public.merchant_restaurant_create_v2(uuid,text,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_restaurant_create_v2(uuid,text,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.merchant_restaurant_create_v2(uuid,text,uuid,text)', 'execute') then
    raise exception 'Merchant terms self-check: wrong EXECUTE grants';
  end if;
end $$;

commit;
