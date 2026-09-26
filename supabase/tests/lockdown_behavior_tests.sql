-- =====================================================================
-- Lockdown BEHAVIOUR tests — STAGING ONLY (needs supabase/staging/10_synthetic_seed.sql).
-- Switches to the real roles (anon / authenticated / service_role) and tries to
-- read and write. The whole script runs inside a transaction that is ROLLED
-- BACK at the end, so nothing persists even if a write unexpectedly succeeds.
-- Any failure raises an exception that names the failing check.
-- =====================================================================
begin;

-- helper schema lives only inside this transaction (removed by the final ROLLBACK)
create schema lockdown_test;
grant usage on schema lockdown_test to public;

create function lockdown_test.assert_denied(stmt text, label text) returns void
language plpgsql as $f$
begin
  begin
    execute stmt;
  exception
    when insufficient_privilege then
      return;                                 -- 42501 = permission denied OR RLS violation: both count as "denied"
    when others then
      raise exception 'LOCKDOWN TEST FAILED: % was NOT denied; statement reached execution and raised % (%)',
        label, sqlerrm, sqlstate;
  end;
  raise exception 'LOCKDOWN TEST FAILED: % was NOT denied', label;
end $f$;

create function lockdown_test.assert_true(cond boolean, label text) returns void
language plpgsql as $f$
begin
  if cond is not true then raise exception 'LOCKDOWN TEST FAILED: %', label; end if;
end $f$;

-- ============ role: anon ============
set local role anon;
select lockdown_test.assert_denied($q$insert into public.articles default values$q$, 'anon INSERT articles');
select lockdown_test.assert_denied($q$update public.articles set title = title where false$q$, 'anon UPDATE articles');
select lockdown_test.assert_denied($q$delete from public.articles where false$q$, 'anon DELETE articles');
select lockdown_test.assert_denied($q$truncate public.articles$q$, 'anon TRUNCATE articles');
select lockdown_test.assert_denied($q$insert into public.categories default values$q$, 'anon INSERT categories');
select lockdown_test.assert_denied($q$update public.categories set name = name where false$q$, 'anon UPDATE categories');
select lockdown_test.assert_denied($q$delete from public.categories where false$q$, 'anon DELETE categories');
select lockdown_test.assert_denied($q$truncate public.categories$q$, 'anon TRUNCATE categories');
select lockdown_test.assert_denied($q$insert into public.events default values$q$, 'anon INSERT events');
select lockdown_test.assert_denied($q$update public.events set title = title where false$q$, 'anon UPDATE events');
select lockdown_test.assert_denied($q$delete from public.events where false$q$, 'anon DELETE events');
select lockdown_test.assert_denied($q$truncate public.events$q$, 'anon TRUNCATE events');
select lockdown_test.assert_denied($q$insert into public.login_attempts default values$q$, 'anon INSERT login_attempts');
select lockdown_test.assert_denied($q$update public.login_attempts set ip = ip where false$q$, 'anon UPDATE login_attempts');
select lockdown_test.assert_denied($q$delete from public.login_attempts where false$q$, 'anon DELETE login_attempts');
select lockdown_test.assert_denied($q$truncate public.login_attempts$q$, 'anon TRUNCATE login_attempts');
select lockdown_test.assert_denied($q$insert into public.merchant_daily_views default values$q$, 'anon INSERT merchant_daily_views');
select lockdown_test.assert_denied($q$update public.merchant_daily_views set slug = slug where false$q$, 'anon UPDATE merchant_daily_views');
select lockdown_test.assert_denied($q$delete from public.merchant_daily_views where false$q$, 'anon DELETE merchant_daily_views');
select lockdown_test.assert_denied($q$truncate public.merchant_daily_views$q$, 'anon TRUNCATE merchant_daily_views');
select lockdown_test.assert_denied($q$insert into public.merchant_monthly_views default values$q$, 'anon INSERT merchant_monthly_views');
select lockdown_test.assert_denied($q$update public.merchant_monthly_views set slug = slug where false$q$, 'anon UPDATE merchant_monthly_views');
select lockdown_test.assert_denied($q$delete from public.merchant_monthly_views where false$q$, 'anon DELETE merchant_monthly_views');
select lockdown_test.assert_denied($q$truncate public.merchant_monthly_views$q$, 'anon TRUNCATE merchant_monthly_views');
select lockdown_test.assert_denied($q$insert into public.merchant_stats default values$q$, 'anon INSERT merchant_stats');
select lockdown_test.assert_denied($q$update public.merchant_stats set view_count = view_count where false$q$, 'anon UPDATE merchant_stats');
select lockdown_test.assert_denied($q$delete from public.merchant_stats where false$q$, 'anon DELETE merchant_stats');
select lockdown_test.assert_denied($q$truncate public.merchant_stats$q$, 'anon TRUNCATE merchant_stats');
select lockdown_test.assert_denied($q$insert into public.merchant_videos default values$q$, 'anon INSERT merchant_videos');
select lockdown_test.assert_denied($q$update public.merchant_videos set caption = caption where false$q$, 'anon UPDATE merchant_videos');
select lockdown_test.assert_denied($q$delete from public.merchant_videos where false$q$, 'anon DELETE merchant_videos');
select lockdown_test.assert_denied($q$truncate public.merchant_videos$q$, 'anon TRUNCATE merchant_videos');
select lockdown_test.assert_denied($q$insert into public.merchants default values$q$, 'anon INSERT merchants');
select lockdown_test.assert_denied($q$update public.merchants set name = name where false$q$, 'anon UPDATE merchants');
select lockdown_test.assert_denied($q$delete from public.merchants where false$q$, 'anon DELETE merchants');
select lockdown_test.assert_denied($q$truncate public.merchants$q$, 'anon TRUNCATE merchants');
select lockdown_test.assert_denied($q$insert into public.page_views default values$q$, 'anon INSERT page_views');
select lockdown_test.assert_denied($q$update public.page_views set path = path where false$q$, 'anon UPDATE page_views');
select lockdown_test.assert_denied($q$delete from public.page_views where false$q$, 'anon DELETE page_views');
select lockdown_test.assert_denied($q$truncate public.page_views$q$, 'anon TRUNCATE page_views');
select lockdown_test.assert_denied($q$insert into public.products default values$q$, 'anon INSERT products');
select lockdown_test.assert_denied($q$update public.products set name = name where false$q$, 'anon UPDATE products');
select lockdown_test.assert_denied($q$delete from public.products where false$q$, 'anon DELETE products');
select lockdown_test.assert_denied($q$truncate public.products$q$, 'anon TRUNCATE products');
select lockdown_test.assert_denied($q$insert into public.settings default values$q$, 'anon INSERT settings');
select lockdown_test.assert_denied($q$update public.settings set value = value where false$q$, 'anon UPDATE settings');
select lockdown_test.assert_denied($q$delete from public.settings where false$q$, 'anon DELETE settings');
select lockdown_test.assert_denied($q$truncate public.settings$q$, 'anon TRUNCATE settings');
select lockdown_test.assert_denied($q$select * from public.page_views$q$, 'anon SELECT page_views');
select lockdown_test.assert_denied($q$select * from public.login_attempts$q$, 'anon SELECT login_attempts');
select lockdown_test.assert_denied($q$select * from public.merchant_daily_views$q$, 'anon SELECT merchant_daily_views');
select lockdown_test.assert_denied($q$select * from public.merchant_monthly_views$q$, 'anon SELECT merchant_monthly_views');
select lockdown_test.assert_denied($q$select public.increment_view_count('zz-sec-test-published')$q$, 'anon EXECUTE increment_view_count');
select lockdown_test.assert_denied($q$select public.increment_article_view('zz-sec-test-story-published')$q$, 'anon EXECUTE increment_article_view');
select lockdown_test.assert_denied($q$select public.aggregate_daily_views()$q$, 'anon EXECUTE aggregate_daily_views');

-- public reads still work and are filtered
select lockdown_test.assert_true((select count(*) from public.merchants where slug = 'zz-sec-test-published') = 1, 'anon sees published merchant');
select lockdown_test.assert_true((select count(*) from public.merchants where slug = 'zz-sec-test-draft') = 0,     'anon must NOT see unpublished merchant');
select lockdown_test.assert_true((select count(*) from public.categories where name = 'ZZ Published Category') = 1, 'anon sees published merchant category');
select lockdown_test.assert_true((select count(*) from public.categories where name = 'ZZ Draft Category') = 0,     'anon must NOT see draft merchant category');
select lockdown_test.assert_true((select count(*) from public.products where name = 'ZZ Published Product') = 1,   'anon sees published merchant product');
select lockdown_test.assert_true((select count(*) from public.products where name = 'ZZ Draft Product') = 0,       'anon must NOT see draft merchant product');
select lockdown_test.assert_true((select count(*) from public.articles where slug = 'zz-sec-test-story-published') = 1, 'anon sees published story');
select lockdown_test.assert_true((select count(*) from public.articles where slug = 'zz-sec-test-story-draft') = 0,     'anon must NOT see draft story');
select lockdown_test.assert_true((select count(*) from public.events where title = 'ZZ Published Event') = 1,       'anon can read events');
select lockdown_test.assert_denied($q$select 1 from public.merchant_stats limit 1$q$, 'anon SELECT merchant_stats (private since D1a, DEC-29)');
select lockdown_test.assert_true((select count(*) from public.settings where key = 'site_title') = 1,              'anon can read public settings');
select lockdown_test.assert_true((select count(*) from public.settings where key = 'zz_private_test_key') = 0,      'anon must NOT read non-allow-listed settings');
reset role;

-- ============ role: authenticated ============
set local role authenticated;
select lockdown_test.assert_denied($q$insert into public.articles default values$q$, 'authenticated INSERT articles');
select lockdown_test.assert_denied($q$update public.articles set title = title where false$q$, 'authenticated UPDATE articles');
select lockdown_test.assert_denied($q$delete from public.articles where false$q$, 'authenticated DELETE articles');
select lockdown_test.assert_denied($q$truncate public.articles$q$, 'authenticated TRUNCATE articles');
select lockdown_test.assert_denied($q$insert into public.categories default values$q$, 'authenticated INSERT categories');
select lockdown_test.assert_denied($q$update public.categories set name = name where false$q$, 'authenticated UPDATE categories');
select lockdown_test.assert_denied($q$delete from public.categories where false$q$, 'authenticated DELETE categories');
select lockdown_test.assert_denied($q$truncate public.categories$q$, 'authenticated TRUNCATE categories');
select lockdown_test.assert_denied($q$insert into public.events default values$q$, 'authenticated INSERT events');
select lockdown_test.assert_denied($q$update public.events set title = title where false$q$, 'authenticated UPDATE events');
select lockdown_test.assert_denied($q$delete from public.events where false$q$, 'authenticated DELETE events');
select lockdown_test.assert_denied($q$truncate public.events$q$, 'authenticated TRUNCATE events');
select lockdown_test.assert_denied($q$insert into public.login_attempts default values$q$, 'authenticated INSERT login_attempts');
select lockdown_test.assert_denied($q$update public.login_attempts set ip = ip where false$q$, 'authenticated UPDATE login_attempts');
select lockdown_test.assert_denied($q$delete from public.login_attempts where false$q$, 'authenticated DELETE login_attempts');
select lockdown_test.assert_denied($q$truncate public.login_attempts$q$, 'authenticated TRUNCATE login_attempts');
select lockdown_test.assert_denied($q$insert into public.merchant_daily_views default values$q$, 'authenticated INSERT merchant_daily_views');
select lockdown_test.assert_denied($q$update public.merchant_daily_views set slug = slug where false$q$, 'authenticated UPDATE merchant_daily_views');
select lockdown_test.assert_denied($q$delete from public.merchant_daily_views where false$q$, 'authenticated DELETE merchant_daily_views');
select lockdown_test.assert_denied($q$truncate public.merchant_daily_views$q$, 'authenticated TRUNCATE merchant_daily_views');
select lockdown_test.assert_denied($q$insert into public.merchant_monthly_views default values$q$, 'authenticated INSERT merchant_monthly_views');
select lockdown_test.assert_denied($q$update public.merchant_monthly_views set slug = slug where false$q$, 'authenticated UPDATE merchant_monthly_views');
select lockdown_test.assert_denied($q$delete from public.merchant_monthly_views where false$q$, 'authenticated DELETE merchant_monthly_views');
select lockdown_test.assert_denied($q$truncate public.merchant_monthly_views$q$, 'authenticated TRUNCATE merchant_monthly_views');
select lockdown_test.assert_denied($q$insert into public.merchant_stats default values$q$, 'authenticated INSERT merchant_stats');
select lockdown_test.assert_denied($q$update public.merchant_stats set view_count = view_count where false$q$, 'authenticated UPDATE merchant_stats');
select lockdown_test.assert_denied($q$delete from public.merchant_stats where false$q$, 'authenticated DELETE merchant_stats');
select lockdown_test.assert_denied($q$truncate public.merchant_stats$q$, 'authenticated TRUNCATE merchant_stats');
select lockdown_test.assert_denied($q$insert into public.merchant_videos default values$q$, 'authenticated INSERT merchant_videos');
select lockdown_test.assert_denied($q$update public.merchant_videos set caption = caption where false$q$, 'authenticated UPDATE merchant_videos');
select lockdown_test.assert_denied($q$delete from public.merchant_videos where false$q$, 'authenticated DELETE merchant_videos');
select lockdown_test.assert_denied($q$truncate public.merchant_videos$q$, 'authenticated TRUNCATE merchant_videos');
select lockdown_test.assert_denied($q$insert into public.merchants default values$q$, 'authenticated INSERT merchants');
select lockdown_test.assert_denied($q$update public.merchants set name = name where false$q$, 'authenticated UPDATE merchants');
select lockdown_test.assert_denied($q$delete from public.merchants where false$q$, 'authenticated DELETE merchants');
select lockdown_test.assert_denied($q$truncate public.merchants$q$, 'authenticated TRUNCATE merchants');
select lockdown_test.assert_denied($q$insert into public.page_views default values$q$, 'authenticated INSERT page_views');
select lockdown_test.assert_denied($q$update public.page_views set path = path where false$q$, 'authenticated UPDATE page_views');
select lockdown_test.assert_denied($q$delete from public.page_views where false$q$, 'authenticated DELETE page_views');
select lockdown_test.assert_denied($q$truncate public.page_views$q$, 'authenticated TRUNCATE page_views');
select lockdown_test.assert_denied($q$insert into public.products default values$q$, 'authenticated INSERT products');
select lockdown_test.assert_denied($q$update public.products set name = name where false$q$, 'authenticated UPDATE products');
select lockdown_test.assert_denied($q$delete from public.products where false$q$, 'authenticated DELETE products');
select lockdown_test.assert_denied($q$truncate public.products$q$, 'authenticated TRUNCATE products');
select lockdown_test.assert_denied($q$insert into public.settings default values$q$, 'authenticated INSERT settings');
select lockdown_test.assert_denied($q$update public.settings set value = value where false$q$, 'authenticated UPDATE settings');
select lockdown_test.assert_denied($q$delete from public.settings where false$q$, 'authenticated DELETE settings');
select lockdown_test.assert_denied($q$truncate public.settings$q$, 'authenticated TRUNCATE settings');
select lockdown_test.assert_denied($q$select * from public.page_views$q$, 'authenticated SELECT page_views');
select lockdown_test.assert_denied($q$select * from public.login_attempts$q$, 'authenticated SELECT login_attempts');
select lockdown_test.assert_denied($q$select * from public.merchant_daily_views$q$, 'authenticated SELECT merchant_daily_views');
select lockdown_test.assert_denied($q$select * from public.merchant_monthly_views$q$, 'authenticated SELECT merchant_monthly_views');
select lockdown_test.assert_denied($q$select public.increment_view_count('zz-sec-test-published')$q$, 'authenticated EXECUTE increment_view_count');
select lockdown_test.assert_denied($q$select public.increment_article_view('zz-sec-test-story-published')$q$, 'authenticated EXECUTE increment_article_view');
select lockdown_test.assert_denied($q$select public.aggregate_daily_views()$q$, 'authenticated EXECUTE aggregate_daily_views');

-- public reads still work and are filtered
select lockdown_test.assert_true((select count(*) from public.merchants where slug = 'zz-sec-test-published') = 1, 'authenticated sees published merchant');
select lockdown_test.assert_true((select count(*) from public.merchants where slug = 'zz-sec-test-draft') = 0,     'authenticated must NOT see unpublished merchant');
select lockdown_test.assert_true((select count(*) from public.categories where name = 'ZZ Published Category') = 1, 'authenticated sees published merchant category');
select lockdown_test.assert_true((select count(*) from public.categories where name = 'ZZ Draft Category') = 0,     'authenticated must NOT see draft merchant category');
select lockdown_test.assert_true((select count(*) from public.products where name = 'ZZ Published Product') = 1,   'authenticated sees published merchant product');
select lockdown_test.assert_true((select count(*) from public.products where name = 'ZZ Draft Product') = 0,       'authenticated must NOT see draft merchant product');
select lockdown_test.assert_true((select count(*) from public.articles where slug = 'zz-sec-test-story-published') = 1, 'authenticated sees published story');
select lockdown_test.assert_true((select count(*) from public.articles where slug = 'zz-sec-test-story-draft') = 0,     'authenticated must NOT see draft story');
select lockdown_test.assert_true((select count(*) from public.events where title = 'ZZ Published Event') = 1,       'authenticated can read events');
select lockdown_test.assert_denied($q$select 1 from public.merchant_stats limit 1$q$, 'authenticated SELECT merchant_stats (private since D1a, DEC-29)');
select lockdown_test.assert_true((select count(*) from public.settings where key = 'site_title') = 1,              'authenticated can read public settings');
select lockdown_test.assert_true((select count(*) from public.settings where key = 'zz_private_test_key') = 0,      'authenticated must NOT read non-allow-listed settings');
reset role;

-- ============ role: service_role (what the Next.js server uses) ============
set local role service_role;
select lockdown_test.assert_true((select count(*) from public.merchants) >= 2, 'service_role sees ALL merchants incl. drafts');
select lockdown_test.assert_true((select count(*) from public.settings where key = 'zz_private_test_key') = 1, 'service_role reads all settings');
select public.increment_view_count('zz-sec-test-published');
select lockdown_test.assert_true((select view_count from public.merchant_stats where slug = 'zz-sec-test-published') = 4, 'increment_view_count works for service_role');
select public.increment_article_view('zz-sec-test-story-published');
select lockdown_test.assert_true((select view_count from public.articles where slug = 'zz-sec-test-story-published') = 1, 'increment_article_view works for service_role');
insert into public.page_views (slug, path, page_type, event_type) values ('zz-sec-test-published', '/x', 'merchant', 'page_view');
insert into public.login_attempts (ip, attempt_count) values ('203.0.113.99', 1);
update public.settings set value = 'edited-by-server' where key = 'site_title';
insert into public.merchants (slug, name, whatsapp, is_published) values ('zz-sec-test-created-by-server', 'ZZ Created By Server', '60100000003', false);
delete from public.merchants where slug = 'zz-sec-test-created-by-server';
reset role;

rollback;
select 'ALL LOCKDOWN BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)' as result;
