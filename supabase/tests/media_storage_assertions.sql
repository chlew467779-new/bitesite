-- Public image-storage assertions.
-- Read-only and safe to run on staging and production after 20260920000900.

do $$
declare
  bucket record;
  expected_mime_types text[] := array['image/jpeg', 'image/png', 'image/webp'];
  bad text := '';
begin
  for bucket in
    select id, public, file_size_limit, allowed_mime_types
    from storage.buckets
    where id in ('merchant-media', 'story-media')
  loop
    if not bucket.public then
      bad := bad || format(' [%s is not public]', bucket.id);
    end if;
    if bucket.file_size_limit <> 5242880 then
      bad := bad || format(' [%s file size limit is %s, expected 5242880]', bucket.id, bucket.file_size_limit);
    end if;
    if not (
      coalesce(bucket.allowed_mime_types, array[]::text[]) @> expected_mime_types
      and expected_mime_types @> coalesce(bucket.allowed_mime_types, array[]::text[])
    ) then
      bad := bad || format(' [%s MIME restrictions do not match the signed-upload APIs]', bucket.id);
    end if;
  end loop;

  if (select count(*) from storage.buckets where id in ('merchant-media', 'story-media')) <> 2 then
    bad := bad || ' [expected public image buckets are missing]';
  end if;

  if bad <> '' then
    raise exception 'MEDIA STORAGE ASSERTIONS FAILED:%', bad;
  end if;
end $$;

select 'ALL MEDIA STORAGE ASSERTIONS PASSED' as result;
