-- Keep the storage layer aligned with the signed-upload APIs.
-- Existing objects remain available; this only restricts future uploads.
begin;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id in ('merchant-media', 'story-media');

do $$
begin
  if (select count(*) from storage.buckets where id in ('merchant-media', 'story-media')) <> 2 then
    raise exception 'Expected merchant-media and story-media buckets before aligning upload restrictions';
  end if;
end $$;

commit;
