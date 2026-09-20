import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

const specs = {
  merchant: { bucket: 'merchant-media', maxBytes: 5 * 1024 * 1024 },
  story: { bucket: 'story-media', maxBytes: 5 * 1024 * 1024 },
  menu: { bucket: 'merchant-media', maxBytes: 2 * 1024 * 1024 },
} as const;
const mimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const spec = specs[body.kind as keyof typeof specs];
    if (!spec) return NextResponse.json({ error: 'Invalid media kind' }, { status: 400 });
    if (typeof body.contentType !== 'string' || !mimeTypes.has(body.contentType)) return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are supported' }, { status: 400 });
    if (typeof body.size !== 'number' || body.size <= 0 || body.size > spec.maxBytes) return NextResponse.json({ error: `Image must be smaller than ${Math.round(spec.maxBytes / 1024 / 1024)}MB` }, { status: 413 });
    const extension = body.contentType === 'image/jpeg' ? 'jpg' : body.contentType.split('/')[1];
    const path = `admin/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await supabase.storage.from(spec.bucket).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || 'Storage is not configured' }, { status: 503 });
    return NextResponse.json({ bucket: spec.bucket, path, token: data.token, maxBytes: spec.maxBytes });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
