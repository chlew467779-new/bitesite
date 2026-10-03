-- Assertions for 20261003130000_menu_photos_bucket.sql. One transaction, rolled back at the end.
-- Run after the migration: the bucket is private, and anon / authenticated cannot see its files.
begin;

do $$
declare
  b storage.buckets;
begin
  select * into b from storage.buckets where id = 'menu-photos';
  if not found then raise exception 'menu-photos bucket missing'; end if;
  if b.public then raise exception 'menu-photos must be private'; end if;
  if b.file_size_limit is distinct from 10485760 then raise exception 'menu-photos size limit should be 10 MB, is %', b.file_size_limit; end if;
  if b.allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp'] then raise exception 'menu-photos must accept images only'; end if;
end $$;

-- A file in the bucket (as the table owner), then look for it as the public roles.
insert into storage.objects (bucket_id, name) values ('menu-photos', '00000000-0000-4000-8000-000000000001/test.jpg');

set local role anon;
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'menu-photos') then
    raise exception 'anon can see menu photos';
  end if;
end $$;
reset role;

set local role authenticated;
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'menu-photos') then
    raise exception 'signed-in users can see menu photos';
  end if;
end $$;
reset role;

do $$ begin raise notice 'menu-photos bucket assertions passed'; end $$;
rollback;
