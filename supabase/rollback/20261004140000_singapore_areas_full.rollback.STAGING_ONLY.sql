-- =====================================================================
-- ROLLBACK of 20261004140000_singapore_areas_full.sql - STAGING ONLY.
-- =====================================================================
-- Removes the 34 planning areas added there and Geylang's "Aljunied" alias; the 21 areas of
-- 20261004130000 stay. Restaurants already using a removed area keep the text until edited.
-- =====================================================================
begin;
do $$ begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
delete from public.areas where country = 'SG' and name in (
  'Boon Lay', 'Bukit Batok', 'Bukit Merah', 'Bukit Panjang', 'Bukit Timah', 'Changi', 'Choa Chu Kang',
  'Clementi', 'Downtown Core', 'Hougang', 'Jurong West', 'Kallang', 'Mandai', 'Marina South',
  'Marine Parade', 'Museum', 'Newton', 'Outram', 'Pasir Ris', 'Paya Lebar', 'Pioneer', 'Queenstown',
  'River Valley', 'Rochor', 'Seletar', 'Sembawang', 'Sengkang', 'Singapore River', 'Southern Islands',
  'Sungei Kadut', 'Tanglin', 'Tengah', 'Tuas', 'Yishun');
update public.areas set aliases = array_remove(aliases, 'Aljunied') where country = 'SG' and name = 'Geylang';
commit;
