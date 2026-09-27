-- ROLLBACK of 20260927150000_merchant_dish_media.sql - STAGING ONLY.
-- Roll back the application first (dish photo routes and the menu editor photo control).
-- Dish photos already set stay on their dishes; stored objects are not deleted. Dish upload
-- tickets are deleted (the slot constraint returns to logo/cover).
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_dish_media_bind(text,text,uuid,uuid,uuid,uuid,text,text);
drop function if exists public.merchant_dish_media_ticket(text,text,uuid,uuid,text,text);
delete from public.merchant_media_uploads where slot = 'dish';
alter table public.merchant_media_uploads drop constraint merchant_media_uploads_product_check;
alter table public.merchant_media_uploads drop constraint merchant_media_uploads_slot_check;
alter table public.merchant_media_uploads add constraint merchant_media_uploads_slot_check check (slot in ('logo', 'cover'));
drop index if exists public.merchant_media_uploads_product_idx;
alter table public.merchant_media_uploads drop column product_id;
-- Restore the M6b (20260927100000) logo/cover ticket, which counted every ticket of the restaurant.
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
revoke all on function public.merchant_media_ticket(text, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.merchant_media_ticket(text, text, uuid, text, text, text) to service_role;
commit;
