-- =====================================================================
-- Visitor feedback about BiteSite itself (CH 2026-09-29): the footer's "Feedback" page.
--
--   public.site_feedback          service role only (no anon/authenticated access at all)
--   public.site_feedback_submit   server route only: at most 10 per visitor per 24 hours, where the
--                                 visitor is an HMAC of the IP made by the server (never the raw IP),
--                                 as for visitor reports.
--
-- Topics: feature / design / other are collected and handled in a batch (CH: every two months);
-- problem is handled as it comes in. Admin marks items new or done (one or many at a time).
-- =====================================================================

create table public.site_feedback (
  id            uuid        primary key default gen_random_uuid(),
  topic         text        not null,
  message       text        not null,
  page_path     text,
  contact_email text,
  reporter_hash text        not null,
  status        text        not null default 'new',
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  constraint site_feedback_topic_check check (topic in ('feature', 'design', 'problem', 'other')),
  constraint site_feedback_message_check check (char_length(btrim(message)) between 1 and 1000),
  constraint site_feedback_page_check check (page_path is null or (page_path ~ '^/' and page_path !~ '^//' and char_length(page_path) <= 300)),
  constraint site_feedback_contact_check check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  constraint site_feedback_hash_check check (reporter_hash ~ '^[0-9a-f]{64}$'),
  constraint site_feedback_status_check check (status in ('new', 'done'))
);
create index site_feedback_reporter_idx on public.site_feedback (reporter_hash, created_at);
create index site_feedback_status_idx on public.site_feedback (status, created_at);

alter table public.site_feedback enable row level security;
revoke all on public.site_feedback from anon, authenticated;

create or replace function public.site_feedback_submit(
  p_topic         text,
  p_message       text,
  p_page_path     text,
  p_contact_email text,
  p_reporter_hash text
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  -- One visitor's submissions are counted one at a time, so the cap cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('site_feedback:' || coalesce(p_reporter_hash, ''), 0));
  if (select count(*) from public.site_feedback
       where reporter_hash = p_reporter_hash and created_at > now() - interval '24 hours') >= 10 then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
  insert into public.site_feedback (topic, message, page_path, contact_email, reporter_hash)
  values (p_topic, btrim(p_message), p_page_path, p_contact_email, p_reporter_hash);
end;
$$;
revoke all on function public.site_feedback_submit(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.site_feedback_submit(text, text, text, text, text) to service_role;
