-- ROLLBACK of 20260927190000_notification_delivery.sql - STAGING ONLY.
-- Roll back the application first (delivery route). Outbox rows stay; delivery bookkeeping is dropped.
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_notification_finish(uuid, boolean, text);
drop function if exists public.merchant_notification_claim(integer);
alter table public.merchant_notifications
  drop constraint if exists merchant_notifications_error_check,
  drop constraint if exists merchant_notifications_attempts_check,
  drop column if exists claimed_until,
  drop column if exists last_error,
  drop column if exists attempts;
commit;
