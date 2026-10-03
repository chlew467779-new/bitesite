import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { requireMerchantAccess } from '@/app/api/merchant/_lib/merchant-access';
import { mapFieldRpcError } from '@/lib/merchant-field-patch-core.mjs';
import { publicStoryPath } from '@/lib/story-submission-core.mjs';

const MAX_BODY_BYTES = 512 * 1024;

function validUrl(value: unknown) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

// Story submissions belong to the verified restaurant by merchant_id (kept in sync with
// merchant_slug by the database); both come from the verified merchant, never from the request.
export async function GET(request: NextRequest) {
  const context = await requireMerchantAccess(request, 'read');
  if ('response' in context) return context.response;
  const { data, error } = await supabase.from('story_submissions').select('id, title, excerpt, content, story_angle, cover_image, image_urls, rights_declared, rights_note, status, review_notes, submitted_at, created_at, updated_at, article:articles(slug, published, editorial_status)').eq('merchant_id', context.merchant.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // The owner gets only the public address of a published Story, never a draft's state or slug.
  const submissions = (data || []).map(({ article, ...item }) => ({ ...item, story_path: item.status === 'converted' ? publicStoryPath(Array.isArray(article) ? article[0] : article) : null }));
  return NextResponse.json({ submissions });
}

export async function POST(request: NextRequest) {
  const context = await requireMerchantAccess(request, 'write');
  if ('response' in context) return context.response;
  try {
    const body = await readBoundedJson(request, MAX_BODY_BYTES);
    if (typeof body.title !== 'string' || !body.title.trim() || typeof body.content !== 'string' || !body.content.trim()) return NextResponse.json({ error: 'Title and story facts are required' }, { status: 400 });
    if (body.title.trim().length > 160 || body.content.trim().length > 20000 || (body.excerpt && String(body.excerpt).length > 500)) return NextResponse.json({ error: 'Story text exceeds the allowed length' }, { status: 400 });
    const imageUrls = Array.isArray(body.image_urls) ? body.image_urls.filter(Boolean) : [];
    if (!validUrl(body.cover_image) || imageUrls.length > 3 || imageUrls.some((url: unknown) => !validUrl(url))) return NextResponse.json({ error: 'Use valid http(s) image URLs and no more than three gallery images' }, { status: 400 });
    if (body.rights_declared !== true) return NextResponse.json({ error: 'Rights declaration is required before submission' }, { status: 400 });
    // D2-A: the insert runs in one database transaction that locks the restaurant and the
    // caller's Owner membership and rechecks both; the slug, channel, status, submitter and times
    // are set there, never taken from the request.
    const { data, error } = await supabase.rpc('merchant_story_submission_create', {
      p_user_id: context.user.id,
      p_merchant_id: context.merchant.id,
      p_submission: {
        title: body.title,
        excerpt: body.excerpt ? String(body.excerpt) : null,
        content: body.content,
        story_angle: body.story_angle ? String(body.story_angle) : null,
        facts: body.facts && typeof body.facts === 'object' && !Array.isArray(body.facts) ? body.facts : {},
        cover_image: body.cover_image || null,
        image_urls: imageUrls,
        rights_note: body.rights_note ? String(body.rights_note) : null,
        ai_assistance_requested: body.ai_assistance_requested === true,
      },
    });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'You already have a Story awaiting review' }, { status: 409 });
      const mapped = mapFieldRpcError(error);
      if (mapped.status === 500) console.error('merchant_story_submission_create failed:', error.message);
      return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
    }
    return NextResponse.json({ submission: data, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
