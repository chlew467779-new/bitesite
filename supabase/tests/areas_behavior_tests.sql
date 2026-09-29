-- =====================================================================
-- Areas: BEHAVIOUR tests. Needs migrations through 20260929100000_areas.
-- Runs inside the caller's transaction; wrap in begin ... rollback.
-- =====================================================================
create schema ar_test;
create function ar_test.ok(cond boolean, label text) returns void
language plpgsql as $f$ begin if cond is not true then raise exception 'AREA TEST FAILED: %', label; end if; end $f$;
create function ar_test.err(stmt text, label text) returns void
language plpgsql as $f$
begin
  begin execute stmt; exception when others then
    if sqlerrm = 'VALIDATION_FAILED' then return; end if;
    raise exception 'AREA TEST FAILED: % raised the wrong error: % (%)', label, sqlerrm, sqlstate;
  end;
  raise exception 'AREA TEST FAILED: % did not fail', label;
end $f$;
grant usage on schema ar_test to public;
grant execute on all functions in schema ar_test to public;

select ar_test.ok(private.area_canonical('sungai besi') = 'Sungai Besi', 'lower-case name');
select ar_test.ok(private.area_canonical('  Sungai BESI ') = 'Sungai Besi', 'spaces and case');
select ar_test.ok(private.area_canonical('pj') = 'Petaling Jaya', 'alias');
select ar_test.ok(private.area_canonical('TTDI') = 'Taman Tun Dr Ismail', 'alias TTDI');
select ar_test.ok(private.area_canonical('Nowhere') is null, 'unknown area');

select ar_test.ok(not exists (select 1 from public.merchants where area is not null and private.area_canonical(area) is distinct from area), 'existing rows use listed names');

do $$
declare mid uuid; got text;
begin
  perform set_config('app.actor_type', 'system', true);
  select id into mid from public.merchants order by created_at limit 1;
  update public.merchants set area = 'kepong' where id = mid;
  select area into got from public.merchants where id = mid;
  perform ar_test.ok(got = 'Kepong', 'merchant area canonicalised');
  update public.merchants set area = '  ' where id = mid;
  select area into got from public.merchants where id = mid;
  perform ar_test.ok(got is null, 'blank area becomes null');
  perform ar_test.err(format('update public.merchants set area = %L where id = %L', 'Atlantis', mid), 'unknown merchant area refused');
  update public.areas set is_active = false where name = 'Kepong';
  perform ar_test.err(format('update public.merchants set area = %L where id = %L', 'Kepong', mid), 'inactive area refused');
  update public.areas set is_active = true where name = 'Kepong';
end $$;

do $$
declare mid uuid; uid uuid; got text;
begin
  select id into mid from public.merchants order by created_at limit 1;
  uid := gen_random_uuid();
  insert into public.merchant_basics_requests (merchant_id, changes, base, submitted_by, status)
  values (mid, '{"location": {"address": "1 Jalan Test", "area": "pj"}}', '{}', uid, 'withdrawn')
  returning changes -> 'location' ->> 'area' into got;
  perform ar_test.ok(got = 'Petaling Jaya', 'request area canonicalised');
  perform ar_test.err(format('insert into public.merchant_basics_requests (merchant_id, changes, base, submitted_by, status) values (%L, %L, %L, %L, %L)',
    mid, '{"location": {"address": "1 Jalan Test", "area": "Atlantis"}}', '{}', uid, 'withdrawn'), 'unknown request area refused');
end $$;

set local role anon;
select ar_test.ok((select count(*) from public.areas) >= 30, 'anon reads the list');
reset role;
update public.areas set is_active = false where name = 'Kepong';
set local role anon;
select ar_test.ok(not exists (select 1 from public.areas where name = 'Kepong'), 'anon cannot see inactive areas');
reset role;

select 'areas behaviour tests passed' as result;
