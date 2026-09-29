-- =====================================================================
-- Visitor feedback: BEHAVIOUR tests. Needs migration 20260929140000_site_feedback.
-- Runs inside the caller's transaction; wrap in begin ... rollback.
-- =====================================================================
create schema sf_test;
create function sf_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'FEEDBACK TEST FAILED: %', label; end if; end $f$;
create function sf_test.err(stmt text, expected text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if expected is null or sqlerrm = expected then return; end if;
    raise exception 'FEEDBACK TEST FAILED: % raised the wrong error: %', label, sqlerrm;
  end;
  raise exception 'FEEDBACK TEST FAILED: % did not fail', label;
end $f$;
grant usage on schema sf_test to public;
grant execute on all functions in schema sf_test to public;

select public.site_feedback_submit('design', '  Menu text is small  ', '/store/x', null, repeat('a', 64));
select sf_test.ok((select message from public.site_feedback where reporter_hash = repeat('a', 64)) = 'Menu text is small', 'stored trimmed');

do $$ begin for i in 2..10 loop perform public.site_feedback_submit('feature', 'idea ' || i, null, null, repeat('a', 64)); end loop; end $$;
select sf_test.ok((select count(*) from public.site_feedback where reporter_hash = repeat('a', 64)) = 10, 'ten accepted');
select sf_test.err($$select public.site_feedback_submit('feature', 'eleventh', null, null, repeat('a', 64))$$, 'RATE_LIMITED', 'eleventh refused');
select public.site_feedback_submit('problem', 'another visitor', null, 'a@b.my', repeat('b', 64));

select sf_test.err($$select public.site_feedback_submit('spam', 'x', null, null, repeat('c', 64))$$, null, 'unknown topic refused');
select sf_test.err($$select public.site_feedback_submit('other', '   ', null, null, repeat('c', 64))$$, null, 'empty message refused');
select sf_test.err($$select public.site_feedback_submit('other', 'x', '//evil.test', null, repeat('c', 64))$$, null, 'external page refused');
select sf_test.err($$select public.site_feedback_submit('other', 'x', null, null, 'raw-ip-1.2.3.4')$$, null, 'raw IP refused');

set local role anon;
select sf_test.err($$select count(*) from public.site_feedback$$, null, 'anon cannot read');
select sf_test.err($$select public.site_feedback_submit('other', 'x', null, null, repeat('d', 64))$$, null, 'anon cannot call submit');
reset role;
set local role authenticated;
select sf_test.err($$select count(*) from public.site_feedback$$, null, 'authenticated cannot read');
reset role;

select 'site feedback behaviour tests passed' as result;
