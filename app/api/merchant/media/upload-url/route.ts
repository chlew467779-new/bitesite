import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantAccess } from '@/app/api/merchant/_lib/merchant-access';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_REQUEST_BYTES = 16 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  // Uploads are writes for the selected restaurant: suspended or archived restaurants get none.
  const context = await requireMerchantAccess(request, 'write');
  if ('response' in context) return context.response;
  const merchant = context.merchant;
  try {
    const body = await readBoundedJson(request, MAX_UPLOAD_REQUEST_BYTES);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    if (body.kind !== 'story' && body.kind !== 'merchant') return NextResponse.json({ error: 'Unsupported media upload kind' }, { status: 400 });
    // D2-B: profile photos (logo/cover) cannot be bound to the restaurant until trusted media
    // upload (M6b), so no upload ticket is issued for them. Story photo uploads are unchanged.
    if (body.kind === 'merchant') {
      return NextResponse.json({ error: 'Photo changes are not open yet. Your current photos stay as they are.', code: 'FIELD_NOT_WRITABLE' }, { status: 403 });
    }
    if (typeof body.contentType !== 'string' || !MIME_TYPES.has(body.contentType)) return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are supported' }, { status: 400 });
    if (!Number.isSafeInteger(body.size) || body.size <= 0 || body.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be smaller than 5MB' }, { status: 413 });
    const extension = body.contentType === 'image/jpeg' ? 'jpg' : body.contentType.split('/')[1];
    const bucket = 'story-media';
    const path = `merchant/${merchant.slug}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || 'Storage is not configured' }, { status: 503 });
    return NextResponse.json({ bucket, path, token: data.token, maxBytes: MAX_BYTES });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
