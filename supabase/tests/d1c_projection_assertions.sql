-- =====================================================================
-- D1c Story projection ASSERTIONS — read-only catalog checks (no writes,
-- no role switching). Safe on local, staging and production after
-- migration 20260926112649_article_public_projection.sql.
-- Returns 'ALL D1C PROJECTION ASSERTIONS PASSED' or raises naming what is wrong.
-- =====================================================================
do $$
declare
  -- Keep identical to PUBLIC_ARTICLE_COLUMNS in lib/public-article-projection.mjs.
  public_columns text[] := array[
    'id', 'slug', 'title', 'excerpt', 'content', 'cover_image', 'category', 'tags',
    'merchant_slug', 'author', 'background_style', 'published_at', 'end_at',
    'created_at', 'updated_at'
  ];
  private_columns text[] := array[
    'published', 'view_count', 'editorial_status', 'rights_declared', 'review_notes',
    'submitted_at', 'reviewed_at', 'reviewed_by', 'generated_copy', 'generated_copy_at'
  ];
  r text; c text; t text; bad text := '';
  granted text[];
  fn record;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.articles', 'SELECT') then
      bad := bad || format(' [%s has table-wide SELECT on articles]', r);
    end if;
    select coalesce(array_agg(a.attname::text order by a.attname), '{}') into granted
      from pg_attribute a
     where a.attrelid = 'public.articles'::regclass and a.attnum > 0 and not a.attisdropped
       and has_column_privilege(r, 'public.articles', a.attname, 'SELECT');
    if granted <> (select array_agg(x order by x) from unnest(public_columns) x) then
      bad := bad || format(' [%s readable articles columns differ: %s]', r, granted);
    end if;
    foreach c in array private_columns loop
      if has_column_privilege(r, 'public.articles', c, 'SELECT') then
        bad := bad || format(' [%s can read private column articles.%s]', r, c);
      end if;
    end loop;
    foreach t in array array['INSERT', 'UPDATE'] loop
      if has_any_column_privilege(r, 'public.articles', t) then
        bad := bad || format(' [%s can %s articles]', r, t);
      end if;
    end loop;
    if has_table_privilege(r, 'public.articles', 'DELETE') then
      bad := bad || format(' [%s can DELETE articles]', r);
    end if;
    if not has_function_privilege(r, 'private.article_is_public(public.articles)', 'EXECUTE') then
      bad := bad || format(' [%s cannot evaluate the Story predicate used by RLS]', r);
    end if;
  end loop;

  -- Every column is classified, so a new public column cannot slip in unreviewed.
  select string_agg(a.attname, ', ') into t
    from pg_attribute a
   where a.attrelid = 'public.articles'::regclass and a.attnum > 0 and not a.attisdropped
     and not (a.attname::text = any (public_columns || private_columns));
  if t is not null then
    bad := bad || format(' [unclassified articles columns (private by default, add them to a list): %s]', t);
  end if;

  select p.prosecdef, p.proconfig, has_function_privilege('public', p.oid, 'EXECUTE') as public_exec
    into fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'article_is_public';
  if fn is null then
    bad := bad || ' [private.article_is_public missing]';
  else
    if fn.prosecdef then bad := bad || ' [article_is_public must be SECURITY INVOKER]'; end if;
    if fn.proconfig is null or not ('search_path=""' = any (fn.proconfig)) then
      bad := bad || ' [article_is_public must pin an empty search_path]';
    end if;
    if fn.public_exec then bad := bad || ' [PUBLIC can execute article_is_public]'; end if;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'articles' and policyname = 'pub_read_articles'
       and cmd = 'SELECT' and qual like '%private.article_is_public%'
  ) then
    bad := bad || ' [pub_read_articles does not use private.article_is_public]';
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'articles' and cmd in ('SELECT', 'ALL')
       and policyname <> 'pub_read_articles'
       and roles && array['anon', 'authenticated', 'public']::name[]
  ) then
    bad := bad || ' [another public read policy on articles bypasses the predicate]';
  end if;

  if bad <> '' then raise exception 'D1C PROJECTION ASSERTIONS FAILED:%', bad; end if;
end $$;
select 'ALL D1C PROJECTION ASSERTIONS PASSED' as result;
