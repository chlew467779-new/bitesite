/* bitesite/app/api/admin/stories/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import { revalidatePath } from 'next/cache';

function verifyRequest(request: Request) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

function generateSlug(title: string, existingSlugs: string[]): string {
  let base = title
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
    .replace(/^-|-$/g, '');

  if (!base) base = 'story';

  if (!existingSlugs.includes(base)) return base;

  let counter = 1;
  while (existingSlugs.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

type EditorialStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected' | 'archived';

function normalizeEditorialStatus(value: unknown, published: boolean): EditorialStatus {
  if (typeof value === 'string' && ['draft', 'pending_review', 'approved', 'published', 'rejected', 'archived'].includes(value)) {
    return value as EditorialStatus;
  }
  return published ? 'published' : 'draft';
}

async function recordRevision(article: Record<string, unknown>, action: string, note?: unknown) {
  const { error } = await supabase.from('article_revisions').insert({
    article_id: article.id,
    action,
    snapshot: article,
    actor: 'admin',
    note: typeof note === 'string' ? note : null,
  });
  if (error) console.error('Story revision audit error:', error);
}

// GET
export async function GET(request: NextRequest) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  try {
    if (slug) {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ article: data });
    }

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ articles: data });
  } catch (err) {
    console.error('Stories GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST
export async function POST(request: Request) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    if (!body.title || !body.content || !body.category) {
      return NextResponse.json(
        { error: 'title, content, and category are required' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from('articles')
      .select('slug');

    const existingSlugs = (existing || []).map((a) => a.slug);
    const slug = body.slug || generateSlug(body.title, existingSlugs);

    const now = new Date().toISOString();
    const published = body.published ?? false;
    const editorialStatus = normalizeEditorialStatus(body.editorial_status, published);

    if (editorialStatus === 'pending_review' && body.rights_declared !== true) {
      return NextResponse.json({ error: 'Rights declaration is required before submitting a Story for review' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('articles')
      .insert({
        slug,
        title: body.title,
        excerpt: body.excerpt || null,
        content: body.content,
        cover_image: body.cover_image || null,
        category: body.category,
        tags: body.tags || [],
        merchant_slug: body.merchant_slug || null,
        author: body.author || 'BiteSite Team',
        published: editorialStatus === 'published',
        editorial_status: editorialStatus,
        rights_declared: body.rights_declared === true ? true : null,
        review_notes: body.review_notes || null,
        submitted_at: editorialStatus === 'pending_review' ? now : null,
        published_at: editorialStatus === 'published' ? now : null,
        background_style: body.background_style || 'default',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordRevision(data, editorialStatus === 'published' ? 'published' : editorialStatus === 'pending_review' ? 'submitted' : 'created');

    // Revalidate immediately
    revalidatePath(`/stories/${data.slug}`);
    revalidatePath('/stories');

    return NextResponse.json({ article: data, success: true }, { status: 201 });
  } catch (err) {
    console.error('Stories POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PUT
export async function PUT(request: Request) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, slug, editorial_status, ...updates } = body;

    if (!id && !slug) {
      return NextResponse.json(
        { error: 'id or slug required for update' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (editorial_status !== undefined || updates.published !== undefined) {
      const status = normalizeEditorialStatus(editorial_status, updates.published === true);
      if (status === 'pending_review' && updates.rights_declared !== true) {
        return NextResponse.json({ error: 'Rights declaration is required before submitting a Story for review' }, { status: 400 });
      }
      updateData.editorial_status = status;
      updateData.published = status === 'published';
      if (status === 'pending_review') updateData.submitted_at = new Date().toISOString();
      if (status === 'published') updateData.published_at = new Date().toISOString();
      if (['approved', 'rejected', 'archived'].includes(status)) updateData.reviewed_at = new Date().toISOString();
    }

    if (typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);
    }

    if (updateData.merchant_slug === '') {
      updateData.merchant_slug = null;
    }

    let query = supabase.from('articles').update(updateData);

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', slug);
    }

    const { data, error } = await query.select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const action = data.editorial_status === 'published'
      ? 'published'
      : data.editorial_status === 'pending_review'
        ? 'submitted'
        : data.editorial_status === 'approved'
          ? 'approved'
          : data.editorial_status === 'rejected'
            ? 'rejected'
            : data.editorial_status === 'archived'
              ? 'archived'
              : 'updated';
    await recordRevision(data, action, data.review_notes);

    // Revalidate immediately
    revalidatePath(`/stories/${data.slug}`);
    revalidatePath('/stories');

    return NextResponse.json({ article: data, success: true });
  } catch (err) {
    console.error('Stories PUT error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request: NextRequest) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('slug', slug);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Revalidate immediately
    revalidatePath(`/stories/${slug}`);
    revalidatePath('/stories');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Stories DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
