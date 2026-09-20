-- Promotion expiry is display-only; it never changes editorial status or visibility.
begin;
alter table public.articles add column if not exists end_at timestamptz;
create index if not exists idx_articles_end_at on public.articles(end_at) where end_at is not null;
commit;
