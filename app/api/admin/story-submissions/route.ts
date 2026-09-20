/* bitesite/app/api/admin/story-submissions/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

const MAX_SUBMISSION_BODY_BYTES = 512 * 1024;

const channels = ['self_service_form', 'admin_relayed'] as const;
const statuses = ['draft', 'pending_review', 'approved', 'rejected', 'archived', 'converted'] as const;
type Channel = typeof channels[number];
type Status = typeof statuses[number];

function authError(request: Request) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function validEnum<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function validHttpUrl(value: unknown) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function makeSlug(title: string, existing: string[]) {
  const base = title.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const safe = base || 'story';
  if (!existing.includes(safe)) return safe;
  let i = 1;
  while (existing.includes(`${safe}-${i}`)) i += 1;
  return `${safe}-${i}`;
}

export async function GET(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const status = params.get('status');
  const merchantSlug = params.get('merchant_slug');
  if (status && !validEnum(status, statuses)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  let query = supabase.from('story_submissions').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (merchantSlug) query = query.eq('merchant_slug', merchantSlug);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data || [] });
}

export async function POST(request: Request) {
  const denied = authError(request);
  if (denied) return denied;

  try {
    const body = await readBoundedJson(request, MAX_SUBMISSION_BODY_BYTES);
    const channel: Channel = validEnum(body.channel, channels) ? body.channel : 'admin_relayed';
    const status: Status = validEnum(body.status, statuses) ? body.status : 'draft';
    if (!body.title || !body.content) return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
    if (status === 'pending_review' && body.rights_declared !== true) {
      return NextResponse.json({ error: 'Rights declaration is required before submission' }, { status: 400 });
    }
    const imageUrls = Array.isArray(body.image_urls) ? body.image_urls.filter(Boolean) : [];
    if (!validHttpUrl(body.cover_image) || imageUrls.length > 3 || imageUrls.some((url: unknown) => !validHttpUrl(url))) {
      return NextResponse.json({ error: 'Use valid http(s) image URLs and no more than three gallery images' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase.from('story_submissions').insert({
      article_id: body.article_id || null,
      merchant_slug: body.merchant_slug || null,
      channel,
      status,
      title: body.title,
      excerpt: body.excerpt || null,
      content: body.content,
      story_angle: body.story_angle || null,
      facts: body.facts && typeof body.facts === 'object' ? body.facts : {},
      cover_image: body.cover_image || null,
      image_urls: imageUrls,
      rights_declared: body.rights_declared === true,
      ai_assistance_requested: body.ai_assistance_requested === true,
      rights_note: body.rights_note || null,
      submitted_by: body.submitted_by || 'admin',
      review_notes: body.review_notes || null,
      submitted_at: status === 'pending_review' ? now : null,
      updated_at: now,
    }).select().single();
    if (error) {
      if (error.code === '23505' && status === 'pending_review') return NextResponse.json({ error: 'This merchant already has a Story awaiting review' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ submission: data, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof InvalidJsonBodyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = authError(request);
  if (denied) return denied;

  try {
    const body = await readBoundedJson(request, MAX_SUBMISSION_BODY_BYTES);
    if (!body.id || !validEnum(body.status, statuses)) return NextResponse.json({ error: 'id and valid status are required' }, { status: 400 });
    if (body.status === 'pending_review' && body.rights_declared !== true) return NextResponse.json({ error: 'Rights declaration is required before submission' }, { status: 400 });
    const updateData: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString() };
    for (const key of ['review_notes', 'reviewed_by', 'article_id', 'rights_declared']) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    if (body.status === 'pending_review') updateData.submitted_at = new Date().toISOString();
    if (['approved', 'rejected', 'archived', 'converted'].includes(body.status)) {
      updateData.reviewed_at = new Date().toISOString();
      updateData.reviewed_by = body.reviewed_by || 'admin';
    }
    if (body.status === 'converted') {
      const { data: source, error: sourceError } = await supabase.from('story_submissions').select('*').eq('id', body.id).single();
      if (sourceError || !source) return NextResponse.json({ error: sourceError?.message || 'Submission not found' }, { status: 404 });
      if (!source.rights_declared) return NextResponse.json({ error: 'Rights declaration is required before conversion' }, { status: 400 });
      const publishVersion = body.publish_version === 'ai' ? 'ai' : 'original';
      const aiCopy = source.generated_copy && typeof source.generated_copy === 'object' ? source.generated_copy as { title?: unknown; excerpt?: unknown; content?: unknown } : null;
      if (publishVersion === 'ai' && (!aiCopy || typeof aiCopy.title !== 'string' || typeof aiCopy.excerpt !== 'string' || typeof aiCopy.content !== 'string' || !aiCopy.content.trim())) {
        return NextResponse.json({ error: 'Generate and review an AI draft before publishing the AI version' }, { status: 400 });
      }
      if (body.publish === true && source.article_id) {
        const publishedAt = new Date().toISOString();
        const versionFields = publishVersion === 'ai' ? { title: aiCopy?.title, excerpt: aiCopy?.excerpt, content: aiCopy?.content } : {};
        const { data: article, error: publishError } = await supabase.from('articles').update({
          ...versionFields,
          published: true,
          editorial_status: 'published',
          published_at: publishedAt,
          review_notes: body.review_notes || null,
          reviewed_at: publishedAt,
          reviewed_by: body.reviewed_by || 'admin',
        }).eq('id', source.article_id).select().single();
        if (publishError || !article) return NextResponse.json({ error: publishError?.message || 'Could not publish linked Story' }, { status: 500 });
        const { error: revisionError } = await supabase.from('article_revisions').insert({ article_id: article.id, action: 'published', snapshot: article, actor: body.reviewed_by || 'admin', note: body.review_notes || `Published ${publishVersion} version from Story submission review.` });
        if (revisionError) return NextResponse.json({ error: revisionError.message }, { status: 500 });
        const { data: published, error: conversionError } = await supabase.from('story_submissions').update(updateData).eq('id', body.id).select().single();
        if (conversionError) return NextResponse.json({ error: conversionError.message }, { status: 500 });
        revalidatePath('/stories');
        revalidatePath(`/stories/${article.slug}`);
        return NextResponse.json({ submission: published, article, success: true });
      }
      const { data: existing } = await supabase.from('articles').select('slug');
      const slug = makeSlug(source.title, (existing || []).map((item) => item.slug));
      const gallery = Array.isArray(source.image_urls)
        ? source.image_urls.map((url: string, index: number) => `![${source.title} image ${index + 1}](${url})`).join('\n\n')
        : '';
      const publishImmediately = body.publish === true;
      const publishedAt = publishImmediately ? new Date().toISOString() : null;
      const title = publishVersion === 'ai' ? String(aiCopy?.title) : source.title;
      const excerpt = publishVersion === 'ai' ? String(aiCopy?.excerpt) : source.excerpt || null;
      const content = publishVersion === 'ai' ? String(aiCopy?.content) : gallery ? `${source.content}\n\n${gallery}` : source.content;
      const { data: article, error: articleError } = await supabase.from('articles').insert({
        slug,
        title,
        excerpt,
        content,
        cover_image: source.cover_image || null,
        category: 'Merchant Story',
        tags: [],
        merchant_slug: source.merchant_slug || null,
        author: 'BiteSite Team',
        published: publishImmediately,
        editorial_status: publishImmediately ? 'published' : 'draft',
        published_at: publishedAt,
        rights_declared: true,
        review_notes: source.review_notes || null,
        background_style: 'default',
      }).select().single();
      if (articleError || !article) return NextResponse.json({ error: articleError?.message || 'Failed to create Story draft' }, { status: 500 });
      const { error: revisionError } = await supabase.from('article_revisions').insert({
        article_id: article.id,
        action: publishImmediately ? 'published' : 'created',
        snapshot: article,
        actor: 'admin',
        note: publishImmediately ? `Published ${publishVersion} version from Story submission ${source.id}` : `Created from Story submission ${source.id}`,
      });
      if (revisionError) {
        await supabase.from('articles').delete().eq('id', article.id);
        return NextResponse.json({ error: revisionError.message }, { status: 500 });
      }
      if (source.merchant_slug) {
        const { error: cycleError } = await supabase
          .from('merchant_content_cycles')
          .update({ last_submission_id: source.id, updated_at: new Date().toISOString() })
          .eq('merchant_slug', source.merchant_slug)
          .in('status', ['active', 'due', 'overdue']);
        if (cycleError) console.error('Content cycle link error:', cycleError);
      }
      updateData.article_id = article.id;
      const { data: converted, error: conversionError } = await supabase.from('story_submissions').update(updateData).eq('id', body.id).select().single();
      if (conversionError) return NextResponse.json({ error: conversionError.message }, { status: 500 });
      if (publishImmediately) {
        revalidatePath('/stories');
        revalidatePath(`/stories/${article.slug}`);
      }
      return NextResponse.json({ submission: converted, article, success: true });
    }
    const { data, error } = await supabase.from('story_submissions').update(updateData).eq('id', body.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data.article_id) {
      const editorialStatus = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : body.status === 'draft' ? 'draft' : null;
      if (editorialStatus) {
        const { data: article, error: articleError } = await supabase.from('articles')
          .update({ editorial_status: editorialStatus, review_notes: body.review_notes || null, reviewed_at: new Date().toISOString(), reviewed_by: body.reviewed_by || 'admin' })
          .eq('id', data.article_id).select().single();
        if (articleError || !article) return NextResponse.json({ error: articleError?.message || 'Could not update linked article' }, { status: 500 });
        const action = editorialStatus === 'approved' ? 'approved' : editorialStatus === 'rejected' ? 'rejected' : 'updated';
        const { error: revisionError } = await supabase.from('article_revisions').insert({ article_id: article.id, action, snapshot: article, actor: body.reviewed_by || 'admin', note: body.review_notes || null });
        if (revisionError) return NextResponse.json({ error: revisionError.message }, { status: 500 });
      }
    }
    return NextResponse.json({ submission: data, success: true });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof InvalidJsonBodyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
