-- =====================================================================
-- Singapore full area list: checks. Local, staging or production (read-only checks in a
-- transaction that is rolled back). Needs 20261004140000_singapore_areas_full.
-- =====================================================================
begin;
do $$
declare
  dup text;
begin
  if (select count(*) from public.areas where country = 'SG' and state = 'Singapore') < 55 then
    raise exception 'SG AREAS TEST FAILED: fewer than 55 Singapore areas';
  end if;
  -- Every name and alias points to exactly one area (case-insensitive), across both countries.
  select k into dup from (
    select lower(name) k from public.areas
    union all
    select lower(x) from public.areas, unnest(aliases) x
  ) t group by k having count(*) > 1 limit 1;
  if dup is not null then raise exception 'SG AREAS TEST FAILED: "%" is listed twice', dup; end if;
  if private.area_canonical('Chinatown') <> 'Chinatown' then raise exception 'SG AREAS TEST FAILED: KL Chinatown changed'; end if;
  if private.area_canonical('raffles place') <> 'Downtown Core' then raise exception 'SG AREAS TEST FAILED: alias'; end if;
  if private.area_canonical('sentosa') <> 'Southern Islands' then raise exception 'SG AREAS TEST FAILED: Sentosa'; end if;
  if exists (select 1 from public.areas where name in ('Central Water Catchment', 'Western Water Catchment', 'Changi Bay', 'Straits View')) then
    raise exception 'SG AREAS TEST FAILED: uninhabited planning area listed';
  end if;
end $$;
select 'ALL SINGAPORE AREA CHECKS PASSED (transaction rolled back, nothing persisted)' as result;
rollback;
