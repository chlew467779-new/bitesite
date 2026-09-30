-- =====================================================================
-- ROLLBACK of 20260930130000_menu_import.sql — STAGING ONLY.
-- =====================================================================
-- Drops the import function only; imported dishes stay (they are ordinary menu rows).
-- Roll the application back first (Admin menu editor "Import a menu from photos").
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.merchant_menu_import(text, text, uuid, jsonb);

commit;
