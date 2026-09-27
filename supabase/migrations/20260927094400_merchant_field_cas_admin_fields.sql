-- =====================================================================
-- FoodStraits B0 (D2-B prerequisite): Admin field paths for the D2-A save contract, plus two
-- D2-A adjustments from review (D2B_M1B_DECISIONS_AND_IMPLEMENTATION_20260927 §A4, §B1, §B4.6).
-- =====================================================================
-- Additive: replaces D2-A functions with `create or replace`; no table changes, no data changes.
--
-- 1. Admin-only paths: profile.name, presentation.layout (the five production layouts),
--    tags.cuisine / tags.amenities / tags.occasion (whole-array CAS), and `location`, one atomic
--    group of address, area, latitude, longitude (so address and coordinates never merge into a
--    mismatch). Owners still cannot write any of these. Slug, state, links, images and
--    payment_methods stay outside the contract.
-- 2. Admin ordinary edits of an ARCHIVED restaurant are refused (Owner already was); restoring
--    or maintaining archives is a separate governance contract.
-- 3. A no-op save now returns the confirmed snapshot of every requested path, like an applied one.
-- 4. The audit trigger names the new paths (profile.name, presentation.layout, tags.*,
--    location.<column>).
--
-- Local first; staging and production each need CH approval, after 20260927030741.
-- Rollback: supabase/rollback/20260927094400_merchant_field_cas_admin_fields.rollback.STAGING_ONLY.sql
-- =====================================================================

begin;

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
  profile_columns constant text[] := array['name', 'tagline', 'description', 'phone', 'whatsapp', 'email'];
  tag_columns constant text[] := array['cuisine', 'amenities', 'occasion'];
  location_columns constant text[] := array['address', 'area', 'latitude', 'longitude'];
  logical text;
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
      logical := case
        when k = any (profile_columns) then 'profile.' || k
        when k = 'layout' then 'presentation.layout'
        when k = any (tag_columns) then 'tags.' || k
        when k = any (location_columns) then 'location.' || k
      end;
      if logical is not null then
        paths := paths || logical;
        before_values := before_values || jsonb_build_object(logical, old_json -> k);
        after_values := after_values || jsonb_build_object(logical, new_json -> k);
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
      if m.platform_restriction = 'archived' or m.platform_status = 'ARCHIVED' then
        perform private.merchant_write_error('OPERATION_FORBIDDEN', 'archived');
      end if;
    end if;
    -- Restaurant review pending (not Story or link review): managed rows by review_status,
    -- legacy rows by their still-authoritative platform_status.
    -- Archived restaurants are read-only for ordinary edits by everyone (B0).
    if p_actor_type = 'admin' and (m.platform_restriction = 'archived' or m.platform_status = 'ARCHIVED') then
      perform private.merchant_write_error('OPERATION_FORBIDDEN', 'archived');
    end if;
    if (m.state_source = 'managed' and m.review_status = 'pending')
       or (m.state_source = 'legacy' and m.platform_status = 'PENDING_REVIEW') then
      perform private.merchant_write_error('OPERATION_FORBIDDEN', 'pending_review');
    end if;
  end if;
  return m;
end;
$$;

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
    ('features.reviews',        'feature', 'reviews',        false, false, null),
    -- B0: Admin-only paths. For tag_array, max_length is the maximum number of tags.
    ('profile.name',         'text',      'name',      false, true, 160),
    ('presentation.layout',  'layout',    'layout',    false, true, 32),
    ('tags.cuisine',         'tag_array', 'cuisine',   false, true, 3),
    ('tags.amenities',       'tag_array', 'amenities', false, true, 5),
    ('tags.occasion',        'tag_array', 'occasion',  false, true, 3),
    ('location',             'location',  'location',  false, true, null)
$$;

-- Production-ready layouts (lib/layout-registry.mjs isPersistableLayout; DEC-23).
create or replace function private.merchant_persistable_layouts()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['classic', 'elegant', 'minimal', 'modern', 'rustic']
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
  if p_kind in ('text', 'layout', 'tag_array') then
    return jsonb_build_object('exists', true, 'value', row_json -> p_target);
  end if;
  if p_kind = 'location' then
    return jsonb_build_object('exists', true, 'value', jsonb_build_object(
      'address', row_json -> 'address', 'area', row_json -> 'area',
      'latitude', row_json -> 'latitude', 'longitude', row_json -> 'longitude'));
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
      if reg.path = 'profile.name' and jsonb_typeof(desired) = 'null' then
        perform private.merchant_write_error('VALIDATION_FAILED', 'profile.name cannot be cleared');
      end if;
    elsif reg.kind = 'feature' and jsonb_typeof(desired) is distinct from 'boolean' then
      perform private.merchant_write_error('VALIDATION_FAILED', reg.path || ' must be true or false');
    elsif reg.kind = 'layout'
          and (jsonb_typeof(desired) is distinct from 'string' or not ((desired #>> '{}') = any (private.merchant_persistable_layouts()))) then
      perform private.merchant_write_error('VALIDATION_FAILED', 'presentation.layout must be a production layout');
    elsif reg.kind = 'tag_array' then
      if jsonb_typeof(desired) is distinct from 'array' then
        perform private.merchant_write_error('VALIDATION_FAILED', reg.path || ' must be an array of tags');
      end if;
      if exists (select 1 from jsonb_array_elements(desired) e where jsonb_typeof(e) <> 'string')
         or exists (select 1 from jsonb_array_elements_text(desired) t where btrim(t) = '' or char_length(t) > 64)
         or jsonb_array_length(desired) > reg.max_length
         or (select count(distinct e #>> '{}') from jsonb_array_elements(desired) e) <> jsonb_array_length(desired) then
        perform private.merchant_write_error('VALIDATION_FAILED', reg.path || ' must be up to ' || reg.max_length || ' distinct tags');
      end if;
    elsif reg.kind = 'location' then
      if jsonb_typeof(desired) is distinct from 'object'
         or (select count(*) from jsonb_object_keys(desired)) <> 4
         or not (desired ? 'address' and desired ? 'area' and desired ? 'latitude' and desired ? 'longitude') then
        perform private.merchant_write_error('VALIDATION_FAILED', 'location has exactly address, area, latitude and longitude');
      end if;
      if (jsonb_typeof(desired -> 'address') not in ('null', 'string'))
         or (jsonb_typeof(desired -> 'address') = 'string' and (btrim(desired ->> 'address') = '' or char_length(desired ->> 'address') > 500))
         or (jsonb_typeof(desired -> 'area') not in ('null', 'string'))
         or (jsonb_typeof(desired -> 'area') = 'string' and (btrim(desired ->> 'area') = '' or char_length(desired ->> 'area') > 160)) then
        perform private.merchant_write_error('VALIDATION_FAILED', 'location address/area must be non-empty text or null');
      end if;
      if (jsonb_typeof(desired -> 'latitude') = 'null') <> (jsonb_typeof(desired -> 'longitude') = 'null') then
        perform private.merchant_write_error('VALIDATION_FAILED', 'latitude and longitude are set or cleared together');
      end if;
      if jsonb_typeof(desired -> 'latitude') <> 'null' then
        if jsonb_typeof(desired -> 'latitude') <> 'number' or jsonb_typeof(desired -> 'longitude') <> 'number' then
          perform private.merchant_write_error('VALIDATION_FAILED', 'latitude and longitude must be numbers');
        end if;
        if (desired ->> 'latitude')::numeric not between -90 and 90 or (desired ->> 'longitude')::numeric not between -180 and 180 then
          perform private.merchant_write_error('VALIDATION_FAILED', 'latitude must be -90..90 and longitude -180..180');
        end if;
      end if;
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
        when 'name' then cand.name := desired #>> '{}';
      end case;
    elsif reg.kind = 'hours' then
      hours_obj := case when jsonb_typeof(desired) = 'null' then hours_obj - reg.target else jsonb_set(hours_obj, array[reg.target], desired, true) end;
    elsif reg.kind = 'feature' then
      features_obj := jsonb_set(features_obj, array[reg.target], desired, true);
    elsif reg.kind = 'layout' then
      cand.layout := desired #>> '{}';
    elsif reg.kind = 'tag_array' then
      case reg.target
        when 'cuisine' then cand.cuisine := array(select jsonb_array_elements_text(desired));
        when 'amenities' then cand.amenities := array(select jsonb_array_elements_text(desired));
        when 'occasion' then cand.occasion := array(select jsonb_array_elements_text(desired));
      end case;
    elsif reg.kind = 'location' then
      cand.address := desired ->> 'address';
      cand.area := desired ->> 'area';
      cand.latitude := (desired ->> 'latitude')::double precision;
      cand.longitude := (desired ->> 'longitude')::double precision;
    end if;
  end loop;

  if cardinality(changed_paths) = 0 then
    -- A no-op still confirms the current value of every requested path.
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
         features = cand.features,
         name = cand.name,
         layout = cand.layout,
         cuisine = cand.cuisine,
         amenities = cand.amenities,
         occasion = cand.occasion,
         address = cand.address,
         area = cand.area,
         latitude = cand.latitude,
         longitude = cand.longitude
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

revoke all on function private.merchants_after_write_audit() from public, anon, authenticated, service_role;
revoke all on function private.merchant_persistable_layouts() from public, anon, authenticated;
grant execute on function private.merchant_persistable_layouts() to service_role;

-- Self-check: grants unchanged by the replacements, registry shape as reviewed.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_field_patch(text,text,uuid,uuid,jsonb)',
    'public.merchant_field_snapshot_read(text,text,uuid)',
    'private.lock_merchant_for_actor(text,text,uuid,boolean)',
    'private.merchant_field_registry()',
    'private.merchant_field_snapshot(public.merchants,text,text)',
    'private.merchant_persistable_layouts()'
  ] loop
    if has_function_privilege('anon', fn, 'EXECUTE') or has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'B0 self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
  if exists (select 1 from private.merchant_field_registry() where kind in ('layout', 'tag_array', 'location') and owner_writable)
     or exists (select 1 from private.merchant_field_registry() where path = 'profile.name' and owner_writable) then
    raise exception 'B0 self-check: Admin-only paths must not be Owner-writable';
  end if;
end $$;

commit;
