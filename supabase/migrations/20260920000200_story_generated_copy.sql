-- Keep machine-generated copy separate from merchant-provided source content.
begin;
alter table public.story_submissions
  add column if not exists generated_copy jsonb,
  add column if not exists generated_copy_at timestamptz;
alter table public.articles
  add column if not exists generated_copy jsonb,
  add column if not exists generated_copy_at timestamptz;
commit;
