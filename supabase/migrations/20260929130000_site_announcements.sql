-- =====================================================================
-- Homepage pop-up (CH 2026-09-29): an image and/or short notice that Admin posts and visitors can
-- close. Only Admin writes (service role through /api/admin/announcements); anyone may read the
-- one that is live. The API keeps at most one row active; the homepage shows the newest live row.
-- =====================================================================

create table public.site_announcements (
  id          uuid        primary key default gen_random_uuid(),
  title       text,
  body        text,
  image_url   text,
  link_url    text,
  link_label  text,
  is_active   boolean     not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint site_announcements_title_check check (title is null or char_length(btrim(title)) between 1 and 80),
  constraint site_announcements_body_check check (body is null or char_length(body) <= 300),
  constraint site_announcements_image_check check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 2048)),
  constraint site_announcements_link_check check (link_url is null or ((link_url ~ '^https://' or link_url ~ '^/([^/]|$)') and char_length(link_url) <= 2048)),
  constraint site_announcements_label_check check (link_label is null or char_length(btrim(link_label)) between 1 and 30),
  constraint site_announcements_link_pair_check check ((link_url is null) = (link_label is null)),
  constraint site_announcements_content_check check (title is not null or image_url is not null),
  constraint site_announcements_window_check check (starts_at is null or ends_at is null or ends_at > starts_at)
);

alter table public.site_announcements enable row level security;
create policy site_announcements_public_read on public.site_announcements for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
revoke all on public.site_announcements from anon, authenticated;
grant select on public.site_announcements to anon, authenticated;
