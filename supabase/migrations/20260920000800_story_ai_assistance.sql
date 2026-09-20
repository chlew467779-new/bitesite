-- Records whether a merchant requested optional internal AI drafting help.
begin;

alter table public.story_submissions
  add column if not exists ai_assistance_requested boolean not null default false;

commit;
