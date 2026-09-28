-- =====================================================================
-- ROLLBACK of 20260928120000_merchant_owner_assign.sql — STAGING ONLY.
-- =====================================================================
-- Drops the RPC. Memberships and audit rows it wrote are kept. Roll the application back first
-- (/api/admin/merchant-memberships POST calls it).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.merchant_owner_assign(text, text, uuid, uuid);

commit;
