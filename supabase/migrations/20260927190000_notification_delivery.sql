-- =====================================================================
-- Notification delivery: claim and finish outbox rows (public.merchant_notifications, M2-B).
-- =====================================================================
-- The server delivers outbox rows by email when a provider is configured (RESEND_API_KEY,
-- NOTIFY_FROM; ADMIN_NOTIFY_EMAIL for Admin rows). Nothing is claimed when no provider is set.
--
--   public.merchant_notification_claim(p_limit)   up to p_limit (1..50) undelivered rows whose lease
--       expired and that have fewer than 5 attempts, oldest first; FOR UPDATE SKIP LOCKED so two
--       workers never take the same row; lease 5 minutes; attempts + 1. Returns the row, restaurant
--       name/slug and the active Owner's user id (the server looks up the email with Auth).
--   public.merchant_notification_finish(p_id, p_ok, p_error)   ok -> delivered_at; otherwise
--       last_error (<= 500 chars) and the lease is released for a later attempt.
--
-- Local first; staging and production each need CH approval, after 20260927170000.
-- Rollback: supabase/rollback/20260927190000_notification_delivery.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

alter table public.merchant_notifications
  add column attempts      integer     not null default 0,
  add column last_error    text,
  add column claimed_until timestamptz,
  add constraint merchant_notifications_attempts_check check (attempts between 0 and 100),
  add constraint merchant_notifications_error_check check (last_error is null or char_length(last_error) <= 500);

create or replace function public.merchant_notification_claim(p_limit int)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  if p_limit is null or p_limit not between 1 and 50 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'limit must be 1..50');
  end if;
  with picked as (
    select n.id from public.merchant_notifications n
     where n.delivered_at is null and n.attempts < 5 and (n.claimed_until is null or n.claimed_until < now())
     order by n.created_at
     limit p_limit
     for update skip locked
  ), claimed as (
    update public.merchant_notifications n
       set claimed_until = now() + interval '5 minutes', attempts = n.attempts + 1
      from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'merchantId', c.merchant_id, 'audience', c.audience, 'kind', c.kind, 'message', c.message,
           'attempts', c.attempts, 'createdAt', c.created_at, 'merchantName', m.name, 'slug', m.slug,
           'ownerUserId', (select mm.user_id from public.merchant_memberships mm
                            where mm.merchant_id = c.merchant_id and mm.role = 'owner' and mm.status = 'active' limit 1))
           order by c.created_at), '[]'::jsonb)
    into v_items
    from claimed c join public.merchants m on m.id = c.merchant_id;
  return v_items;
end;
$$;

create or replace function public.merchant_notification_finish(p_id uuid, p_ok boolean, p_error text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if p_id is null or p_ok is null then perform private.merchant_write_error('VALIDATION_FAILED', 'id and result are required'); end if;
  if p_ok then
    update public.merchant_notifications set delivered_at = now(), claimed_until = null, last_error = null
     where id = p_id and delivered_at is null;
  else
    update public.merchant_notifications set claimed_until = null, last_error = left(coalesce(p_error, 'unknown error'), 500)
     where id = p_id and delivered_at is null;
  end if;
  return jsonb_build_object('status', case when found then 'applied' else 'noop' end);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array['public.merchant_notification_claim(integer)', 'public.merchant_notification_finish(uuid,boolean,text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'Notification delivery self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
end $$;

commit;
