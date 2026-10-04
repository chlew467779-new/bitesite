-- =====================================================================
-- ROLLBACK of 20261004150000_layouts_chinese_malay.sql - STAGING ONLY.
-- =====================================================================
-- First set any restaurant using 'chinese' or 'malay' back to another layout (Admin), and roll the
-- app back to productionReady: false for both. Then this restores the five-layout list.
-- =====================================================================
begin;
do $$ begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
  if exists (select 1 from public.merchants where layout in ('chinese', 'malay')) then
    raise exception 'Some restaurants still use the Chinese or Malay layout; change them first.';
  end if;
end $$;
create or replace function private.merchant_persistable_layouts()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['classic', 'elegant', 'minimal', 'modern', 'rustic']
$$;
commit;
