import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (body.kind !== 'story') return NextResponse.json({ error: 'Only Story media uploads are supported' }, { status: 400 });
    if (typeof body.contentType !== 'string' || !MIME_TYPES.has(body.contentType)) return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are supported' }, { status: 400 });
    if (typeof body.size !== 'number' || body.size <= 0 || body.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be smaller than 5MB' }, { status: 413 });
    const { data: membership, error: membershipError } = await supabase.from('merchant_memberships').select('merchant:merchants(slug)').eq('user_id', userData.user.id).eq('status', 'active').limit(1).maybeSingle();
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
    const merchantValue = membership?.merchant as { slug: string } | { slug: string }[] | null | undefined;
    const merchant = Array.isArray(merchantValue) ? merchantValue[0] : merchantValue;
    if (!merchant) return NextResponse.json({ error: 'No active merchant membership' }, { status: 404 });
    const extension = body.contentType === 'image/jpeg' ? 'jpg' : body.contentType.split('/')[1];
    const path = `merchant/${merchant.slug}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await supabase.storage.from('story-media').createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || 'Storage is not configured' }, { status: 503 });
    return NextResponse.json({ bucket: 'story-media', path, token: data.token, maxBytes: MAX_BYTES });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
