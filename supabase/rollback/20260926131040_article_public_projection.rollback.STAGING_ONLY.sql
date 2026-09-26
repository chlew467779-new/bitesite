-- =====================================================================
-- ROLLBACK of 20260926131040_article_public_projection.sql — STAGING ONLY.
-- =====================================================================
-- WARNING: this re-opens every articles column to anon / authenticated,
-- including review notes, reviewer, AI draft copy and view counts, and makes
-- Stories public again on the published flag alone (a rejected Story whose
-- flag was left true becomes public). Prefer a forward fix. On production this
-- needs an approved emergency and a backup taken first. The D1c application
-- code keeps working after this rollback.
--
-- Set the switch below to 'yes' deliberately before running.
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

revoke select (
  id, slug, title, excerpt, content, cover_image, category, tags,
  merchant_slug, author, background_style, published_at, end_at,
  created_at, updated_at
) on table public.articles from anon, authenticated;
grant select on table public.articles to anon, authenticated;

drop policy if exists pub_read_articles on public.articles;
create policy pub_read_articles on public.articles
  for select to anon, authenticated
  using (published = true);

drop function if exists private.article_is_public(public.articles);

do $$
begin
  if not has_table_privilege('anon', 'public.articles', 'SELECT') then
    raise exception 'Rollback self-check: anon should have table-wide SELECT on articles again';
  end if;
  if to_regprocedure('private.article_is_public(public.articles)') is not null then
    raise exception 'Rollback self-check: article_is_public still exists';
  end if;
end $$;

commit;
