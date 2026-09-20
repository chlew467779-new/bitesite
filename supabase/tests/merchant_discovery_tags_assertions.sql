-- Read-only assertions for the Merchant discovery-tag schema migration.
do $$
declare
  bad text := '';
  rls_enabled boolean;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'merchants'
      and column_name = 'cuisine'
      and udt_name = '_text'
      and is_nullable = 'NO'
  ) then bad := bad || ' [cuisine column missing or invalid]'; end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'merchants'
      and column_name = 'amenities'
      and udt_name = '_text'
      and is_nullable = 'NO'
  ) then bad := bad || ' [amenities column missing or invalid]'; end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'merchants'
      and column_name = 'occasion'
      and udt_name = '_text'
      and is_nullable = 'NO'
  ) then bad := bad || ' [occasion column missing or invalid]'; end if;

  if to_regclass('public.idx_merchants_cuisine') is null then
    bad := bad || ' [cuisine GIN index missing]';
  end if;
  if to_regclass('public.idx_merchants_amenities') is null then
    bad := bad || ' [amenities GIN index missing]';
  end if;
  if to_regclass('public.idx_merchants_occasion') is null then
    bad := bad || ' [occasion GIN index missing]';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.merchants'::regclass
      and conname = 'merchants_cuisine_max_items'
  ) then bad := bad || ' [cuisine constraint missing]'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.merchants'::regclass
      and conname = 'merchants_amenities_max_items'
  ) then bad := bad || ' [amenities constraint missing]'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.merchants'::regclass
      and conname = 'merchants_occasion_max_items'
  ) then bad := bad || ' [occasion constraint missing]'; end if;

  if exists (
    select 1 from public.merchants
    where cardinality(cuisine) > 3
       or cardinality(amenities) > 5
       or cardinality(occasion) > 3
       or array_position(cuisine, null) is not null
       or array_position(amenities, null) is not null
       or array_position(occasion, null) is not null
  ) then bad := bad || ' [new tag data violates constraints]'; end if;

  select c.relrowsecurity into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'merchants';

  if not coalesce(rls_enabled, false) then
    bad := bad || ' [merchants RLS disabled]';
  end if;

  if bad <> '' then
    raise exception 'MERCHANT DISCOVERY TAG ASSERTIONS FAILED:%', bad;
  end if;
end $$;

select 'ALL MERCHANT DISCOVERY TAG ASSERTIONS PASSED' as result;
