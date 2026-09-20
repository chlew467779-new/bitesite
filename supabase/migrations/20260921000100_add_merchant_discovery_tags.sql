begin;

-- Prepare three controlled discovery groups to replace the legacy
-- single-value/free-form taxonomy. The existing `features` JSONB column is
-- intentionally unchanged because it controls Merchant Page sections.
alter table public.merchants
  add column if not exists cuisine text[] not null default '{}'::text[],
  add column if not exists amenities text[] not null default '{}'::text[],
  add column if not exists occasion text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.merchants'::regclass
      and conname = 'merchants_cuisine_max_items'
  ) then
    alter table public.merchants
      add constraint merchants_cuisine_max_items
      check (cardinality(cuisine) <= 3 and array_position(cuisine, null) is null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.merchants'::regclass
      and conname = 'merchants_amenities_max_items'
  ) then
    alter table public.merchants
      add constraint merchants_amenities_max_items
      check (cardinality(amenities) <= 5 and array_position(amenities, null) is null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.merchants'::regclass
      and conname = 'merchants_occasion_max_items'
  ) then
    alter table public.merchants
      add constraint merchants_occasion_max_items
      check (cardinality(occasion) <= 3 and array_position(occasion, null) is null);
  end if;
end $$;

create index if not exists idx_merchants_cuisine
  on public.merchants using gin (cuisine);
create index if not exists idx_merchants_amenities
  on public.merchants using gin (amenities);
create index if not exists idx_merchants_occasion
  on public.merchants using gin (occasion);

comment on column public.merchants.cuisine is
  'Controlled cuisine discovery tags; maximum 3.';
comment on column public.merchants.amenities is
  'Controlled amenity and general merchant-supplied discovery tags; maximum 5.';
comment on column public.merchants.occasion is
  'Controlled venue and dining-occasion discovery tags; maximum 3.';

-- Legacy cuisine_type/tags values are intentionally untouched in PR-A.
-- They will be permanently cleared only after the PR-B Admin/API deployment
-- stops all legacy writes; clearing them here would let the old production
-- form repopulate stale values during the rollout window.

commit;
