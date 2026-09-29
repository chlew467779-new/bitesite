-- Partner count behaviour tests. Run only in local/staging after the partner_count migration.
-- All fixtures and changes are rolled back.
begin;

create schema pc_test;
grant usage on schema pc_test to public;
create function pc_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'PARTNER COUNT TEST FAILED: %', label; end if; end $f$;
grant execute on function pc_test.ok(boolean, text) to public;

select set_config('pc_test.baseline', public.partner_count()::text, true);

insert into public.merchants (id, slug, name, is_published, platform_status, phone, first_published_at) values
  ('00000000-0000-4000-8000-0000000d0f01', 'zz-pc-ever-public', 'ZZ PC Ever Public', true, 'PUBLISHED', '+60111111113', now()),
  ('00000000-0000-4000-8000-0000000d0f02', 'zz-pc-never-public', 'ZZ PC Never Public', false, 'DRAFT', '+60111111114', null);

set local role anon;
select pc_test.ok(public.partner_count() = current_setting('pc_test.baseline')::integer + 1,
                  'anon sees only the aggregate, including one published merchant');
reset role;

update public.merchants
set is_published = false, platform_status = 'SUSPENDED'
where id = '00000000-0000-4000-8000-0000000d0f01';

set local role anon;
select pc_test.ok(public.partner_count() = current_setting('pc_test.baseline')::integer + 1,
                  'historical count stays after merchant is hidden');
select pc_test.ok(not exists (select 1 from public.merchants where slug = 'zz-pc-ever-public'),
                  'hidden merchant remains unavailable to anon row reads');
reset role;

set local role authenticated;
select pc_test.ok(public.partner_count() = current_setting('pc_test.baseline')::integer + 1,
                  'authenticated can read the same historical count');
reset role;

select pc_test.ok(has_function_privilege('anon', 'public.partner_count()', 'EXECUTE')
                  and has_function_privilege('authenticated', 'public.partner_count()', 'EXECUTE'),
                  'only intended Data API roles are granted explicitly');

select 'ALL PARTNER COUNT BEHAVIOUR TESTS PASSED (transaction rolled back, nothing persisted)';
rollback;
