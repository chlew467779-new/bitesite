/* bitesite/app/api/admin/menu-categories/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

const MAX_BODY_BYTES = 16 * 1024;
const NAME_MAX_LENGTH = 120;

function bodyErrorResponse(error: unknown) {
  if (error instanceof RequestBodyTooLargeError) {
    return NextResponse.json({ error: error.message }, { status: 413 });
  }
  if (error instanceof InvalidJsonBodyError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}

function verifyToken(request: NextRequest): boolean {
  const token = request.headers.get('x-admin-token');
  return !!token && verifyAdminToken(token);
}

/**
 * Categories are always scoped to a merchant. Every read and write below is filtered by
 * merchant_id (never trusting a bare category `id` alone for an update/delete), so the Admin
 * Menu Editor for one merchant can never read or mutate another merchant's categories even if
 * a stale or crafted id is submitted — this is the "merchant isolation" requirement, enforced
 * at the application layer because categories/products only carry a public-read RLS policy;
 * writes always go through this service-role route.
 */

export async function GET(request: NextRequest) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchant_id');
  if (!merchantId) {
    return NextResponse.json({ error: 'merchant_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ categories: data || [] });
}

export async function POST(request: NextRequest) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await readBoundedJson<Record<string, unknown>>(request, MAX_BODY_BYTES);

    if (typeof body.merchant_id !== 'string' || !body.merchant_id.trim()) {
      return NextResponse.json({ error: 'merchant_id is required' }, { status: 400 });
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (body.name.length > NAME_MAX_LENGTH) {
      return NextResponse.json({ error: `name must be ${NAME_MAX_LENGTH} characters or fewer` }, { status: 400 });
    }
    let sortOrder = 0;
    if (body.sort_order !== undefined && body.sort_order !== null) {
      const numeric = Number(body.sort_order);
      if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        return NextResponse.json({ error: 'sort_order must be an integer' }, { status: 400 });
      }
      sortOrder = numeric;
    }

    // Confirm the merchant actually exists before attaching a category to it.
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, slug')
      .eq('id', body.merchant_id)
      .single();
    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({ merchant_id: body.merchant_id, name: body.name.trim(), sort_order: sortOrder })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath(`/store/${merchant.slug}`);

    return NextResponse.json({ category: data }, { status: 201 });
  } catch (error) {
    const bodyError = bodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Menu categories POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await readBoundedJson<Record<string, unknown>>(request, MAX_BODY_BYTES);
    const { id, merchant_id: merchantId } = body;

    if (typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (typeof merchantId !== 'string' || !merchantId.trim()) {
      return NextResponse.json({ error: 'merchant_id is required' }, { status: 400 });
    }

    // Isolation check: the category must already belong to this merchant_id.
    const { data: existing, error: existingError } = await supabase
      .from('categories')
      .select('id, merchant_id')
      .eq('id', id)
      .single();
    if (existingError || !existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    if (existing.merchant_id !== merchantId) {
      return NextResponse.json({ error: 'Category does not belong to this merchant' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }
      if (body.name.length > NAME_MAX_LENGTH) {
        return NextResponse.json({ error: `name must be ${NAME_MAX_LENGTH} characters or fewer` }, { status: 400 });
      }
      updateData.name = body.name.trim();
    }
    if (body.sort_order !== undefined) {
      const numeric = Number(body.sort_order);
      if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        return NextResponse.json({ error: 'sort_order must be an integer' }, { status: 400 });
      }
      updateData.sort_order = numeric;
    }

    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: merchant } = await supabase.from('merchants').select('slug').eq('id', merchantId).single();
    if (merchant?.slug) revalidatePath(`/store/${merchant.slug}`);

    return NextResponse.json({ category: data });
  } catch (error) {
    const bodyError = bodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Menu categories PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const merchantId = searchParams.get('merchant_id');

  if (!id || !merchantId) {
    return NextResponse.json({ error: 'id and merchant_id are required' }, { status: 400 });
  }

  // Isolation check: only delete a category that actually belongs to this merchant_id.
  const { data: existing, error: existingError } = await supabase
    .from('categories')
    .select('id, merchant_id')
    .eq('id', id)
    .single();
  if (existingError || !existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }
  if (existing.merchant_id !== merchantId) {
    return NextResponse.json({ error: 'Category does not belong to this merchant' }, { status: 403 });
  }

  // products.category_id has ON DELETE CASCADE at the DB level, which would silently delete
  // every product in this category along with it. Master Spec §23 says "do not delete history
  // unnecessarily" — a category disappearing should not take its dishes with it, so move
  // affected products to "uncategorized" (category_id = null) before deleting the category.
  const { error: detachError } = await supabase
    .from('products')
    .update({ category_id: null })
    .eq('category_id', id)
    .eq('merchant_id', merchantId);
  if (detachError) {
    console.error('Menu category product detach error:', detachError);
    return NextResponse.json({ error: 'Unable to detach products from category' }, { status: 500 });
  }

  const { error } = await supabase.from('categories').delete().eq('id', id).eq('merchant_id', merchantId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: merchant } = await supabase.from('merchants').select('slug').eq('id', merchantId).single();
  if (merchant?.slug) revalidatePath(`/store/${merchant.slug}`);

  return NextResponse.json({ success: true });
}
