-- ROLLBACK of 20260927210000_owner_temporary_closure.sql - STAGING ONLY.
-- Roll back the application first. business_status values stay; closure notes are dropped.
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_owner_business_status_read(text, text, uuid);
drop function if exists public.merchant_owner_business_status(text, text, uuid, uuid, text, text, date);
drop table if exists public.merchant_closure_notices;
commit;
