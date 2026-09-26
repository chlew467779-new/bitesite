-- =====================================================================
-- D1b public projection ASSERTIONS — read-only catalog checks (no writes,
-- no role switching). Safe on local, staging and production after
-- migration 20260926101050_merchant_public_projection.sql.
-- Returns 'ALL D1B PROJECTION ASSERTIONS PASSED' or raises naming what is wrong.
-- =====================================================================
do $$
declare
  -- Keep identical to PUBLIC_MERCHANT_COLUMNS in lib/public-merchant-projection.mjs.
  public_columns text[] := array[
    'id', 'slug', 'name', 'tagline', 'description',
    'cuisine_type', 'cuisine', 'amenities', 'occasion', 'tags', 'area',
    'address', 'latitude', 'longitude',
    'phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook',
    'cover_image', 'logo_image', 'operating_hours', 'dress_code', 'menu_pdf_url',
    'video_url', 'video_type', 'video_caption', 'payment_methods',
    'layout', 'features', 'status', 'business_status',
    'created_at', 'updated_at'
  ];
  private_columns text[] := array[
    'reviews', 'settings', 'reference_website', 'custom_style', 'style',
    'is_published', 'platform_status',
    'review_status', 'listing_visibility', 'platform_restriction', 'state_source',
    'revision', 'first_published_at'
  ];
  r text; c text; t text; bad text := '';
  granted text[];
  fn record;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.merchants', 'SELECT') then
      bad := bad || format(' [%s has table-wide SELECT on merchants]', r);
    end if;
    select coalesce(array_agg(a.attname::text order by a.attname), '{}') into granted
      from pg_attribute a
     where a.attrelid = 'public.merchants'::regclass and a.attnum > 0 and not a.attisdropped
       and has_column_privilege(r, 'public.merchants', a.attname, 'SELECT');
    if granted <> (select array_agg(x order by x) from unnest(public_columns) x) then
      bad := bad || format(' [%s readable merchants columns differ: %s]', r, granted);
    end if;
    foreach c in array private_columns loop
      if has_column_privilege(r, 'public.merchants', c, 'SELECT') then
        bad := bad || format(' [%s can read private column merchants.%s]', r, c);
      end if;
    end loop;
    if not has_function_privilege(r, 'private.merchant_id_is_public(uuid)', 'EXECUTE') then
      bad := bad || format(' [%s cannot evaluate the parent predicate used by child RLS]', r);
    end if;
  end loop;

  -- Every column is classified, so a new public column cannot slip in unreviewed.
  select string_agg(a.attname, ', ') into t
    from pg_attribute a
   where a.attrelid = 'public.merchants'::regclass and a.attnum > 0 and not a.attisdropped
     and not (a.attname::text = any (public_columns || private_columns));
  if t is not null then
    bad := bad || format(' [unclassified merchants columns (private by default, add them to a list): %s]', t);
  end if;

  select p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner,
         has_function_privilege('public', p.oid, 'EXECUTE') as public_exec
    into fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'merchant_id_is_public';
  if fn is null then
    bad := bad || ' [private.merchant_id_is_public missing]';
  else
    if not fn.prosecdef then bad := bad || ' [merchant_id_is_public must be SECURITY DEFINER]'; end if;
    if fn.proconfig is null or not ('search_path=""' = any (fn.proconfig)) then
      bad := bad || format(' [merchant_id_is_public must fix search_path, has %s]', fn.proconfig);
    end if;
    if fn.public_exec then bad := bad || ' [PUBLIC can execute merchant_id_is_public]'; end if;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('merchant_is_public', 'merchant_id_is_public')) then
    bad := bad || ' [a merchant predicate is in schema public and would be exposed as an RPC]';
  end if;

  foreach t in array array[
    'categories.pub_read_categories', 'products.pub_read_products',
    'merchant_videos.pub_read_merchant_videos',
    'merchant_external_links.merchant_external_links_public_read',
    'events.pub_read_events'
  ] loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = split_part(t, '.', 1) and policyname = split_part(t, '.', 2)
         and cmd = 'SELECT' and qual like '%private.merchant_id_is_public(merchant_id)%'
    ) then
      bad := bad || format(' [%s does not use merchant_id_is_public]', t);
    end if;
  end loop;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'merchants' and policyname = 'pub_read_merchants'
       and qual like '%private.merchant_is_public%'
  ) then
    bad := bad || ' [pub_read_merchants no longer uses the D1a predicate]';
  end if;

  if bad <> '' then raise exception 'D1B PROJECTION ASSERTIONS FAILED:%', bad; end if;
end $$;
select 'ALL D1B PROJECTION ASSERTIONS PASSED' as result;
