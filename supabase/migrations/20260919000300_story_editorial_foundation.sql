-- M2 foundation: preserve Story editorial state and revision history.
-- Existing articles remain compatible with the published boolean used by V1.

begin;

alter table public.articles
  add column if not exists editorial_status text,
  add column if not exists rights_declared boolean,
  add column if not exists review_notes text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists published_at timestamptz;

update public.articles
set editorial_status = case when published = true then 'published' else 'draft' end
where editorial_status is null;

alter table public.articles
  alter column editorial_status set default 'draft',
  alter column editorial_status set not null;

alter table public.articles
  drop constraint if exists articles_editorial_status_check;

alter table public.articles
  add constraint articles_editorial_status_check
  check (editorial_status in ('draft', 'pending_review', 'approved', 'published', 'rejected', 'archived'));

create table if not exists public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  action text not null check (action in ('created', 'updated', 'submitted', 'approved', 'rejected', 'published', 'archived')),
  snapshot jsonb not null,
  actor text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_article_revisions_article_created
  on public.article_revisions(article_id, created_at desc);

alter table public.article_revisions enable row level security;
revoke all on public.article_revisions from anon, authenticated;
grant all on public.article_revisions to service_role;

commit;
