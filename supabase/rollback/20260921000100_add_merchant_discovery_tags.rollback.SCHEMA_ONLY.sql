-- Removes only the additive PR-A schema. Legacy cuisine_type/tags values are
-- untouched by PR-A. Refuse to run after any replacement taxonomy data has
-- been entered, preventing accidental deletion of new tags.
begin;

do $$
begin
  if exists (
    select 1 from public.merchants
    where cardinality(coalesce(cuisine, '{}'::text[])) > 0
       or cardinality(coalesce(amenities, '{}'::text[])) > 0
       or cardinality(coalesce(occasion, '{}'::text[])) > 0
  ) then
    raise exception 'REFUSED: new Merchant discovery-tag data exists; use a code revert and keep the columns';
  end if;
end $$;

drop index if exists public.idx_merchants_cuisine;
drop index if exists public.idx_merchants_amenities;
drop index if exists public.idx_merchants_occasion;

alter table public.merchants
  drop column if exists cuisine,
  drop column if exists amenities,
  drop column if exists occasion;

commit;
