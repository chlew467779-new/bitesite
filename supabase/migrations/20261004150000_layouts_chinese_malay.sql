-- =====================================================================
-- C3 (CH 2026-10-04 #C1): the database may store the Chinese and Malay page styles.
-- =====================================================================
-- private.merchant_persistable_layouts() (20260927094400) listed the five production layouts;
-- merchant_field_patch refuses any other presentation.layout value. This adds 'chinese' and
-- 'malay' so they can be saved once the app offers them.
--
-- The app still decides: lib/layout-registry.mjs keeps both productionReady: false until ChatGPT
-- G18 (simpler Chinese layout, Malay check) is merged, so Owners and Admin cannot pick them yet
-- and the app refuses them before they reach the database. Running this SQL early changes nothing
-- visible. CREATE OR REPLACE keeps the EXECUTE grants (service_role only).
-- Rollback: supabase/rollback/20261004150000_layouts_chinese_malay.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create or replace function private.merchant_persistable_layouts()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['classic', 'elegant', 'minimal', 'modern', 'rustic', 'chinese', 'malay']
$$;

do $$
begin
  if has_function_privilege('anon', 'private.merchant_persistable_layouts()', 'execute')
     or has_function_privilege('authenticated', 'private.merchant_persistable_layouts()', 'execute')
     or not has_function_privilege('service_role', 'private.merchant_persistable_layouts()', 'execute') then
    raise exception 'Layouts self-check: wrong EXECUTE grants';
  end if;
end $$;

commit;
