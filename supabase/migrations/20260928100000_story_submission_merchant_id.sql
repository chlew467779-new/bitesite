-- =====================================================================
-- Story submissions get a stable restaurant reference (merchant_id) next to merchant_slug.
-- =====================================================================
-- FINAL_AUDIT (05 §Stories): submissions were keyed only by merchant_slug. Slug changes already
-- cascade (20260927140000), but nothing tied a submission to the restaurant row itself.
--
-- 1. story_submissions.merchant_id uuid, FK to merchants ON DELETE SET NULL (editorial history
--    survives a deleted restaurant). Nullable: a relayed submission whose slug matches no
--    restaurant stays unlinked rather than guessed.
-- 2. Backfill from the current slug, then from merchant_slug_history (older addresses; the slug
--    is normalised to the current one).
-- 3. private.story_submission_merchant_sync (BEFORE INSERT / UPDATE OF merchant_id, merchant_slug)
--    keeps the pair consistent for every writer (Owner RPC, Admin routes, the slug cascade):
--      - merchant_id set (or changed): merchant_slug := that restaurant's current slug;
--      - otherwise, slug set or changed: merchant_id resolved from the current slug, then history
--        (slug normalised); no match -> merchant_id null.
-- 4. One pending Story per restaurant also by merchant_id (the slug index stays for old rows).
-- Owner reads (/api/merchant/story-submissions) now filter by merchant_id.
--
-- Local first; staging and production each need CH approval, after 20260928090000.
-- Rollback: supabase/rollback/20260928100000_story_submission_merchant_id.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

alter table public.story_submissions
  add column merchant_id uuid references public.merchants(id) on delete set null;

update public.story_submissions s
   set merchant_id = m.id
  from public.merchants m
 where s.merchant_slug is not null and m.slug = s.merchant_slug;

update public.story_submissions s
   set merchant_id = h.merchant_id, merchant_slug = m.slug
  from public.merchant_slug_history h
  join public.merchants m on m.id = h.merchant_id
 where s.merchant_id is null and s.merchant_slug is not null and h.old_slug = s.merchant_slug;

create or replace function private.story_submission_merchant_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text;
begin
  if new.merchant_id is not null
     and (tg_op = 'INSERT' or new.merchant_id is distinct from old.merchant_id or new.merchant_slug is not distinct from old.merchant_slug) then
    select slug into v_slug from public.merchants where id = new.merchant_id;
    if found then new.merchant_slug := v_slug; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.merchant_id is not distinct from old.merchant_id
     and new.merchant_slug is not distinct from old.merchant_slug then
    return new;
  end if;
  new.merchant_id := null;
  if new.merchant_slug is null then return new; end if;
  select id, slug into v_id, v_slug from public.merchants where slug = new.merchant_slug;
  if not found then
    select m.id, m.slug into v_id, v_slug
      from public.merchant_slug_history h join public.merchants m on m.id = h.merchant_id
     where h.old_slug = new.merchant_slug;
  end if;
  if v_id is not null then
    new.merchant_id := v_id;
    new.merchant_slug := v_slug;
  end if;
  return new;
end;
$$;
revoke all on function private.story_submission_merchant_sync() from public, anon, authenticated;

create trigger story_submissions_merchant_sync
  before insert or update of merchant_id, merchant_slug on public.story_submissions
  for each row execute function private.story_submission_merchant_sync();

create unique index idx_story_submissions_one_pending_per_merchant_id
  on public.story_submissions (merchant_id) where merchant_id is not null and status = 'pending_review';
create index idx_story_submissions_merchant_id_created
  on public.story_submissions (merchant_id, created_at desc) where merchant_id is not null;

comment on column public.story_submissions.merchant_id is
  'Restaurant this submission belongs to; kept consistent with merchant_slug by story_submissions_merchant_sync. Null = no matching restaurant.';

commit;
