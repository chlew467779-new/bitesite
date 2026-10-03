-- =====================================================================
-- Site errors (CH 2026-10-01 plan: "tell CH when the website breaks"). No outside service: the
-- server records its own errors here and Admin shows a badge and a Today card.
--
--   public.site_errors        service role only (no anon/authenticated access at all)
--   public.site_error_record  server only. One row per kind of error (fingerprint made by the
--                             server from the normalised message): a repeat adds to `occurrences`
--                             and reopens a resolved row, so a fix that did not work shows again.
--
-- Limits: at most 50 new kinds of error per hour; beyond that the occurrences go to one
-- "many different errors" row (the fingerprint of 64 zeros). Resolved rows not seen for 30 days
-- are deleted. No IP, no visitor identity; messages are trimmed and redacted by the server.
-- =====================================================================

create table public.site_errors (
  id             uuid        primary key default gen_random_uuid(),
  fingerprint    text        not null,
  source         text        not null,
  message        text        not null,
  page_path      text,
  occurrences    integer     not null default 1,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  status         text        not null default 'new',
  resolved_at    timestamptz,
  constraint site_errors_fingerprint_key unique (fingerprint),
  constraint site_errors_fingerprint_check check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint site_errors_source_check check (source in ('server', 'browser')),
  constraint site_errors_message_check check (char_length(btrim(message)) between 1 and 500),
  constraint site_errors_page_check check (page_path is null or (page_path ~ '^/' and page_path !~ '^//' and char_length(page_path) <= 300)),
  constraint site_errors_occurrences_check check (occurrences > 0),
  constraint site_errors_status_check check (status in ('new', 'resolved'))
);
create index site_errors_status_idx on public.site_errors (status, last_seen_at desc);
create index site_errors_first_seen_idx on public.site_errors (first_seen_at);

alter table public.site_errors enable row level security;
revoke all on public.site_errors from anon, authenticated;

create or replace function public.site_error_record(
  p_source      text,
  p_message     text,
  p_page_path   text,
  p_fingerprint text
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_fingerprint text := p_fingerprint;
  v_message     text := btrim(coalesce(p_message, ''));
  v_source      text := p_source;
begin
  -- Checked here too, so bad input is refused even while it would go to the overflow row.
  if p_source is null or p_source not in ('server', 'browser')
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or char_length(v_message) not between 1 and 500
     or (p_page_path is not null and (p_page_path !~ '^/' or p_page_path ~ '^//' or char_length(p_page_path) > 300)) then
    raise exception using errcode = '22023', message = 'INVALID_SITE_ERROR';
  end if;

  -- Recording is serialised, so the hourly cap on new kinds of error cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('site_errors', 0));

  delete from public.site_errors
   where status = 'resolved' and last_seen_at < now() - interval '30 days';

  if not exists (select 1 from public.site_errors where fingerprint = v_fingerprint)
     and (select count(*) from public.site_errors where first_seen_at > now() - interval '1 hour') >= 50 then
    v_fingerprint := repeat('0', 64);
    v_source      := 'server';
    v_message     := 'Many different errors in the last hour; details of the extra ones were not kept.';
    p_page_path   := null;
  end if;

  insert into public.site_errors (fingerprint, source, message, page_path)
  values (v_fingerprint, v_source, v_message, p_page_path)
  on conflict (fingerprint) do update
     set occurrences  = least(public.site_errors.occurrences::bigint + 1, 2147483647)::integer,
         last_seen_at = now(),
         page_path    = coalesce(excluded.page_path, public.site_errors.page_path),
         status       = 'new',
         resolved_at  = null;
end;
$$;
revoke all on function public.site_error_record(text, text, text, text) from public, anon, authenticated;
grant execute on function public.site_error_record(text, text, text, text) to service_role;
