-- =====================================================================
-- Dish photos: the M6b trusted upload flow for products.image_url (Owner and Admin).
-- =====================================================================
-- Same pattern as logo/cover (20260927100000): the server picks the object path, the database
-- records a ticket after the usual lock checks, the browser uploads with a signed URL, the server
-- checks the stored bytes, then the database binds the ticket under compare-and-set.
--
-- 1. merchant_media_uploads gains slot 'dish' with product_id (required for dish, absent otherwise;
--    deleting the dish deletes its tickets).
-- 2. public.merchant_dish_media_ticket(actor, merchant, product, path, content_type): the dish must
--    belong to the restaurant (else RESOURCE_NOT_FOUND 'product'); path
--    dish/<merchant>/<product>/<uuid>.(jpg|png|webp); at most 60 dish tickets per restaurant per
--    hour (RATE_LIMITED).
-- 3. public.merchant_dish_media_bind(actor, merchant, request_id, product, upload | null,
--    public_url, expected): compare-and-set on products.image_url; a ticket binds once, to its own
--    dish; null upload removes the photo. Idempotent per request id (7 days).
-- 4. merchant_media_ticket (logo/cover) now counts only logo/cover tickets toward its 20 per hour,
--    so dish uploads never block profile photos.
-- Suspended/archived restaurants refuse Owner writes and pending review freezes edits (existing lock).
--
-- Local first; staging and production each need CH approval, after 20260927140000.
-- Rollback: supabase/rollback/20260927150000_merchant_dish_media.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

alter table public.merchant_media_uploads
  add column product_id uuid references public.products(id) on delete cascade;
alter table public.merchant_media_uploads drop constraint merchant_media_uploads_slot_check;
alter table public.merchant_media_uploads
  add constraint merchant_media_uploads_slot_check check (slot in ('logo', 'cover', 'dish')),
  add constraint merchant_media_uploads_product_check check ((slot = 'dish') = (product_id is not null));
create index merchant_media_uploads_product_idx on public.merchant_media_uploads (product_id) where product_id is not null;

-- Logo/cover rate limit counts logo/cover tickets only (otherwise identical to M6b).
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
       where u.merchant_id = m.id and u.slot in ('logo', 'cover') and u.created_at > now() - interval '1 hour') >= 20 then
    perform private.merchant_write_error('RATE_LIMITED');
  end if;
  insert into public.merchant_media_uploads (merchant_id, slot, bucket, path, content_type, actor_type, actor_id, expires_at)
  values (m.id, p_slot, 'merchant-media', p_path, p_content_type, p_actor_type, p_actor_id, v_expires)
  returning id into v_id;
  return jsonb_build_object('uploadId', v_id, 'bucket', 'merchant-media', 'path', p_path, 'expiresAt', v_expires);
end;
$$;

create or replace function public.merchant_dish_media_ticket(
  p_actor_type   text,
  p_actor_id     text,
  p_merchant_id  uuid,
  p_product_id   uuid,
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
  if p_content_type is null or p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unsupported image type');
  end if;
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  if p_product_id is null or not exists (select 1 from public.products p where p.id = p_product_id and p.merchant_id = m.id) then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'product');
  end if;
  if p_path is null or p_path !~ ('^dish/' || m.id::text || '/' || p_product_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'invalid object path');
  end if;
  if (select count(*) from public.merchant_media_uploads u
       where u.merchant_id = m.id and u.slot = 'dish' and u.created_at > now() - interval '1 hour') >= 60 then
    perform private.merchant_write_error('RATE_LIMITED');
  end if;
  insert into public.merchant_media_uploads (merchant_id, slot, product_id, bucket, path, content_type, actor_type, actor_id, expires_at)
  values (m.id, 'dish', p_product_id, 'merchant-media', p_path, p_content_type, p_actor_type, p_actor_id, v_expires)
  returning id into v_id;
  return jsonb_build_object('uploadId', v_id, 'bucket', 'merchant-media', 'path', p_path, 'expiresAt', v_expires);
end;
$$;

create or replace function public.merchant_dish_media_bind(
  p_actor_type     text,
  p_actor_id       text,
  p_merchant_id    uuid,
  p_request_id     uuid,
  p_product_id     uuid,
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
  v_op constant text := 'merchant_dish_media_bind';
  v_hash text;
  v_prev jsonb;
  v_new text;
  m public.merchants;
  prod public.products;
  up public.merchant_media_uploads;
begin
  if p_request_id is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required');
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'v', 1, 'op', v_op, 'merchant', p_merchant_id, 'product', p_product_id, 'upload', p_upload_id,
    'expected', p_expected_value)::text, 'UTF8')), 'hex');

  -- Merchant row first, then the dish, then the ticket.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  select * into prod from public.products p where p.id = p_product_id and p.merchant_id = m.id for update;
  if not found then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'product');
  end if;

  if p_upload_id is not null then
    select * into up from public.merchant_media_uploads u
     where u.id = p_upload_id and u.merchant_id = m.id and u.slot = 'dish' and u.product_id = prod.id
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

  if prod.image_url is distinct from p_expected_value then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'conflict',
      jsonb_build_object('status', 'conflict', 'productId', prod.id, 'current', prod.image_url));
  end if;
  if prod.image_url is not distinct from v_new then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'noop',
      jsonb_build_object('status', 'noop', 'productId', prod.id, 'value', prod.image_url));
  end if;

  update public.products set image_url = v_new where id = prod.id;
  if p_upload_id is not null then
    update public.merchant_media_uploads set bound_at = now(), public_url = v_new where id = p_upload_id;
  end if;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'productId', prod.id, 'value', v_new));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_media_ticket(text,text,uuid,text,text,text)',
    'public.merchant_dish_media_ticket(text,text,uuid,uuid,text,text)',
    'public.merchant_dish_media_bind(text,text,uuid,uuid,uuid,uuid,text,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'Dish media self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.merchant_media_uploads', 'select') or has_table_privilege('authenticated', 'public.merchant_media_uploads', 'select') then
    raise exception 'Dish media self-check: merchant_media_uploads must stay private';
  end if;
end $$;

commit;
