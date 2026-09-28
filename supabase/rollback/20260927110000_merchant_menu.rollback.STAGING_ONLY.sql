-- =====================================================================
-- ROLLBACK of 20260927110000_merchant_menu.sql (M3a) — STAGING ONLY.
-- =====================================================================
-- Drops the Owner menu RPCs and helpers. Categories and dishes are kept. Roll the application
-- back first (the Merchant menu manager calls these RPCs).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.merchant_menu_apply(text, text, uuid, uuid, jsonb);
drop function if exists public.merchant_menu_read(text, text, uuid);
drop function if exists private.merchant_menu_snapshot(uuid);
drop function if exists private.merchant_menu_has_minimum(uuid);
drop function if exists private.merchant_menu_text(jsonb, text, int, boolean);
drop function if exists private.merchant_menu_price(jsonb, text);
drop function if exists private.merchant_menu_bool(jsonb, text, boolean);
drop function if exists private.merchant_menu_ids(jsonb);
drop function if exists private.merchant_menu_uuid(jsonb, text);

commit;
