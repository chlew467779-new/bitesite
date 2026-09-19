-- M2 submission foundation: keep self-service and admin-relayed Story intake
-- in one server-only review queue.

begin;

create table if not exists public.story_submissions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete set null,
  merchant_slug text,
  channel text not null default 'admin_relayed'
    check (channel in ('self_service_form', 'admin_relayed')),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'archived', 'converted')),
  title text not null,
  excerpt text,
  content text not null,
  story_angle text,
  facts jsonb not null default '{}'::jsonb,
  cover_image text,
  image_urls jsonb not null default '[]'::jsonb,
  rights_declared boolean not null default false,
  rights_note text,
  submitted_by text,
  review_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_story_submissions_status_created
  on public.story_submissions(status, created_at desc);

create index if not exists idx_story_submissions_merchant_status
  on public.story_submissions(merchant_slug, status);

create unique index if not exists idx_story_submissions_one_pending_per_merchant
  on public.story_submissions(merchant_slug)
  where merchant_slug is not null and status = 'pending_review';

alter table public.story_submissions enable row level security;
revoke all on public.story_submissions from anon, authenticated;
grant all on public.story_submissions to service_role;

commit;
