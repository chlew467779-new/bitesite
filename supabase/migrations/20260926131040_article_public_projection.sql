-- =====================================================================
-- FoodStraits D1c: public projection of Stories (articles)
-- (master spec 2026-09-26 §7.4, §11; same pattern as D1b 20260926101050)
-- =====================================================================
-- One transaction with self-checks at the end: if any check fails, nothing
-- is changed. No article row is modified.
--
-- 1. anon / authenticated lose table-wide SELECT on articles and get SELECT
--    on an explicit list of public columns only. Review notes, reviewer,
--    review/submission times, rights declaration, AI draft copy, editorial
--    status, the published flag and view counts (DEC-29) become server-only.
--    Columns added later are private until a migration grants them.
-- 2. A Story is public when published = true AND editorial_status =
--    'published' (private.article_is_public), the rule the sitemap already
--    used. Before, the policy checked published only, so a Story whose linked
--    submission was later rejected or returned to draft by the Admin review
--    path (which updates editorial_status alone) stayed public. The number of
--    rows this hides is reported as a NOTICE; no row is changed.
--
-- Deploy order: the application code that stops using select("*") and the
-- published / editorial_status filters on public Story reads must be live
-- BEFORE this migration, otherwise public Story pages fail with
-- "permission denied".
--
-- Local first; staging and production only after CTO review and explicit
-- CH approval.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0) Report (not change) Stories whose two status fields disagree
-- ---------------------------------------------------------------------
do $$
declare
  hidden_now text;
begin
  select string_agg(format('%s (%s, editorial_status=%s)', id, slug, editorial_status), '; ' order by slug)
    into hidden_now
    from public.articles
   where published = true and editorial_status <> 'published';
  if hidden_now is not null then
    raise notice 'D1c: these published Stories are not editorially published and stop being public: %', hidden_now;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) The single public Story predicate
-- ---------------------------------------------------------------------
create or replace function private.article_is_public(a public.articles)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(a.published, false) and a.editorial_status = 'published';
$$;

comment on function private.article_is_public(public.articles) is
  'Whether a Story may be shown publicly. Used by the public RLS policy; server code must use the same rule.';

revoke all on function private.article_is_public(public.articles) from public;
grant execute on function private.article_is_public(public.articles) to anon, authenticated, service_role;

drop policy if exists pub_read_articles on public.articles;
create policy pub_read_articles on public.articles
  for select to anon, authenticated
  using (private.article_is_public(articles));

-- ---------------------------------------------------------------------
-- 2) Column-level SELECT on articles
-- ---------------------------------------------------------------------
-- Keep this list identical to PUBLIC_ARTICLE_COLUMNS in
-- lib/public-article-projection.mjs (scripts/test-article-public-projection.mjs
-- checks it).
revoke select on table public.articles from anon, authenticated;

grant select (
  id, slug, title, excerpt, content, cover_image, category, tags,
  merchant_slug, author, background_style, published_at, end_at,
  created_at, updated_at
) on table public.articles to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Self-checks
-- ---------------------------------------------------------------------
do $$
declare
  expected text[] := array[
    'id', 'slug', 'title', 'excerpt', 'content', 'cover_image', 'category', 'tags',
    'merchant_slug', 'author', 'background_style', 'published_at', 'end_at',
    'created_at', 'updated_at'
  ];
  must_be_private text[] := array[
    'published', 'view_count', 'editorial_status', 'rights_declared', 'review_notes',
    'submitted_at', 'reviewed_at', 'reviewed_by', 'generated_copy', 'generated_copy_at'
  ];
  r text;
  granted text[];
  missing text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.articles', 'SELECT') then
      raise exception 'D1c self-check: % still has table-wide SELECT on articles', r;
    end if;
    select coalesce(array_agg(a.attname::text order by a.attname), '{}') into granted
      from pg_attribute a
     where a.attrelid = 'public.articles'::regclass
       and a.attnum > 0 and not a.attisdropped
       and has_column_privilege(r, 'public.articles', a.attname, 'SELECT');
    if granted <> (select array_agg(x order by x) from unnest(expected) x) then
      raise exception 'D1c self-check: % articles columns differ from the public list: %', r, granted;
    end if;
  end loop;

  select string_agg(c, ', ') into missing
    from unnest(expected || must_be_private) c
   where not exists (
     select 1 from pg_attribute a
      where a.attrelid = 'public.articles'::regclass
        and a.attname = c and a.attnum > 0 and not a.attisdropped
   );
  if missing is not null then
    raise exception 'D1c self-check: expected articles columns not found: %', missing;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'articles' and policyname = 'pub_read_articles'
       and qual like '%private.article_is_public%'
  ) then
    raise exception 'D1c self-check: pub_read_articles must use private.article_is_public';
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'articles' and cmd in ('SELECT', 'ALL')
       and policyname <> 'pub_read_articles'
       and roles && array['anon', 'authenticated', 'public']::name[]
  ) then
    raise exception 'D1c self-check: another public read policy on articles bypasses the predicate';
  end if;
end $$;

commit;
