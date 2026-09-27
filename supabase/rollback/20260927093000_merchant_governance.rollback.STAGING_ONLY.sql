-- =====================================================================
-- ROLLBACK of 20260927093000_merchant_governance.sql (D2-C) — STAGING ONLY.
-- =====================================================================
-- Drops the governance functions. Restaurant states they set, audit rows and idempotency rows
-- are kept. Roll the application back first (the Admin status panel calls these RPCs).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.merchant_business_status_set(text, text, uuid, uuid, text, text);
drop function if exists public.merchant_governance_apply(text, text, uuid, uuid, text, text);
drop function if exists public.merchant_governance_read(text, text, uuid);
drop function if exists private.merchant_governance_state(public.merchants);
drop function if exists private.merchant_governance_check(public.merchants, text);
drop function if exists private.merchant_governance_restriction(public.merchants);

commit;
