-- =====================================================================
-- Singapore part 2 (#24): the full area list, from ChatGPT G20 (URA Master Plan planning areas).
-- =====================================================================
-- 20261004130000 added 21 common neighbourhood names. This adds the URA planning areas that
-- restaurants can be in (34 more), so every Singapore address has an area to pick:
--   - names already listed (Ang Mo Kio, Bedok, Orchard, ...) are skipped;
--   - areas where nobody runs a restaurant are left out: Central / Western Water Catchment,
--     Changi Bay, Marina East, Straits View, Simpang, Lim Chu Kang, North-Eastern Islands,
--     Western Islands (Jurong Island);
--   - an alias is dropped when it is already a listed name or alias anywhere (for example
--     "Chinatown" is Kuala Lumpur's, "Tiong Bahru", "Katong", "Little India" are listed SG
--     names), so typed text always finds exactly one area.
-- Geylang (already listed) gains the alias "Aljunied". Admin can still edit everything in Areas.
-- Existing restaurants are unchanged. Re-running is harmless.
-- Rollback: supabase/rollback/20261004140000_singapore_areas_full.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

do $$
declare
  r record;
  v_aliases text[];
begin
  for r in
    select * from (values
      ('Boon Lay',         '{}'::text[]),
      ('Bukit Batok',      '{}'),
      ('Bukit Merah',      '{"Redhill","Tiong Bahru"}'),
      ('Bukit Panjang',    '{}'),
      ('Bukit Timah',      '{}'),
      ('Changi',           '{"Changi Village"}'),
      ('Choa Chu Kang',    '{"CCK"}'),
      ('Clementi',         '{}'),
      ('Downtown Core',    '{"Raffles Place","City Hall","Bugis","Tanjong Pagar"}'),
      ('Hougang',          '{}'),
      ('Jurong West',      '{}'),
      ('Kallang',          '{"Lavender"}'),
      ('Mandai',           '{}'),
      ('Marina South',     '{}'),
      ('Marine Parade',    '{"Katong","Joo Chiat"}'),
      ('Museum',           '{"Bras Basah"}'),
      ('Newton',           '{}'),
      ('Outram',           '{"Chinatown"}'),
      ('Pasir Ris',        '{}'),
      ('Paya Lebar',       '{}'),
      ('Pioneer',          '{}'),
      ('Queenstown',       '{"Holland Village","Holland V","one-north"}'),
      ('River Valley',     '{}'),
      ('Rochor',           '{"Little India"}'),
      ('Seletar',          '{}'),
      ('Sembawang',        '{}'),
      ('Sengkang',         '{}'),
      ('Singapore River',  '{"Clarke Quay","Boat Quay"}'),
      ('Southern Islands', '{"Sentosa"}'),
      ('Sungei Kadut',     '{}'),
      ('Tanglin',          '{"Dempsey Hill"}'),
      ('Tengah',           '{}'),
      ('Tuas',             '{}'),
      ('Yishun',           '{}')
    ) as t(name, aliases)
  loop
    continue when exists (select 1 from public.areas where lower(name) = lower(r.name));
    select coalesce(array_agg(x), '{}') into v_aliases
      from unnest(r.aliases) x
     where not exists (select 1 from public.areas a
                        where lower(a.name) = lower(x)
                           or lower(x) in (select lower(y) from unnest(a.aliases) y));
    insert into public.areas (country, state, name, aliases) values ('SG', 'Singapore', r.name, v_aliases);
  end loop;

  update public.areas set aliases = aliases || '{Aljunied}'::text[]
   where country = 'SG' and name = 'Geylang' and not ('Aljunied' = any(aliases))
     and not exists (select 1 from public.areas a where lower(a.name) = 'aljunied'
                        or 'aljunied' in (select lower(y) from unnest(a.aliases) y));

  if (select count(*) from public.areas where country = 'SG') < 55 then
    raise exception 'Singapore areas self-check: expected at least 55 Singapore areas';
  end if;
end $$;

commit;
