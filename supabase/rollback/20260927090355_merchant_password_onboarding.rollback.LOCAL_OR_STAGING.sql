-- Local/staging schema rollback only. Does not delete any created restaurant or account.
-- Remove the application package first. Cooldown counters/retry records are discarded.
begin;
drop function public.merchant_restaurant_create(uuid,text,uuid);
drop function private.lock_confirmed_onboarding_user(uuid);
drop function public.merchant_password_attempt_begin(text);
drop function public.merchant_password_attempt_finish(text,uuid,text);
drop table private.merchant_onboarding_requests;
drop table private.merchant_password_sources;
commit;
