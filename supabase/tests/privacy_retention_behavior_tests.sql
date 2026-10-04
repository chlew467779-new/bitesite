-- =====================================================================
-- Privacy retention: BEHAVIOUR tests. Needs migration 20261004100000_privacy_retention.
-- Runs inside the caller's transaction; wrap in begin ... rollback.
-- =====================================================================
create schema pr_test;
create function pr_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'PRIVACY RETENTION TEST FAILED: %', label; end if; end $f$;
grant usage on schema pr_test to public;
grant execute on all functions in schema pr_test to public;

select pr_test.ok(exists (select 1 from cron.job where jobname = 'privacy_retention_cleanup' and schedule = '30 19 * * *'), 'nightly job scheduled');

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000071a1', 'zz-pr-owner@example.test');
insert into public.merchants (id, slug, name, is_published, platform_status, phone) values
  ('00000000-0000-4000-8000-000000007101', 'zz-pr-a', 'ZZ PR A', true, 'PUBLISHED', '+60111111111');

-- Visitor feedback: old done -> deleted; recent done, old new -> kept.
insert into public.site_feedback (topic, message, reporter_hash, status, created_at, decided_at) values
  ('problem', 'zz-pr old done',   repeat('a', 64), 'done', now() - interval '14 months', now() - interval '13 months'),
  ('problem', 'zz-pr recent done', repeat('a', 64), 'done', now() - interval '2 months',  now() - interval '1 month'),
  ('feature', 'zz-pr old new',     repeat('a', 64), 'new',  now() - interval '20 months', null);

-- Visitor reports: old resolved and old dismissed -> deleted; old new and recent resolved -> kept.
insert into public.public_reports (target_type, merchant_id, target_slug, target_name, reason, reporter_hash, status, created_at, decided_at) values
  ('merchant', '00000000-0000-4000-8000-000000007101', 'zz-pr-a', 'ZZ PR A', 'other', repeat('b', 64), 'resolved',  now() - interval '14 months', now() - interval '13 months'),
  ('merchant', '00000000-0000-4000-8000-000000007101', 'zz-pr-a', 'ZZ PR A', 'other', repeat('b', 64), 'dismissed', now() - interval '14 months', now() - interval '13 months'),
  ('merchant', '00000000-0000-4000-8000-000000007101', 'zz-pr-a', 'ZZ PR A', 'other', repeat('b', 64), 'new',       now() - interval '14 months', null),
  ('merchant', '00000000-0000-4000-8000-000000007101', 'zz-pr-a', 'ZZ PR A', 'other', repeat('b', 64), 'resolved',  now() - interval '2 months',  now() - interval '1 month');

-- Merchant feedback: old resolved -> deleted; old read -> kept.
insert into public.merchant_feedback (merchant_id, submitted_by, topic, message, status, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000007101', '00000000-0000-4000-8000-0000000071a1', 'problem', 'zz-pr old resolved', 'resolved', now() - interval '14 months', now() - interval '13 months'),
  ('00000000-0000-4000-8000-000000007101', '00000000-0000-4000-8000-0000000071a1', 'problem', 'zz-pr old read',     'read',     now() - interval '14 months', now() - interval '13 months');

-- Site errors: resolved 31 days ago -> deleted; resolved yesterday, old new -> kept.
insert into public.site_errors (fingerprint, source, message, status, resolved_at, last_seen_at, first_seen_at) values
  (repeat('1', 64), 'server', 'zz-pr fixed long ago', 'resolved', now() - interval '31 days', now() - interval '40 days', now() - interval '40 days'),
  (repeat('2', 64), 'server', 'zz-pr fixed yesterday', 'resolved', now() - interval '1 day', now() - interval '2 days', now() - interval '2 days'),
  (repeat('3', 64), 'server', 'zz-pr still open', 'new', null, now() - interval '90 days', now() - interval '90 days');

select pr_test.ok(
  (select private.privacy_retention_cleanup()) @> '{"site_feedback": 1, "public_reports": 2, "merchant_feedback": 1, "site_errors": 1}'::jsonb,
  'reports how many rows it removed');

select pr_test.ok((select array_agg(message order by message) from public.site_feedback where message like 'zz-pr%') = array['zz-pr old new', 'zz-pr recent done'], 'visitor feedback: only old handled removed');
select pr_test.ok((select array_agg(status order by status) from public.public_reports where target_slug = 'zz-pr-a') = array['new', 'resolved'], 'reports: only old handled removed');
select pr_test.ok((select array_agg(message) from public.merchant_feedback where message like 'zz-pr%') = array['zz-pr old read'], 'merchant feedback: only old resolved removed');
select pr_test.ok((select array_agg(message order by message) from public.site_errors where message like 'zz-pr%') = array['zz-pr fixed yesterday', 'zz-pr still open'], 'site errors: only long-fixed removed');

-- Second run removes nothing more.
select pr_test.ok((select private.privacy_retention_cleanup()) = '{"site_feedback": 0, "public_reports": 0, "merchant_feedback": 0, "site_errors": 0}'::jsonb, 'idempotent');

-- Browser roles cannot run it.
set local role anon;
do $$ begin perform private.privacy_retention_cleanup(); raise exception 'PRIVACY RETENTION TEST FAILED: anon ran it'; exception when insufficient_privilege then null; end $$;
reset role;
set local role service_role;
do $$ begin perform private.privacy_retention_cleanup(); raise exception 'PRIVACY RETENTION TEST FAILED: service_role ran it'; exception when insufficient_privilege then null; end $$;
reset role;

select 'privacy retention behaviour tests passed' as result;
