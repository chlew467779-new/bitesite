-- =====================================================================
-- Listing basics change requests: after approval, Owners ask for a new name, address or cuisine;
-- Admin approves (applied atomically) or rejects with a note.
-- =====================================================================
-- Name, location and cuisine are Admin-only once a restaurant is approved (M2-B) and always for
-- legacy restaurants (B0). Until now the Owner could only "contact BiteSite". This package gives
-- them a reviewed request, the same shape as link review (20260927120000):
--
--   public.merchant_basics_request_submit(owner, merchant, request_id, changes)
--       changes: any of {"profile.name": text, "location": {"address", "area"}, "tags.cuisine":
--       [1..3 tags]}. Paths equal to the stored value are dropped (all equal = noop). Location keeps
--       the stored coordinates (Owners cannot move the map pin; Admin can after approval). One
--       pending request per restaurant; a newer one supersedes it. Only when the Owner cannot
--       edit basics directly (legacy, or managed + approved); same lock/state checks as a save.
--   public.merchant_basics_request_withdraw(owner, merchant, request_id, basics_request_id)
--   public.merchant_basics_review(admin, request_id, basics_request_id, 'approve'|'reject', note)
--       Approve applies every requested path in one public.merchant_field_patch call as Admin,
--       compare-and-set against the values stored when the Owner asked; if any path changed since,
--       BASICS_CHANGED_SINCE_REQUEST and the request stays pending. Reject needs a note.
--   public.merchant_basics_read(actor, merchant)  current basics, requestable, recent requests
--   public.merchant_basics_queue(admin)           pending requests, oldest first
--
-- Writes are idempotent per request id (7 days, link-review helpers); the applied change is
-- audited by the D1a trigger as a merchant_field_patch by legacy_admin with the review request id.
-- The slug is not changed by a name change (Admin: Merchant Manager -> web address).
--
-- Local first; staging and production each need CH approval, after 20260927210000.
-- Rollback: supabase/rollback/20260928090000_merchant_basics_requests.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.merchant_basics_requests (
  id            uuid        primary key default gen_random_uuid(),
  merchant_id   uuid        not null references public.merchants(id) on delete cascade,
  changes       jsonb       not null,
  base          jsonb       not null,
  status        text        not null default 'pending',
  submitted_by  uuid        not null,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  review_note   text,
  constraint merchant_basics_requests_changes_check check (jsonb_typeof(changes) = 'object' and changes <> '{}'::jsonb),
  constraint merchant_basics_requests_base_check check (jsonb_typeof(base) = 'object'),
  constraint merchant_basics_requests_status_check check (status in ('pending', 'approved', 'rejected', 'withdrawn', 'superseded')),
  constraint merchant_basics_requests_note_check check (review_note is null or char_length(review_note) <= 500)
);
create unique index merchant_basics_requests_one_pending on public.merchant_basics_requests (merchant_id) where status = 'pending';
create index merchant_basics_requests_queue_idx on public.merchant_basics_requests (status, created_at);
create index merchant_basics_requests_merchant_idx on public.merchant_basics_requests (merchant_id, created_at desc);

alter table public.merchant_basics_requests enable row level security;
revoke all on table public.merchant_basics_requests from public, anon, authenticated, service_role;
grant select, insert, update on table public.merchant_basics_requests to service_role;
comment on table public.merchant_basics_requests is
  'Owner requests to change name/location/cuisine after approval, reviewed by Admin. Private: no anon/authenticated privileges, RLS on, no policies.';

-- The three basics of a row as field-patch snapshots, keyed by path.
create or replace function private.merchant_basics_snapshot(m public.merchants)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'profile.name', private.merchant_field_snapshot(m, 'text', 'name'),
    'location', private.merchant_field_snapshot(m, 'location', 'location'),
    'tags.cuisine', private.merchant_field_snapshot(m, 'tag_array', 'cuisine'))
$$;

-- Whether the Owner must ask instead of editing basics directly.
create or replace function private.merchant_basics_requestable(m public.merchants)
returns boolean
language sql
stable
set search_path = ''
as $$
  select m.platform_restriction = 'none'
     and coalesce(m.platform_status, '') not in ('SUSPENDED', 'ARCHIVED', 'PENDING_REVIEW')
     and (m.state_source = 'legacy' or (m.state_source = 'managed' and m.review_status = 'approved'))
$$;

-- Validate and normalise an Owner proposal against the locked row. Returns only changed paths,
-- each as the full field-patch value (location carries the stored coordinates).
create or replace function private.merchant_basics_proposal(m public.merchants, p_changes jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  loc jsonb;
  addr text;
  area text;
  tags jsonb;
  cur jsonb := private.merchant_basics_snapshot(m);
  out jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_changes) is distinct from 'object' or p_changes = '{}'::jsonb then
    perform private.merchant_write_error('VALIDATION_FAILED', 'changes must be a non-empty object');
  end if;
  for k, v in select * from jsonb_each(p_changes) loop
    if k = 'profile.name' then
      if jsonb_typeof(v) is distinct from 'string' or btrim(v #>> '{}') = '' or char_length(btrim(v #>> '{}')) > 160 then
        perform private.merchant_write_error('VALIDATION_FAILED', 'name');
      end if;
      v := to_jsonb(btrim(v #>> '{}'));
    elsif k = 'location' then
      if jsonb_typeof(v) is distinct from 'object' or exists (select 1 from jsonb_object_keys(v) x where x not in ('address', 'area'))
         or not v ? 'address' then
        perform private.merchant_write_error('VALIDATION_FAILED', 'location');
      end if;
      addr := case when jsonb_typeof(v -> 'address') = 'string' then btrim(v ->> 'address') end;
      if addr is null or addr = '' or char_length(addr) > 500 then
        perform private.merchant_write_error('VALIDATION_FAILED', 'address');
      end if;
      if v ? 'area' and jsonb_typeof(v -> 'area') not in ('null', 'string') then
        perform private.merchant_write_error('VALIDATION_FAILED', 'area');
      end if;
      area := nullif(btrim(coalesce(v ->> 'area', '')), '');
      if char_length(area) > 160 then perform private.merchant_write_error('VALIDATION_FAILED', 'area'); end if;
      loc := cur -> 'location' -> 'value';
      v := jsonb_build_object('address', addr, 'area', area, 'latitude', loc -> 'latitude', 'longitude', loc -> 'longitude');
    elsif k = 'tags.cuisine' then
      if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v) not between 1 and 3
         or exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = '' or char_length(e #>> '{}') > 64) then
        perform private.merchant_write_error('VALIDATION_FAILED', 'cuisine');
      end if;
      select jsonb_agg(t order by ord) into tags
        from (select distinct on (btrim(e)) btrim(e) as t, ord
                from jsonb_array_elements_text(v) with ordinality as x(e, ord) order by btrim(e), ord) d;
      v := tags;
    else
      perform private.merchant_write_error('VALIDATION_FAILED', 'unknown basics path');
    end if;
    if (cur -> k -> 'value') is distinct from v then
      out := out || jsonb_build_object(k, v);
    end if;
  end loop;
  return out;
end;
$$;

create or replace function public.merchant_basics_request_submit(
  p_actor_type text, p_actor_id text, p_merchant_id uuid, p_request_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_basics_request';
  v_hash text;
  v_prev jsonb;
  v_changes jsonb;
  v_base jsonb;
  v_id uuid;
  m public.merchants;
begin
  if p_actor_type is distinct from 'owner' then perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only'); end if;
  if p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required'); end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'changes', p_changes)::text, 'UTF8')), 'hex');
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;
  if not private.merchant_basics_requestable(m) then
    perform private.merchant_write_error('FIELD_NOT_WRITABLE', 'basics_edit_directly');
  end if;

  v_changes := private.merchant_basics_proposal(m, p_changes);
  if v_changes = '{}'::jsonb then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'noop',
      jsonb_build_object('status', 'noop'));
  end if;
  select jsonb_object_agg(s.key, s.value) into v_base
    from jsonb_each(private.merchant_basics_snapshot(m)) s where v_changes ? s.key;
  update public.merchant_basics_requests set status = 'superseded', decided_at = now()
   where merchant_id = m.id and status = 'pending';
  insert into public.merchant_basics_requests (merchant_id, changes, base, submitted_by)
  values (m.id, v_changes, v_base, p_actor_id::uuid)
  returning id into v_id;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'basicsRequestId', v_id, 'paths', (select jsonb_agg(k order by k) from jsonb_object_keys(v_changes) k)));
end;
$$;

create or replace function public.merchant_basics_request_withdraw(
  p_actor_type text, p_actor_id text, p_merchant_id uuid, p_request_id uuid, p_basics_request_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_basics_withdraw';
  v_hash text;
  v_prev jsonb;
  m public.merchants;
begin
  if p_actor_type is distinct from 'owner' then perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only'); end if;
  if p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required'); end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'id', p_basics_request_id)::text, 'UTF8')), 'hex');
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;
  update public.merchant_basics_requests set status = 'withdrawn', decided_at = now()
   where id = p_basics_request_id and merchant_id = m.id and status = 'pending';
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'basics_request'); end if;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied'));
end;
$$;

create or replace function public.merchant_basics_review(
  p_actor_type text, p_actor_id text, p_request_id uuid, p_basics_request_id uuid, p_decision text, p_note text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_basics_review';
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_hash text;
  v_prev jsonb;
  v_merchant uuid;
  v_current jsonb;
  v_patches jsonb;
  v_result jsonb;
  req public.merchant_basics_requests;
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_request_id is null or p_basics_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'ids are required'); end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then perform private.merchant_write_error('VALIDATION_FAILED', 'unknown decision'); end if;
  if p_decision = 'reject' and v_note is null then perform private.merchant_write_error('VALIDATION_FAILED', 'note_required'); end if;
  if char_length(v_note) > 500 then perform private.merchant_write_error('VALIDATION_FAILED', 'note_too_long'); end if;

  select merchant_id into v_merchant from public.merchant_basics_requests where id = p_basics_request_id;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'basics_request'); end if;
  -- Lock order as everywhere: merchant row first, then the request.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, v_merchant, true);
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'id', p_basics_request_id, 'decision', p_decision, 'note', v_note)::text, 'UTF8')), 'hex');
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  select * into req from public.merchant_basics_requests where id = p_basics_request_id for update;
  if req.status <> 'pending' then perform private.merchant_write_error('VALIDATION_FAILED', 'not_pending'); end if;

  if p_decision = 'reject' then
    update public.merchant_basics_requests set status = 'rejected', decided_at = now(), review_note = v_note where id = req.id;
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
      jsonb_build_object('status', 'applied', 'decision', 'reject'));
  end if;

  v_current := private.merchant_basics_snapshot(m);
  if exists (select 1 from jsonb_each(req.base) b where (v_current -> b.key) is distinct from b.value) then
    perform private.merchant_write_error('BASICS_CHANGED_SINCE_REQUEST');
  end if;
  select jsonb_agg(jsonb_build_object('path', c.key, 'expected', req.base -> c.key, 'value', c.value) order by c.key)
    into v_patches from jsonb_each(req.changes) c;
  -- The field-save contract validates every value again with today's rules and audits the write.
  v_result := public.merchant_field_patch(p_actor_type, p_actor_id, m.id, p_request_id, v_patches);
  if v_result ->> 'status' is distinct from 'applied' then
    perform private.merchant_write_error('BASICS_CHANGED_SINCE_REQUEST');
  end if;
  update public.merchant_basics_requests set status = 'approved', decided_at = now(), review_note = v_note where id = req.id;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'decision', 'approve', 'merchantId', m.id, 'slug', m.slug,
                       'changedPaths', v_result -> 'changedPaths'));
end;
$$;

create or replace function private.merchant_basics_public(p_snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p_snapshot -> 'profile.name' -> 'value',
    'address', p_snapshot -> 'location' -> 'value' -> 'address',
    'area', p_snapshot -> 'location' -> 'value' -> 'area',
    'cuisine', coalesce(p_snapshot -> 'tags.cuisine' -> 'value', '[]'::jsonb))
$$;

-- A request's changes in the same flat shape as the current basics (only requested keys).
create or replace function private.merchant_basics_changes_public(p_changes jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'name', p_changes -> 'profile.name',
    'address', p_changes -> 'location' -> 'address',
    'cuisine', p_changes -> 'tags.cuisine'))
  || case when p_changes ? 'location' then jsonb_build_object('area', p_changes -> 'location' -> 'area') else '{}'::jsonb end
$$;

create or replace function public.merchant_basics_read(p_actor_type text, p_actor_id text, p_merchant_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
begin
  if p_actor_type = 'owner' then
    if p_actor_id is null or p_actor_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    select mer.* into m from public.merchants mer
      join public.merchant_memberships mm on mm.merchant_id = mer.id
     where mer.id = p_merchant_id and mm.user_id = p_actor_id::uuid and mm.role = 'owner' and mm.status = 'active';
  elsif p_actor_type = 'admin' and p_actor_id = 'legacy_admin' then
    select * into m from public.merchants where id = p_merchant_id;
  else
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'unknown actor');
  end if;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  return jsonb_build_object(
    'current', private.merchant_basics_public(private.merchant_basics_snapshot(m)),
    'requestable', private.merchant_basics_requestable(m),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'changes', private.merchant_basics_changes_public(r.changes), 'status', r.status,
                                          'createdAt', r.created_at, 'decidedAt', r.decided_at, 'reviewNote', r.review_note)
                       order by r.created_at desc)
        from (select * from public.merchant_basics_requests where merchant_id = m.id
               and (status = 'pending' or decided_at > now() - interval '30 days')
               order by created_at desc limit 10) r), '[]'::jsonb));
end;
$$;

create or replace function public.merchant_basics_queue(p_actor_type text, p_actor_id text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'merchantId', r.merchant_id, 'merchantName', m.name, 'slug', m.slug,
             'current', private.merchant_basics_public(cur.snap),
             'changes', private.merchant_basics_changes_public(r.changes),
             'changedSinceRequest', exists (select 1 from jsonb_each(r.base) b where (cur.snap -> b.key) is distinct from b.value),
             'createdAt', r.created_at) order by r.created_at)
      from (select * from public.merchant_basics_requests where status = 'pending' order by created_at limit 200) r
      join public.merchants m on m.id = r.merchant_id
      cross join lateral (select private.merchant_basics_snapshot(m) as snap) cur), '[]'::jsonb);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_basics_request_submit(text,text,uuid,uuid,jsonb)',
    'public.merchant_basics_request_withdraw(text,text,uuid,uuid,uuid)',
    'public.merchant_basics_review(text,text,uuid,uuid,text,text)',
    'public.merchant_basics_read(text,text,uuid)',
    'public.merchant_basics_queue(text,text)',
    'private.merchant_basics_snapshot(public.merchants)',
    'private.merchant_basics_requestable(public.merchants)',
    'private.merchant_basics_proposal(public.merchants,jsonb)',
    'private.merchant_basics_public(jsonb)',
    'private.merchant_basics_changes_public(jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  foreach fn in array array[
    'public.merchant_basics_request_submit(text,text,uuid,uuid,jsonb)',
    'public.merchant_basics_request_withdraw(text,text,uuid,uuid,uuid)',
    'public.merchant_basics_review(text,text,uuid,uuid,text,text)',
    'public.merchant_basics_read(text,text,uuid)',
    'public.merchant_basics_queue(text,text)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'Basics request self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
end $$;

commit;
