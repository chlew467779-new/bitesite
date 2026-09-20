begin;

-- Stories list: published content ordered by newest first.
create index if not exists idx_articles_published_created_at
  on public.articles (published, created_at desc);

-- Public story pages and metadata resolve published stories by slug.
create index if not exists idx_articles_published_slug
  on public.articles (slug)
  where published = true;

commit;
