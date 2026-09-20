-- Migration: Storage Buckets
-- Creates merchant-media and story-media public buckets
-- with file size limits, MIME type restrictions, and RLS policies.
--
-- Compression note: client-side via browser-image-compression before upload.
-- Menu photos: max 800px longest side, ~60 KB target, JPEG quality 0.70
-- Gallery photos: max 1200px, ~150 KB target, quality 0.80
-- Story cover: max 1200px, ~200 KB target, quality 0.82
-- Story general: max 1920px, ~300 KB target, quality 0.82

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'merchant-media',
    'merchant-media',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'story-media',
    'story-media',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "merchant_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'merchant-media');

CREATE POLICY "merchant_media_service_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'merchant-media' AND auth.role() = 'service_role');

CREATE POLICY "merchant_media_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'merchant-media' AND auth.role() = 'service_role');

CREATE POLICY "merchant_media_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'merchant-media' AND auth.role() = 'service_role');

CREATE POLICY "story_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-media');

CREATE POLICY "story_media_service_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'story-media' AND auth.role() = 'service_role');

CREATE POLICY "story_media_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'story-media' AND auth.role() = 'service_role');

CREATE POLICY "story_media_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'story-media' AND auth.role() = 'service_role');
