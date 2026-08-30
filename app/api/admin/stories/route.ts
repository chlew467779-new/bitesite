/* bitesite/app/api/admin/stories/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

// GET — 列表或单个
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

// POST — 新建
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
        published: body.published ?? false,
        background_style: body.background_style || 'default',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ article: data, success: true }, { status: 201 });
  } catch (err) {
    console.error('Stories POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PUT — 更新
export async function PUT(request: Request) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, slug, ...updates } = body;

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

    return NextResponse.json({ article: data, success: true });
  } catch (err) {
    console.error('Stories PUT error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE — 删除
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Stories DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
