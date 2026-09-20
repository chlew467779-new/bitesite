import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

const MAX_BODY_BYTES = 512 * 1024;

function tokenFrom(request: NextRequest) {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
}

async function merchantContext(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data, error } = await supabase
    .from('merchant_memberships')
    .select('merchant:merchants(id, slug)')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  const merchantValue = data?.merchant as { id: string; slug: string } | { id: string; slug: string }[] | null | undefined;
  const merchant = Array.isArray(merchantValue) ? merchantValue[0] : merchantValue;
  if (!merchant) return { error: NextResponse.json({ error: 'No active merchant membership' }, { status: 404 }) };
  return { user: userData.user, merchant };
}

function validUrl(value: unknown) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export async function GET(request: NextRequest) {
  const context = await merchantContext(request);
  if (context.error) return context.error;
  const { data, error } = await supabase.from('story_submissions').select('id, title, excerpt, content, story_angle, cover_image, image_urls, rights_declared, rights_note, status, review_notes, submitted_at, created_at, updated_at').eq('merchant_slug', context.merchant.slug).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data || [] });
}

export async function POST(request: NextRequest) {
  const context = await merchantContext(request);
  if (context.error) return context.error;
  try {
    const body = await readBoundedJson(request, MAX_BODY_BYTES);
    if (typeof body.title !== 'string' || !body.title.trim() || typeof body.content !== 'string' || !body.content.trim()) return NextResponse.json({ error: 'Title and story facts are required' }, { status: 400 });
    if (body.title.trim().length > 160 || body.content.trim().length > 20000 || (body.excerpt && String(body.excerpt).length > 500)) return NextResponse.json({ error: 'Story text exceeds the allowed length' }, { status: 400 });
    const imageUrls = Array.isArray(body.image_urls) ? body.image_urls.filter(Boolean) : [];
    if (!validUrl(body.cover_image) || imageUrls.length > 3 || imageUrls.some((url: unknown) => !validUrl(url))) return NextResponse.json({ error: 'Use valid http(s) image URLs and no more than three gallery images' }, { status: 400 });
    if (body.rights_declared !== true) return NextResponse.json({ error: 'Rights declaration is required before submission' }, { status: 400 });
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('story_submissions').insert({
      merchant_slug: context.merchant.slug,
      channel: 'self_service_form',
      status: 'pending_review',
      title: body.title.trim(),
      excerpt: body.excerpt ? String(body.excerpt).trim() : null,
      content: body.content.trim(),
      story_angle: body.story_angle ? String(body.story_angle).trim() : null,
      facts: body.facts && typeof body.facts === 'object' && !Array.isArray(body.facts) ? body.facts : {},
      cover_image: body.cover_image || null,
      image_urls: imageUrls,
      rights_declared: true,
      rights_note: body.rights_note ? String(body.rights_note).trim() : null,
      submitted_by: context.user.id,
      submitted_at: now,
      updated_at: now,
    }).select().single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'You already have a Story awaiting review' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ submission: data, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
