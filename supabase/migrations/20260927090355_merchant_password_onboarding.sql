-- Additive auth/onboarding package. Apply only to an explicitly approved environment.
-- Requires D1a, D2-A and B0. No existing restaurant is changed.
begin;
create table private.merchant_password_sources (
  source_key text primary key check (source_key ~ '^[0-9a-f]{64}$'),
  failures integer not null default 0 check (failures between 0 and 5),
  blocked_until timestamptz,
  ticket uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table private.merchant_password_sources enable row level security;
revoke all on private.merchant_password_sources from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on private.merchant_password_sources to service_role;

create function public.merchant_password_attempt_begin(p_source text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r private.merchant_password_sources; t uuid := gen_random_uuid(); n timestamptz := clock_timestamp();
begin
  if p_source is null or p_source !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_SOURCE'; end if;
  insert into private.merchant_password_sources(source_key) values(p_source) on conflict do nothing;
  select * into r from private.merchant_password_sources where source_key = p_source for update;
  if r.blocked_until > n then
    return jsonb_build_object('allowed', false, 'retry_after', ceil(extract(epoch from r.blocked_until - n))::integer);
  end if;
  if r.lease_until > n then return jsonb_build_object('allowed', false, 'retry_after', 30); end if;
  update private.merchant_password_sources set
    failures = case when blocked_until is not null then 0 else failures end,
    blocked_until = null, ticket = t, lease_until = n + interval '30 seconds', updated_at = n
    where source_key = p_source;
  return jsonb_build_object('allowed', true, 'ticket', t);
end $$;

create function public.merchant_password_attempt_finish(p_source text, p_ticket uuid, p_outcome text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r private.merchant_password_sources; f integer; n timestamptz := clock_timestamp();
begin
  if p_outcome is null or p_outcome not in ('success', 'failure', 'other') then raise exception 'INVALID_OUTCOME'; end if;
  select * into r from private.merchant_password_sources where source_key = p_source for update;
  if not found or p_ticket is null or r.ticket is distinct from p_ticket or r.lease_until <= n then
    return jsonb_build_object('accepted', false);
  end if;
  f := case p_outcome when 'success' then 0 when 'failure' then least(r.failures + 1, 5) else r.failures end;
  update private.merchant_password_sources set failures = f,
    blocked_until = case when f = 5 then n + interval '15 minutes' else null end,
    ticket = null, lease_until = null, updated_at = n where source_key = p_source;
  return jsonb_build_object('accepted', true, 'retry_after', case when f = 5 then 900 else 0 end);
end $$;

create table private.merchant_onboarding_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  merchant_id uuid not null references public.merchants(id),
  name text not null,
  primary key(user_id, request_id)
);
alter table private.merchant_onboarding_requests enable row level security;
revoke all on private.merchant_onboarding_requests from public, anon, authenticated;
grant all on private.merchant_onboarding_requests to service_role;

-- auth.users intentionally has no service_role SELECT/UPDATE grant. Keep the narrow
-- confirmation/locking operation private instead of broadening access to Auth records.
create function private.lock_confirmed_onboarding_user(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users where id = p_user_id and email_confirmed_at is not null
    and email is not null and coalesce(is_anonymous, false) = false for update;
  return found;
end $$;
revoke all on function private.lock_confirmed_onboarding_user(uuid) from public, anon, authenticated;
grant execute on function private.lock_confirmed_onboarding_user(uuid) to service_role;

create function public.merchant_restaurant_create(p_actor_user_id uuid, p_name text, p_request_id uuid)
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

revoke all on function public.merchant_password_attempt_begin(text), public.merchant_password_attempt_finish(text, uuid, text), public.merchant_restaurant_create(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.merchant_password_attempt_begin(text), public.merchant_password_attempt_finish(text, uuid, text), public.merchant_restaurant_create(uuid, text, uuid) to service_role;
commit;
