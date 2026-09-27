-- =====================================================================
-- FoodStraits D2-A: atomic field save foundation (master spec 2026-09-26 §8; FINAL_AUDIT/05 D2-A;
-- D2A_IMPLEMENTATION_DIRECTION_20260927)
-- =====================================================================
-- Additive. One transaction with self-checks at the end.
--
-- 1. public.request_idempotency: private idempotency results for merchant writes
--    (scope actor + merchant + operation + request id, server-computed payload hash, 7-day expiry).
-- 2. merchant_change_log gains request_id / operation, and the existing audit trigger records
--    logical leaf paths for the D2 fields (profile.phone, hours.mon, features.gallery, ...) with
--    their before/after values, computed from the real OLD/NEW rows. State auditing is unchanged.
-- 3. private.lock_merchant_for_actor(): the one authorization + lock step for merchant writes.
--    Lock order: merchant row, then the caller's active Owner membership row (both FOR UPDATE),
--    then the idempotency key. Owners must hold an active Owner membership at that point;
--    suspended restaurants refuse Owner writes; archived restaurants refuse Owner and Admin writes; a managed restaurant pending review is
--    frozen for everyone.
-- 4. public.merchant_field_patch(): field-level compare-and-set. Every path carries its expected
--    snapshot ({exists, value}); any mismatch writes nothing (FIELD_CONFLICT). Different fields
--    merge. Only registered paths (private.merchant_field_registry) are accepted; links are not
--    writable here.
-- 5. public.merchant_story_submission_create() / public.merchant_profile_change_request_create():
--    the existing Merchant inserts, with ownership and restaurant state rechecked under the same
--    locks inside the insert transaction.
-- 6. public.request_idempotency_purge_expired(): bounded clean-up of expired keys.
--
-- Every function: SECURITY INVOKER, search_path = '', EXECUTE for service_role only. The actor
-- arguments are trusted only because nothing but the server (service_role) can call them.
--
-- Local first; staging and production each need CH approval. Rollback:
-- supabase/rollback/20260927030741_merchant_field_cas.rollback.STAGING_ONLY.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Idempotency results
-- ---------------------------------------------------------------------
create table public.request_idempotency (
  id            uuid        primary key default gen_random_uuid(),
  actor_type    text        not null,
  actor_id      text        not null,
  merchant_id   uuid        not null references public.merchants(id) on delete cascade,
  operation     text        not null,
  request_id    uuid        not null,
  payload_hash  text        not null,
  result_status text        not null,
  result        jsonb       not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  constraint request_idempotency_actor_type_check check (actor_type in ('owner', 'admin')),
  constraint request_idempotency_result_status_check check (result_status in ('applied', 'noop', 'conflict')),
  constraint request_idempotency_scope_key unique (actor_type, actor_id, merchant_id, operation, request_id)
);

create index request_idempotency_expires_idx on public.request_idempotency (expires_at);

alter table public.request_idempotency enable row level security;
revoke all on table public.request_idempotency from public, anon, authenticated, service_role;
grant select, insert, delete on table public.request_idempotency to service_role;

comment on table public.request_idempotency is
  'Private idempotency results of merchant write RPCs (D2-A). No anon/authenticated privileges, RLS on, no policies. Holds a payload hash and the minimal safe result, never tokens or whole merchant rows. Expires after 7 days; see public.request_idempotency_purge_expired.';

-- ---------------------------------------------------------------------
-- 2) Audit: request metadata + logical leaf paths
-- ---------------------------------------------------------------------
alter table public.merchant_change_log
  add column request_id uuid,
  add column operation  text,
  add constraint merchant_change_log_operation_length check (operation is null or char_length(operation) <= 100);

comment on column public.merchant_change_log.changed_paths is
  'Changed paths. D2 fields are logical leaf paths (profile.<field>, hours.<mon..sun>, features.<key>); other columns are column names.';

create or replace function private.merchants_after_write_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  state_keys constant text[] := array[
    'review_status', 'listing_visibility', 'platform_restriction', 'business_status',
    'state_source', 'is_published', 'platform_status', 'first_published_at'
  ];
  profile_columns constant text[] := array['tagline', 'description', 'phone', 'whatsapp', 'email'];
  day_codes constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  day_keys constant text[] := array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  old_json jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  new_json jsonb := to_jsonb(new);
  changed_cols text[];
  fk text;
  paths text[] := '{}';
  before_values jsonb := '{}';
  after_values jsonb := '{}';
  k text;
  i int;
  old_obj jsonb;
  new_obj jsonb;
  actor text := coalesce(nullif(current_setting('app.actor_type', true), ''), 'unknown');
  request_text text := nullif(current_setting('app.request_id', true), '');
begin
  if actor not in ('owner', 'admin', 'system', 'unknown') then
    actor := 'unknown';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(c order by c), '{}')
      into changed_cols
      from jsonb_object_keys(new_json) c
     where c not in ('revision', 'updated_at')
       and new_json -> c is distinct from old_json -> c;
    if cardinality(changed_cols) = 0 then
      return null;
    end if;

    foreach k in array changed_cols loop
      if k = any (profile_columns) then
        paths := paths || ('profile.' || k);
        before_values := before_values || jsonb_build_object('profile.' || k, old_json -> k);
        after_values := after_values || jsonb_build_object('profile.' || k, new_json -> k);
      elsif k = 'operating_hours'
            and jsonb_typeof(coalesce(old_json -> k, '{}')) in ('object', 'null')
            and jsonb_typeof(coalesce(new_json -> k, '{}')) in ('object', 'null') then
        old_obj := case when jsonb_typeof(old_json -> k) = 'object' then old_json -> k else '{}' end;
        new_obj := case when jsonb_typeof(new_json -> k) = 'object' then new_json -> k else '{}' end;
        for i in 1 .. 7 loop
          if old_obj -> day_keys[i] is distinct from new_obj -> day_keys[i] then
            paths := paths || ('hours.' || day_codes[i]);
            before_values := before_values || jsonb_build_object('hours.' || day_codes[i], old_obj -> day_keys[i]);
            after_values := after_values || jsonb_build_object('hours.' || day_codes[i], new_obj -> day_keys[i]);
          end if;
        end loop;
        -- keys outside the seven days (legacy data) are still reported, by column
        if (old_obj - day_keys) is distinct from (new_obj - day_keys) then
          paths := paths || 'operating_hours';
        end if;
      elsif k = 'features'
            and jsonb_typeof(coalesce(old_json -> k, '{}')) in ('object', 'null')
            and jsonb_typeof(coalesce(new_json -> k, '{}')) in ('object', 'null') then
        old_obj := case when jsonb_typeof(old_json -> k) = 'object' then old_json -> k else '{}' end;
        new_obj := case when jsonb_typeof(new_json -> k) = 'object' then new_json -> k else '{}' end;
        for fk in
          select key from (select jsonb_object_keys(old_obj) key union select jsonb_object_keys(new_obj)) keys order by key
        loop
          if old_obj -> fk is distinct from new_obj -> fk then
            paths := paths || ('features.' || fk);
            before_values := before_values || jsonb_build_object('features.' || fk, old_obj -> fk);
            after_values := after_values || jsonb_build_object('features.' || fk, new_obj -> fk);
          end if;
        end loop;
      else
        paths := paths || k;
      end if;
    end loop;
    paths := coalesce((select array_agg(distinct p order by p) from unnest(paths) p), '{}');
  end if;

  insert into public.merchant_change_log
    (merchant_id, actor_type, actor_id, action, changed_paths, before, after, revision, reason, request_id, operation)
  values (
    new.id,
    actor,
    nullif(current_setting('app.actor_id', true), ''),
    lower(tg_op),
    paths,
    case when tg_op = 'UPDATE' then
      (select coalesce(jsonb_object_agg(s, old_json -> s), '{}') from unnest(state_keys) s) || before_values
    end,
    (select coalesce(jsonb_object_agg(s, new_json -> s), '{}') from unnest(state_keys) s) || after_values,
    new.revision,
    left(nullif(current_setting('app.change_reason', true), ''), 1000),
    case when request_text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then request_text::uuid end,
    left(nullif(current_setting('app.operation', true), ''), 100)
  );
  return null;
end;
$$;

revoke all on function private.merchants_after_write_audit() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) Authorization + locks
-- ---------------------------------------------------------------------
create or replace function private.merchant_write_error(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end;
$$;

create or replace function private.lock_merchant_for_actor(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_write       boolean
)
returns public.merchants
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  v_user uuid;
begin
  if p_merchant_id is null then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND');
  end if;

  if p_actor_type = 'owner' then
    if p_actor_id is null or p_actor_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    v_user := p_actor_id::uuid;
    -- Screen without locking or echoing anything, so a foreign merchant ID cannot lock rows.
    perform 1 from public.merchant_memberships mm
     where mm.merchant_id = p_merchant_id and mm.user_id = v_user and mm.role = 'owner' and mm.status = 'active';
    if not found then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    select * into m from public.merchants where id = p_merchant_id for update;
    if not found then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    -- Recheck under a lock that blocks a concurrent revoke/transfer until this transaction ends.
    perform 1 from public.merchant_memberships mm
     where mm.merchant_id = p_merchant_id and mm.user_id = v_user and mm.role = 'owner' and mm.status = 'active'
       for update;
    if not found then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
  elsif p_actor_type = 'admin' then
    -- The Admin session is a shared HMAC session without a personal user; the server passes this
    -- fixed principal and nothing else.
    if p_actor_id is distinct from 'legacy_admin' then
      perform private.merchant_write_error('OPERATION_FORBIDDEN', 'unknown admin principal');
    end if;
    select * into m from public.merchants where id = p_merchant_id for update;
    if not found then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
  else
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'unknown actor type');
  end if;

  if p_write then
    if p_actor_type = 'owner' then
      if m.platform_restriction = 'suspended' or m.platform_status = 'SUSPENDED' then
        perform private.merchant_write_error('MERCHANT_SUSPENDED');
      end if;
    end if;
    if m.platform_restriction = 'archived' or m.platform_status = 'ARCHIVED' then
      perform private.merchant_write_error('OPERATION_FORBIDDEN', 'archived');
    end if;
    -- Restaurant review pending (not Story or link review): managed rows by review_status,
    -- legacy rows by their still-authoritative platform_status.
    if (m.state_source = 'managed' and m.review_status = 'pending')
       or (m.state_source = 'legacy' and m.platform_status = 'PENDING_REVIEW') then
      perform private.merchant_write_error('OPERATION_FORBIDDEN', 'pending_review');
    end if;
  end if;
  return m;
end;
$$;

-- ---------------------------------------------------------------------
-- 3b) Valid public contact methods: the same rules as lib/merchant-profile-validation.mjs (phone,
--     email) and lib/merchant-booking-target.mjs (WhatsApp, as used by the booking button).
-- ---------------------------------------------------------------------
create or replace function private.is_valid_contact_phone(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(p_value) ~ '^\+?[\d\s().-]+$'
     and char_length(regexp_replace(btrim(p_value), '\D', '', 'g')) between 7 and 15, false)
$$;

create or replace function private.is_valid_contact_whatsapp(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(p_value) ~ '^\+?[\d\s().-]+$'
     and regexp_replace(btrim(p_value), '[\s().+-]', '', 'g') ~ '^[1-9]\d{7,14}$', false)
$$;

create or replace function private.is_valid_contact_email(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(p_value) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$', false)
$$;

create or replace function private.merchant_has_valid_contact(m public.merchants)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.is_valid_contact_phone(m.phone)
      or private.is_valid_contact_whatsapp(m.whatsapp)
      or private.is_valid_contact_email(m.email)
$$;

-- ---------------------------------------------------------------------
-- 4) Field registry and field-level compare-and-set
-- ---------------------------------------------------------------------
-- kind: text (merchants column), hours (operating_hours day key), feature (features key, boolean).
-- Paths listed with writable = false are known but refused (FIELD_NOT_WRITABLE): links wait for
-- the link review queue (M6a); features.menu protects the public menu; features.reviews is retired.
create or replace function private.merchant_field_registry()
returns table (path text, kind text, target text, owner_writable boolean, admin_writable boolean, max_length int)
language sql
immutable
set search_path = ''
as $$
  values
    ('profile.tagline',      'text',    'tagline',      true,  true,  300),
    ('profile.description',  'text',    'description',  true,  true,  10000),
    ('profile.phone',        'text',    'phone',        true,  true,  40),
    ('profile.whatsapp',     'text',    'whatsapp',     true,  true,  40),
    ('profile.email',        'text',    'email',        true,  true,  254),
    ('profile.website',      'text',    'website',      false, false, null),
    ('profile.instagram',    'text',    'instagram',    false, false, null),
    ('profile.facebook',     'text',    'facebook',     false, false, null),
    ('profile.menu_pdf_url', 'text',    'menu_pdf_url', false, false, null),
    ('hours.mon',            'hours',   'monday',       true,  true,  100),
    ('hours.tue',            'hours',   'tuesday',      true,  true,  100),
    ('hours.wed',            'hours',   'wednesday',    true,  true,  100),
    ('hours.thu',            'hours',   'thursday',     true,  true,  100),
    ('hours.fri',            'hours',   'friday',       true,  true,  100),
    ('hours.sat',            'hours',   'saturday',     true,  true,  100),
    ('hours.sun',            'hours',   'sunday',       true,  true,  100),
    ('features.hero',           'feature', 'hero',           false, true, null),
    ('features.about',          'feature', 'about',          false, true, null),
    ('features.contact',        'feature', 'contact',        false, true, null),
    ('features.gallery',        'feature', 'gallery',        false, true, null),
    ('features.events',         'feature', 'events',         false, true, null),
    ('features.appointment',    'feature', 'appointment',    false, true, null),
    ('features.seasonal_popup', 'feature', 'seasonal_popup', false, true, null),
    ('features.menu',           'feature', 'menu',           false, false, null),
    ('features.reviews',        'feature', 'reviews',        false, false, null)
$$;

-- The stored value of one path as a snapshot: {"exists": bool, "value": ...}; value omitted when
-- the path does not exist. No normalisation: stored values compare exactly.
create or replace function private.merchant_field_snapshot(m public.merchants, p_kind text, p_target text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  row_json jsonb := to_jsonb(m);
  container jsonb;
begin
  if p_kind = 'text' then
    return jsonb_build_object('exists', true, 'value', row_json -> p_target);
  end if;
  container := row_json -> (case when p_kind = 'hours' then 'operating_hours' else 'features' end);
  if jsonb_typeof(container) = 'object' and container ? p_target then
    return jsonb_build_object('exists', true, 'value', container -> p_target);
  end if;
  return jsonb_build_object('exists', false);
end;
$$;

create or replace function public.merchant_field_patch(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_request_id  uuid,
  p_patches     jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_operation constant text := 'merchant_field_patch';
  patch jsonb;
  reg record;
  expected jsonb;
  desired jsonb;
  seen text[] := '{}';
  canonical jsonb;
  v_hash text;
  m public.merchants;
  cand public.merchants;
  idem public.request_idempotency;
  hours_obj jsonb;
  features_obj jsonb;
  current_snap jsonb;
  conflicts jsonb := '[]';
  changed_paths text[] := '{}';
  v_result jsonb;
  values_out jsonb := '{}';
  new_revision bigint;
  new_updated_at timestamptz;
begin
  -- Input shape. Nothing here reads merchant data.
  if p_request_id is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'requestId is required');
  end if;
  if jsonb_typeof(p_patches) is distinct from 'array' or jsonb_array_length(p_patches) = 0 or jsonb_array_length(p_patches) > 50 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'patches must be an array of 1 to 50 items');
  end if;

  for patch in select value from jsonb_array_elements(p_patches) loop
    if jsonb_typeof(patch) is distinct from 'object' then
      perform private.merchant_write_error('VALIDATION_FAILED', 'each patch has exactly path, expected and value');
    end if;
    if (select count(*) from jsonb_object_keys(patch)) <> 3
       or not (patch ? 'path' and patch ? 'expected' and patch ? 'value')
       or jsonb_typeof(patch -> 'path') is distinct from 'string' then
      perform private.merchant_write_error('VALIDATION_FAILED', 'each patch has exactly path, expected and value');
    end if;
    select * into reg from private.merchant_field_registry() r where r.path = patch ->> 'path';
    if not found then
      perform private.merchant_write_error('UNKNOWN_FIELD', patch ->> 'path');
    end if;
    if reg.path = any (seen) then
      perform private.merchant_write_error('VALIDATION_FAILED', 'duplicate path ' || reg.path);
    end if;
    seen := seen || reg.path;
    if (p_actor_type = 'owner' and not reg.owner_writable) or (p_actor_type = 'admin' and not reg.admin_writable)
       or p_actor_type not in ('owner', 'admin') then
      perform private.merchant_write_error('FIELD_NOT_WRITABLE', reg.path);
    end if;

    expected := patch -> 'expected';
    if jsonb_typeof(expected) is distinct from 'object' or jsonb_typeof(expected -> 'exists') is distinct from 'boolean' then
      perform private.merchant_write_error('VALIDATION_FAILED', 'expected must be {exists, value} for ' || reg.path);
    end if;
    if (expected -> 'exists') = 'true'::jsonb then
      if (select count(*) from jsonb_object_keys(expected)) <> 2 or not expected ? 'value' then
        perform private.merchant_write_error('VALIDATION_FAILED', 'expected must be {exists, value} for ' || reg.path);
      end if;
    elsif (select count(*) from jsonb_object_keys(expected)) <> 1 then
      perform private.merchant_write_error('VALIDATION_FAILED', 'expected {exists: false} has no value for ' || reg.path);
    end if;

    desired := patch -> 'value';
    if reg.kind in ('text', 'hours') then
      if jsonb_typeof(desired) = 'null' then
        null; -- clears the field / removes the day
      elsif jsonb_typeof(desired) is distinct from 'string' or btrim(desired #>> '{}') = '' then
        perform private.merchant_write_error('VALIDATION_FAILED', reg.path || ' must be a non-empty string or null');
      elsif char_length(desired #>> '{}') > reg.max_length then
        perform private.merchant_write_error('VALIDATION_FAILED', reg.path || ' is longer than ' || reg.max_length);
      end if;
    elsif reg.kind = 'feature' and jsonb_typeof(desired) is distinct from 'boolean' then
      perform private.merchant_write_error('VALIDATION_FAILED', reg.path || ' must be true or false');
    end if;
  end loop;

  -- Server-computed payload hash: protocol version, operation, target, patches sorted by path.
  canonical := jsonb_build_object(
    'v', 1, 'op', v_operation, 'merchant', p_merchant_id,
    'patches', (select jsonb_agg(jsonb_build_object('path', e ->> 'path', 'expected', e -> 'expected', 'value', e -> 'value') order by e ->> 'path')
                  from jsonb_array_elements(p_patches) e));
  v_hash := encode(sha256(convert_to(canonical::text, 'UTF8')), 'hex');

  -- Authorization and locks: merchant row, Owner membership row, then the idempotency key.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);

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

  -- Compare every expected value against the locked row before changing anything.
  cand := m;
  hours_obj := case when jsonb_typeof(to_jsonb(m) -> 'operating_hours') = 'object' then to_jsonb(m) -> 'operating_hours' else '{}' end;
  features_obj := case when jsonb_typeof(to_jsonb(m) -> 'features') = 'object' then to_jsonb(m) -> 'features' else '{}' end;

  for patch in select value from jsonb_array_elements(p_patches) loop
    select * into reg from private.merchant_field_registry() r where r.path = patch ->> 'path';
    current_snap := private.merchant_field_snapshot(m, reg.kind, reg.target);
    if current_snap is distinct from (patch -> 'expected') then
      conflicts := conflicts || jsonb_build_object('path', reg.path, 'expected', patch -> 'expected', 'current', current_snap, 'proposed', patch -> 'value');
    end if;
  end loop;

  if jsonb_array_length(conflicts) > 0 then
    v_result := jsonb_build_object('status', 'conflict', 'conflicts', conflicts, 'revision', m.revision, 'updatedAt', m.updated_at);
    insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
    values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'conflict', v_result, now() + interval '7 days');
    return v_result || jsonb_build_object('replayed', false);
  end if;

  -- Build the candidate state from the current row plus the desired values.
  for patch in select value from jsonb_array_elements(p_patches) loop
    select * into reg from private.merchant_field_registry() r where r.path = patch ->> 'path';
    desired := patch -> 'value';
    if private.merchant_field_snapshot(m, reg.kind, reg.target)
       is not distinct from (case when jsonb_typeof(desired) = 'null' and reg.kind <> 'text' then jsonb_build_object('exists', false)
                                  else jsonb_build_object('exists', true, 'value', desired) end) then
      continue; -- already the desired value
    end if;
    changed_paths := changed_paths || reg.path;
    if reg.kind = 'text' then
      case reg.target
        when 'tagline' then cand.tagline := desired #>> '{}';
        when 'description' then cand.description := desired #>> '{}';
        when 'phone' then cand.phone := desired #>> '{}';
        when 'whatsapp' then cand.whatsapp := desired #>> '{}';
        when 'email' then cand.email := desired #>> '{}';
      end case;
    elsif reg.kind = 'hours' then
      hours_obj := case when jsonb_typeof(desired) = 'null' then hours_obj - reg.target else jsonb_set(hours_obj, array[reg.target], desired, true) end;
    else
      features_obj := jsonb_set(features_obj, array[reg.target], desired, true);
    end if;
  end loop;

  if cardinality(changed_paths) = 0 then
    -- Confirm every requested value even when nothing changes, including absent day keys.
    for patch in select value from jsonb_array_elements(p_patches) loop
      select * into reg from private.merchant_field_registry() r where r.path = patch ->> 'path';
      values_out := values_out || jsonb_build_object(reg.path, private.merchant_field_snapshot(m, reg.kind, reg.target));
    end loop;
    v_result := jsonb_build_object('status', 'noop', 'revision', m.revision, 'updatedAt', m.updated_at, 'values', values_out);
    insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
    values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'noop', v_result, now() + interval '7 days');
    return v_result || jsonb_build_object('replayed', false);
  end if;

  if (select count(*) from unnest(changed_paths) p where p like 'hours.%') > 0 then
    cand.operating_hours := case when hours_obj = '{}'::jsonb then null else hours_obj end;
  end if;
  if (select count(*) from unnest(changed_paths) p where p like 'features.%') > 0 then
    cand.features := features_obj;
  end if;

  -- A public restaurant keeps at least one valid contact method. A save that touches the contact
  -- fields must leave one (so it also repairs older data that had none); saves of other fields
  -- are not blocked by older contact data.
  if private.merchant_is_public(m)
     and exists (select 1 from unnest(changed_paths) p where p in ('profile.phone', 'profile.whatsapp', 'profile.email'))
     and not private.merchant_has_valid_contact(cand) then
    perform private.merchant_write_error('PUBLIC_CONTACT_MINIMUM');
  end if;

  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_operation, true);

  -- One UPDATE; revision and updated_at come from the D1a trigger.
  update public.merchants
     set tagline = cand.tagline,
         description = cand.description,
         phone = cand.phone,
         whatsapp = cand.whatsapp,
         email = cand.email,
         operating_hours = cand.operating_hours,
         features = cand.features
   where id = m.id
  returning * into cand;
  new_revision := cand.revision;
  new_updated_at := cand.updated_at;

  for patch in select value from jsonb_array_elements(p_patches) loop
    select * into reg from private.merchant_field_registry() r where r.path = patch ->> 'path';
    values_out := values_out || jsonb_build_object(reg.path, private.merchant_field_snapshot(cand, reg.kind, reg.target));
  end loop;

  v_result := jsonb_build_object('status', 'applied', 'revision', new_revision, 'updatedAt', new_updated_at, 'changedPaths', to_jsonb(changed_paths), 'values', values_out);
  insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
  values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'applied', v_result, now() + interval '7 days');
  return v_result || jsonb_build_object('replayed', false);
end;
$$;

comment on function public.merchant_field_patch(text, text, uuid, uuid, jsonb) is
  'D2-A field-level compare-and-set for merchant profile/hours/features paths. service_role only; the caller (server) supplies a verified actor. Returns {status: applied|noop|conflict, ...}; raises P0001 with an error code otherwise.';

-- Snapshot of every registered path, for the server read endpoints.
create or replace function public.merchant_field_snapshot_read(
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
  v_user uuid;
  v_out jsonb := '{}';
  reg record;
begin
  if p_actor_type = 'owner' then
    if p_actor_id is null or p_actor_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    v_user := p_actor_id::uuid;
    select mer.* into m from public.merchants mer
      join public.merchant_memberships mm on mm.merchant_id = mer.id
     where mer.id = p_merchant_id and mm.user_id = v_user and mm.role = 'owner' and mm.status = 'active';
  elsif p_actor_type = 'admin' and p_actor_id = 'legacy_admin' then
    select * into m from public.merchants where id = p_merchant_id;
  else
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'unknown actor');
  end if;
  if not found then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND');
  end if;
  for reg in select * from private.merchant_field_registry() r
              where (p_actor_type = 'admin' or r.kind <> 'feature') loop
    v_out := v_out || jsonb_build_object(reg.path, private.merchant_field_snapshot(m, reg.kind, reg.target));
  end loop;
  return jsonb_build_object('revision', m.revision, 'updatedAt', m.updated_at, 'fields', v_out);
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Merchant inserts with ownership rechecked in the insert transaction
-- ---------------------------------------------------------------------
create or replace function public.merchant_story_submission_create(
  p_user_id     uuid,
  p_merchant_id uuid,
  p_submission  jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  s public.story_submissions;
begin
  if jsonb_typeof(p_submission) is distinct from 'object'
     or jsonb_typeof(p_submission -> 'title') is distinct from 'string'
     or jsonb_typeof(p_submission -> 'content') is distinct from 'string'
     or char_length(btrim(p_submission ->> 'title')) not between 1 and 160
     or char_length(btrim(p_submission ->> 'content')) not between 1 and 20000
     or char_length(coalesce(p_submission ->> 'excerpt', '')) > 500
     or jsonb_typeof(coalesce(p_submission -> 'image_urls', '[]')) is distinct from 'array'
     or jsonb_array_length(coalesce(p_submission -> 'image_urls', '[]')) > 3
     or jsonb_typeof(coalesce(p_submission -> 'facts', '{}')) is distinct from 'object' then
    perform private.merchant_write_error('VALIDATION_FAILED', 'invalid Story submission');
  end if;

  m := private.lock_merchant_for_actor('owner', p_user_id::text, p_merchant_id, true);

  insert into public.story_submissions (
    merchant_slug, channel, status, title, excerpt, content, story_angle, facts, cover_image,
    image_urls, rights_declared, rights_note, ai_assistance_requested, submitted_by, submitted_at, updated_at
  ) values (
    m.slug, 'self_service_form', 'pending_review',
    btrim(p_submission ->> 'title'),
    nullif(btrim(coalesce(p_submission ->> 'excerpt', '')), ''),
    btrim(p_submission ->> 'content'),
    nullif(btrim(coalesce(p_submission ->> 'story_angle', '')), ''),
    coalesce(p_submission -> 'facts', '{}'),
    nullif(coalesce(p_submission ->> 'cover_image', ''), ''),
    coalesce(p_submission -> 'image_urls', '[]'),
    true,
    nullif(btrim(coalesce(p_submission ->> 'rights_note', '')), ''),
    coalesce(p_submission -> 'ai_assistance_requested', 'false'::jsonb) = 'true'::jsonb,
    p_user_id::text, now(), now()
  )
  returning * into s;
  return to_jsonb(s);
end;
$$;

create or replace function public.merchant_profile_change_request_create(
  p_user_id     uuid,
  p_merchant_id uuid,
  p_changes     jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  r public.merchant_profile_change_requests;
begin
  if jsonb_typeof(p_changes) is distinct from 'object' or p_changes = '{}'::jsonb
     or exists (select 1 from jsonb_object_keys(p_changes) k where k not in ('name', 'address', 'slug', 'business_status'))
     or exists (select 1 from jsonb_each(p_changes) e where jsonb_typeof(e.value) <> 'string' or btrim(e.value #>> '{}') = '') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'invalid change request');
  end if;

  m := private.lock_merchant_for_actor('owner', p_user_id::text, p_merchant_id, true);

  insert into public.merchant_profile_change_requests (merchant_id, requested_by, changes)
  values (m.id, p_user_id, p_changes)
  returning * into r;
  return jsonb_build_object('id', r.id, 'changes', r.changes, 'status', r.status, 'admin_notes', r.admin_notes, 'created_at', r.created_at);
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Idempotency clean-up (bounded; scheduling is a separate, approved operation)
-- ---------------------------------------------------------------------
create or replace function public.request_idempotency_purge_expired(p_limit int default 1000)
returns int
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  deleted int;
begin
  delete from public.request_idempotency
   where id in (
     select id from public.request_idempotency
      where expires_at < now()
      order by expires_at
      limit greatest(1, least(coalesce(p_limit, 1000), 10000)));
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- ---------------------------------------------------------------------
-- Grants: service_role only
-- ---------------------------------------------------------------------
revoke all on function private.merchant_write_error(text, text) from public, anon, authenticated;
revoke all on function private.is_valid_contact_phone(text) from public, anon, authenticated;
revoke all on function private.is_valid_contact_whatsapp(text) from public, anon, authenticated;
revoke all on function private.is_valid_contact_email(text) from public, anon, authenticated;
revoke all on function private.merchant_has_valid_contact(public.merchants) from public, anon, authenticated;
revoke all on function private.lock_merchant_for_actor(text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function private.merchant_field_registry() from public, anon, authenticated;
revoke all on function private.merchant_field_snapshot(public.merchants, text, text) from public, anon, authenticated;
revoke all on function public.merchant_field_patch(text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.merchant_field_snapshot_read(text, text, uuid) from public, anon, authenticated;
revoke all on function public.merchant_story_submission_create(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.merchant_profile_change_request_create(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.request_idempotency_purge_expired(int) from public, anon, authenticated;

grant execute on function private.merchant_write_error(text, text) to service_role;
grant execute on function private.is_valid_contact_phone(text) to service_role;
grant execute on function private.is_valid_contact_whatsapp(text) to service_role;
grant execute on function private.is_valid_contact_email(text) to service_role;
grant execute on function private.merchant_has_valid_contact(public.merchants) to service_role;
grant execute on function private.lock_merchant_for_actor(text, text, uuid, boolean) to service_role;
grant execute on function private.merchant_field_registry() to service_role;
grant execute on function private.merchant_field_snapshot(public.merchants, text, text) to service_role;
grant execute on function public.merchant_field_patch(text, text, uuid, uuid, jsonb) to service_role;
grant execute on function public.merchant_field_snapshot_read(text, text, uuid) to service_role;
grant execute on function public.merchant_story_submission_create(uuid, uuid, jsonb) to service_role;
grant execute on function public.merchant_profile_change_request_create(uuid, uuid, jsonb) to service_role;
grant execute on function public.request_idempotency_purge_expired(int) to service_role;

-- ---------------------------------------------------------------------
-- Self-checks
-- ---------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_field_patch(text,text,uuid,uuid,jsonb)',
    'public.merchant_field_snapshot_read(text,text,uuid)',
    'public.merchant_story_submission_create(uuid,uuid,jsonb)',
    'public.merchant_profile_change_request_create(uuid,uuid,jsonb)',
    'public.request_idempotency_purge_expired(integer)',
    'private.lock_merchant_for_actor(text,text,uuid,boolean)'
  ] loop
    if has_function_privilege('anon', fn, 'EXECUTE') or has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception 'D2-A self-check: % must not be executable by anon/authenticated', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'D2-A self-check: % must be executable by service_role', fn;
    end if;
    if exists (select 1 from pg_proc where oid = fn::regprocedure and (prosecdef or not coalesce(proconfig, '{}') @> array['search_path=""'])) then
      raise exception 'D2-A self-check: % must be SECURITY INVOKER with an empty search_path', fn;
    end if;
  end loop;
  if (select count(*) from pg_proc where proname in ('merchant_field_patch', 'merchant_story_submission_create', 'merchant_profile_change_request_create')) <> 3 then
    raise exception 'D2-A self-check: unexpected overloads of the write RPCs';
  end if;
  if has_table_privilege('anon', 'public.request_idempotency', 'SELECT') or has_table_privilege('authenticated', 'public.request_idempotency', 'SELECT')
     or has_table_privilege('anon', 'public.request_idempotency', 'INSERT') or has_table_privilege('authenticated', 'public.request_idempotency', 'INSERT') then
    raise exception 'D2-A self-check: request_idempotency must be private';
  end if;
end $$;

commit;
