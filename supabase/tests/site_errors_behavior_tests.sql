-- =====================================================================
-- Site errors: BEHAVIOUR tests. Needs migration 20261003160000_site_errors.
-- Runs inside the caller's transaction; wrap in begin ... rollback.
-- =====================================================================
create schema se_test;
create function se_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'SITE ERRORS TEST FAILED: %', label; end if; end $f$;
create function se_test.err(stmt text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then return; end;
  raise exception 'SITE ERRORS TEST FAILED: % did not fail', label;
end $f$;
grant usage on schema se_test to public;
grant execute on all functions in schema se_test to public;

delete from public.site_errors;

-- First time: one new row.
select public.site_error_record('server', '  boom  ', '/store/a', repeat('a', 64));
select se_test.ok((select message from public.site_errors where fingerprint = repeat('a', 64)) = 'boom', 'stored trimmed');
select se_test.ok((select occurrences from public.site_errors where fingerprint = repeat('a', 64)) = 1, 'one occurrence');

-- Repeat: same row, counted, newest page kept; a repeat without a page keeps the old one.
select public.site_error_record('server', 'boom', '/store/b', repeat('a', 64));
select public.site_error_record('server', 'boom', null, repeat('a', 64));
select se_test.ok((select count(*) from public.site_errors) = 1, 'repeats share one row');
select se_test.ok((select occurrences from public.site_errors where fingerprint = repeat('a', 64)) = 3, 'three occurrences');
select se_test.ok((select page_path from public.site_errors where fingerprint = repeat('a', 64)) = '/store/b', 'latest page kept');

-- Resolved, then seen again: reopened.
update public.site_errors set status = 'resolved', resolved_at = now() where fingerprint = repeat('a', 64);
select public.site_error_record('server', 'boom', null, repeat('a', 64));
select se_test.ok((select status = 'new' and resolved_at is null from public.site_errors where fingerprint = repeat('a', 64)), 'reopened on repeat');

-- Old resolved rows are cleaned up on the next record; old new rows stay.
insert into public.site_errors (fingerprint, source, message, status, last_seen_at, first_seen_at)
values (repeat('b', 64), 'browser', 'old resolved', 'resolved', now() - interval '31 days', now() - interval '40 days'),
       (repeat('c', 64), 'browser', 'old open', 'new', now() - interval '31 days', now() - interval '40 days');
select public.site_error_record('browser', 'other', null, repeat('d', 64));
select se_test.ok(not exists (select 1 from public.site_errors where fingerprint = repeat('b', 64)), 'old resolved deleted');
select se_test.ok(exists (select 1 from public.site_errors where fingerprint = repeat('c', 64)), 'old open kept');

-- Cap: 50 new kinds per hour, then one overflow row.
delete from public.site_errors;
do $$ begin for i in 1..50 loop perform public.site_error_record('browser', 'kind ' || i, null, encode(sha256(convert_to('k' || i, 'UTF8')), 'hex')); end loop; end $$;
select public.site_error_record('browser', 'kind 51', '/x', repeat('e', 64));
select public.site_error_record('browser', 'kind 52', '/y', repeat('f', 64));
select se_test.ok(not exists (select 1 from public.site_errors where fingerprint in (repeat('e', 64), repeat('f', 64))), 'extra kinds not stored');
select se_test.ok((select occurrences from public.site_errors where fingerprint = repeat('0', 64)) = 2, 'overflow row counts extras');
select se_test.ok((select source = 'server' and page_path is null from public.site_errors where fingerprint = repeat('0', 64)), 'overflow row has no visitor data');
select public.site_error_record('browser', 'kind 1', null, encode(sha256(convert_to('k1', 'UTF8')), 'hex'));
select se_test.ok((select occurrences from public.site_errors where fingerprint = encode(sha256(convert_to('k1', 'UTF8')), 'hex')) = 2, 'known kinds still counted while capped');

-- Validation.
select se_test.err($$select public.site_error_record('robot', 'x', null, repeat('1', 64))$$, 'unknown source refused');
select se_test.err($$select public.site_error_record('server', '   ', null, repeat('2', 64))$$, 'empty message refused');
select se_test.err($$select public.site_error_record('server', repeat('x', 501), null, repeat('3', 64))$$, 'long message refused');
select se_test.err($$select public.site_error_record('server', 'x', '//evil.test', repeat('4', 64))$$, 'external page refused');
select se_test.err($$select public.site_error_record('server', 'x', null, 'not-a-hash')$$, 'bad fingerprint refused');

-- Nobody but the service role.
set local role anon;
select se_test.err($$select count(*) from public.site_errors$$, 'anon cannot read');
select se_test.err($$select public.site_error_record('server', 'x', null, repeat('5', 64))$$, 'anon cannot record');
reset role;
set local role authenticated;
select se_test.err($$select count(*) from public.site_errors$$, 'authenticated cannot read');
select se_test.err($$select public.site_error_record('server', 'x', null, repeat('6', 64))$$, 'authenticated cannot record');
reset role;

select 'site errors behaviour tests passed' as result;
