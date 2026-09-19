/* bitesite/app/api/admin/story-submissions/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

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
    const body = await request.json();
    const channel: Channel = validEnum(body.channel, channels) ? body.channel : 'admin_relayed';
    const status: Status = validEnum(body.status, statuses) ? body.status : 'draft';
    if (!body.title || !body.content) return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
    if (status === 'pending_review' && body.rights_declared !== true) {
      return NextResponse.json({ error: 'Rights declaration is required before submission' }, { status: 400 });
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
      image_urls: Array.isArray(body.image_urls) ? body.image_urls.slice(0, 3) : [],
      rights_declared: body.rights_declared === true,
      rights_note: body.rights_note || null,
      submitted_by: body.submitted_by || 'admin',
      review_notes: body.review_notes || null,
      submitted_at: status === 'pending_review' ? now : null,
      updated_at: now,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ submission: data, success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = authError(request);
  if (denied) return denied;

  try {
    const body = await request.json();
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
    const { data, error } = await supabase.from('story_submissions').update(updateData).eq('id', body.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ submission: data, success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
