-- =====================================================================
-- Homepage pop-up: BEHAVIOUR tests. Needs migration 20260929130000_site_announcements.
-- Runs inside the caller's transaction; wrap in begin ... rollback.
-- =====================================================================
create schema sa_test;
create function sa_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'POPUP TEST FAILED: %', label; end if; end $f$;
create function sa_test.err(stmt text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then return; end;
  raise exception 'POPUP TEST FAILED: % did not fail', label;
end $f$;
grant usage on schema sa_test to public;
grant execute on all functions in schema sa_test to public;

insert into public.site_announcements (title, is_active) values ('live', true);
insert into public.site_announcements (title, is_active) values ('off', false);
insert into public.site_announcements (title, is_active, starts_at) values ('later', true, now() + interval '1 day');
insert into public.site_announcements (title, is_active, ends_at) values ('ended', true, now() - interval '1 minute');
insert into public.site_announcements (image_url, is_active, link_url, link_label) values ('https://x.test/a.webp', true, '/', 'Home');

set local role anon;
select sa_test.ok((select count(*) from public.site_announcements) = 2, 'anon sees only live rows');
select sa_test.ok(not exists (select 1 from public.site_announcements where title in ('off', 'later', 'ended')), 'hidden rows stay hidden');
select sa_test.err($$insert into public.site_announcements (title) values ('x')$$, 'anon cannot insert');
select sa_test.err($$update public.site_announcements set title = 'x'$$, 'anon cannot update');
reset role;
set local role authenticated;
select sa_test.err($$delete from public.site_announcements$$, 'authenticated cannot delete');
reset role;

select sa_test.err($$insert into public.site_announcements (body) values ('no title or image')$$, 'needs title or image');
select sa_test.err($$insert into public.site_announcements (title, link_url, link_label) values ('t', 'javascript:alert(1)', 'Go')$$, 'javascript link refused');
select sa_test.err($$insert into public.site_announcements (title, link_url, link_label) values ('t', '//evil.test', 'Go')$$, 'protocol-relative link refused');
select sa_test.err($$insert into public.site_announcements (title, link_url) values ('t', '/x')$$, 'link needs a label');
select sa_test.err($$insert into public.site_announcements (title, image_url) values ('t', 'http://x.test/a.png')$$, 'http image refused');
select sa_test.err($$insert into public.site_announcements (title, starts_at, ends_at) values ('t', now(), now() - interval '1 hour')$$, 'end before start refused');

select 'site announcement behaviour tests passed' as result;
