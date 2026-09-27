-- =====================================================================
-- M6b: trusted profile images (logo / cover) for Owner and Admin.
-- =====================================================================
-- D2-B closed logo/cover changes because a URL string proves nothing about the object behind it.
-- This adds a ticketed flow in which the server, not the browser, decides every object path and
-- vouches for the file before it is shown on a restaurant:
--
-- 1. public.merchant_media_ticket(): after the same authorization and state checks as a field save
--    (private.lock_merchant_for_actor, write), records an upload ticket for one restaurant + slot
--    with a server-chosen object path (valid 1 hour). At most 20 tickets per restaurant per hour.
-- 2. The browser uploads the file to that path with a signed upload URL (public bucket
--    merchant-media: 5 MB, JPEG/PNG/WebP, only service_role writes).
-- 3. The server downloads the object and checks its size and real type (magic bytes), then calls
--    public.merchant_media_bind(), which ties the ticket to the restaurant's logo_image /
--    cover_image under lock with compare-and-set on the value the editor saw, audit and 7-day
--    request-id replay. A ticket binds once. Remove = bind with no ticket (sets the slot to null).
-- 4. public.merchant_media_read(): current logo/cover for the Owner or Admin editor.
--
-- Objects are never deleted here (no orphan clean-up); existing image URLs are unchanged.
-- Local first; staging and production each need CH approval, after 20260927095000.
-- Rollback: supabase/rollback/20260927100000_merchant_profile_media.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.merchant_media_uploads (
  id           uuid        primary key default gen_random_uuid(),
  merchant_id  uuid        not null references public.merchants(id) on delete cascade,
  slot         text        not null,
  bucket       text        not null,
  path         text        not null,
  content_type text        not null,
  actor_type   text        not null,
  actor_id     text        not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  bound_at     timestamptz,
  public_url   text,
  constraint merchant_media_uploads_slot_check check (slot in ('logo', 'cover')),
  constraint merchant_media_uploads_bucket_check check (bucket = 'merchant-media'),
  constraint merchant_media_uploads_type_check check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint merchant_media_uploads_actor_check check (actor_type in ('owner', 'admin')),
  constraint merchant_media_uploads_path_key unique (path)
);
create index merchant_media_uploads_merchant_idx on public.merchant_media_uploads (merchant_id, created_at);

alter table public.merchant_media_uploads enable row level security;
revoke all on table public.merchant_media_uploads from public, anon, authenticated, service_role;
grant select, insert, update on table public.merchant_media_uploads to service_role;

comment on table public.merchant_media_uploads is
  'Upload tickets for restaurant logo/cover images (M6b). Private: no anon/authenticated privileges, RLS on, no policies. A ticket binds to its restaurant slot once, after the server checked the stored object.';

create or replace function public.merchant_media_ticket(
  p_actor_type   text,
  p_actor_id     text,
  p_merchant_id  uuid,
  p_slot         text,
  p_path         text,
  p_content_type text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  v_id uuid;
  v_expires timestamptz := now() + interval '1 hour';
begin
  if p_slot is null or p_slot not in ('logo', 'cover') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unknown image slot');
  end if;
  if p_content_type is null or p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unsupported image type');
  end if;
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  if p_path is null or p_path !~ ('^profile/' || m.id::text || '/(logo|cover)/[0-9a-f-]{36}\.(jpg|png|webp)$')
     or split_part(p_path, '/', 3) <> p_slot then
    perform private.merchant_write_error('VALIDATION_FAILED', 'invalid object path');
  end if;
  if (select count(*) from public.merchant_media_uploads u
       where u.merchant_id = m.id and u.created_at > now() - interval '1 hour') >= 20 then
    perform private.merchant_write_error('RATE_LIMITED');
  end if;
  insert into public.merchant_media_uploads (merchant_id, slot, bucket, path, content_type, actor_type, actor_id, expires_at)
  values (m.id, p_slot, 'merchant-media', p_path, p_content_type, p_actor_type, p_actor_id, v_expires)
  returning id into v_id;
  return jsonb_build_object('uploadId', v_id, 'bucket', 'merchant-media', 'path', p_path, 'expiresAt', v_expires);
end;
$$;

create or replace function public.merchant_media_bind(
  p_actor_type     text,
  p_actor_id       text,
  p_merchant_id    uuid,
  p_request_id     uuid,
  p_slot           text,
  p_upload_id      uuid,
  p_public_url     text,
  p_expected_value text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_operation constant text := 'merchant_media_bind';
  v_hash text;
  v_current text;
  v_new text;
  v_result jsonb;
  m public.merchants;
  up public.merchant_media_uploads;
  idem public.request_idempotency;
begin
  if p_slot is null or p_slot not in ('logo', 'cover') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unknown image slot');
  end if;
  if p_request_id is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required');
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'v', 1, 'op', v_operation, 'merchant', p_merchant_id, 'slot', p_slot, 'upload', p_upload_id,
    'expected', p_expected_value)::text, 'UTF8')), 'hex');

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

  if p_upload_id is not null then
    select * into up from public.merchant_media_uploads u
     where u.id = p_upload_id and u.merchant_id = m.id and u.slot = p_slot
       for update;
    if not found then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'upload');
    end if;
    if up.bound_at is not null then
      perform private.merchant_write_error('VALIDATION_FAILED', 'upload_used');
    end if;
    if up.expires_at <= now() then
      perform private.merchant_write_error('VALIDATION_FAILED', 'upload_expired');
    end if;
    if p_public_url is null or right(p_public_url, char_length('/' || up.bucket || '/' || up.path)) <> '/' || up.bucket || '/' || up.path then
      perform private.merchant_write_error('VALIDATION_FAILED', 'public url does not match the upload');
    end if;
    v_new := p_public_url;
  end if;

  v_current := case p_slot when 'logo' then m.logo_image else m.cover_image end;
  if v_current is distinct from p_expected_value then
    v_result := jsonb_build_object('status', 'conflict', 'slot', p_slot, 'current', v_current, 'revision', m.revision);
    insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
    values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'conflict', v_result, now() + interval '7 days');
    return v_result || jsonb_build_object('replayed', false);
  end if;
  if v_current is not distinct from v_new then
    v_result := jsonb_build_object('status', 'noop', 'slot', p_slot, 'value', v_current, 'revision', m.revision);
    insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
    values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'noop', v_result, now() + interval '7 days');
    return v_result || jsonb_build_object('replayed', false);
  end if;

  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_operation || ':' || p_slot, true);

  if p_slot = 'logo' then
    update public.merchants set logo_image = v_new where id = m.id returning * into m;
  else
    update public.merchants set cover_image = v_new where id = m.id returning * into m;
  end if;
  if p_upload_id is not null then
    update public.merchant_media_uploads set bound_at = now(), public_url = v_new where id = p_upload_id;
  end if;

  v_result := jsonb_build_object('status', 'applied', 'slot', p_slot, 'value', v_new, 'revision', m.revision);
  insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
  values (p_actor_type, p_actor_id, p_merchant_id, v_operation, p_request_id, v_hash, 'applied', v_result, now() + interval '7 days');
  return v_result || jsonb_build_object('replayed', false);
end;
$$;

create or replace function public.merchant_media_read(
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
  if not found then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND');
  end if;
  return jsonb_build_object('logo', m.logo_image, 'cover', m.cover_image, 'revision', m.revision);
end;
$$;

revoke all on function public.merchant_media_ticket(text, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.merchant_media_bind(text, text, uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.merchant_media_read(text, text, uuid) from public, anon, authenticated;
grant execute on function public.merchant_media_ticket(text, text, uuid, text, text, text) to service_role;
grant execute on function public.merchant_media_bind(text, text, uuid, uuid, text, uuid, text, text) to service_role;
grant execute on function public.merchant_media_read(text, text, uuid) to service_role;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_media_ticket(text,text,uuid,text,text,text)',
    'public.merchant_media_bind(text,text,uuid,uuid,text,uuid,text,text)',
    'public.merchant_media_read(text,text,uuid)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'M6b self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.merchant_media_uploads', 'select') or has_table_privilege('authenticated', 'public.merchant_media_uploads', 'select') then
    raise exception 'M6b self-check: merchant_media_uploads must stay private';
  end if;
end $$;

commit;
