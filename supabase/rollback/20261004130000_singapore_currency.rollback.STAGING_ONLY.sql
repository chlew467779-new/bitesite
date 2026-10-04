-- =====================================================================
-- ROLLBACK of 20261004130000_singapore_currency.sql - STAGING ONLY.
-- =====================================================================
-- Roll the APP back first: the app reads merchants.currency on public pages and breaks without it.
-- Drops the currency column (Singapore restaurants show RM again) and removes the Singapore areas
-- (restaurants using one keep their area text until edited; the area check then refuses it).
-- =====================================================================
begin;
do $$ begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_currency_set(text, text, uuid, text);
alter table public.merchants drop column if exists currency;
delete from public.areas where country = 'SG';
commit;
