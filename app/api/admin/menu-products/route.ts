/* bitesite/app/api/admin/menu-products/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

const MAX_BODY_BYTES = 32 * 1024;
const NAME_MAX_LENGTH = 160;
const DESCRIPTION_MAX_LENGTH = 2000;
const MAX_PRICE = 100000; // sanity ceiling; matches numeric(10,2) headroom without inviting typos like an extra zero

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

function isValidHttpUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parsePrice(value: unknown, field: string): { value: number | null; error: string | null } {
  if (value === undefined || value === null || value === '') return { value: null, error: null };
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > MAX_PRICE) {
    return { value: null, error: `${field} must be a number between 0 and ${MAX_PRICE}` };
  }
  return { value: Math.round(numeric * 100) / 100, error: null };
}

interface ProductPayloadValidation {
  error: string | null;
  name?: string;
  description?: string | null;
  price?: number | null;
  discountPrice?: number | null;
  imageUrl?: string | null;
  sortOrder?: number;
}

/**
 * Shared validation for POST (all fields required) and PUT (only present fields are checked —
 * the caller decides which keys end up in the update payload). Mirrors the rigor of
 * validateMerchantPayload in app/api/admin/merchants-crud/route.ts: explicit type checks,
 * length limits, and numeric bounds rather than trusting client-side validation alone.
 */
function validateProductPayload(body: Record<string, unknown>, requireName: boolean): ProductPayloadValidation {
  if (requireName && (typeof body.name !== 'string' || !body.name.trim())) {
    return { error: 'name is required' };
  }
  if (body.name !== undefined && typeof body.name !== 'string') {
    return { error: 'name must be a string' };
  }
  if (typeof body.name === 'string' && body.name.length > NAME_MAX_LENGTH) {
    return { error: `name must be ${NAME_MAX_LENGTH} characters or fewer` };
  }

  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    return { error: 'description must be a string' };
  }
  if (typeof body.description === 'string' && body.description.length > DESCRIPTION_MAX_LENGTH) {
    return { error: `description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer` };
  }

  const price = parsePrice(body.price, 'price');
  if (price.error) return { error: price.error };
  const discountPrice = parsePrice(body.discount_price, 'discount_price');
  if (discountPrice.error) return { error: discountPrice.error };
  if (price.value !== null && discountPrice.value !== null && discountPrice.value > price.value) {
    return { error: 'discount_price cannot be greater than price' };
  }

  if (body.image_url !== undefined && body.image_url !== null) {
    if (typeof body.image_url !== 'string') return { error: 'image_url must be a string' };
    if (body.image_url.trim() && !isValidHttpUrl(body.image_url)) {
      return { error: 'image_url must start with http:// or https://' };
    }
  }

  let sortOrder: number | undefined;
  if (body.sort_order !== undefined && body.sort_order !== null) {
    const numeric = Number(body.sort_order);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
      return { error: 'sort_order must be an integer' };
    }
    sortOrder = numeric;
  }

  for (const field of ['is_available', 'is_featured', 'show_prices'] as const) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      return { error: `${field} must be a boolean` };
    }
  }

  return {
    error: null,
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    description: body.description === undefined ? undefined : (body.description as string | null)?.toString().trim() || null,
    price: price.value,
    discountPrice: discountPrice.value,
    imageUrl: body.image_url === undefined ? undefined : (body.image_url as string).trim() || null,
    sortOrder,
  };
}

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
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data || [] });
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

    const validation = validateProductPayload(body, true);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, slug')
      .eq('id', body.merchant_id)
      .single();
    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // category_id isolation: a product can only be filed under a category that belongs to the
    // same merchant — otherwise this endpoint could be used to attach a dish to another
    // merchant's category and have it render on the wrong public menu.
    if (body.category_id !== undefined && body.category_id !== null) {
      if (typeof body.category_id !== 'string') {
        return NextResponse.json({ error: 'category_id must be a string' }, { status: 400 });
      }
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id, merchant_id')
        .eq('id', body.category_id)
        .single();
      if (categoryError || !category || category.merchant_id !== body.merchant_id) {
        return NextResponse.json({ error: 'category_id does not belong to this merchant' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        merchant_id: body.merchant_id,
        category_id: body.category_id || null,
        name: validation.name,
        description: validation.description ?? null,
        price: validation.price,
        discount_price: validation.discountPrice,
        image_url: validation.imageUrl ?? null,
        is_available: body.is_available === undefined ? true : body.is_available,
        is_featured: body.is_featured === undefined ? false : body.is_featured,
        show_prices: body.show_prices === undefined ? true : body.show_prices,
        sort_order: validation.sortOrder ?? 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath(`/store/${merchant.slug}`);

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    const bodyError = bodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Menu products POST error:', error);
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

    // Isolation check: the product must already belong to this merchant_id.
    const { data: existing, error: existingError } = await supabase
      .from('products')
      .select('id, merchant_id')
      .eq('id', id)
      .single();
    if (existingError || !existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (existing.merchant_id !== merchantId) {
      return NextResponse.json({ error: 'Product does not belong to this merchant' }, { status: 403 });
    }

    const validation = validateProductPayload(body, false);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (body.category_id !== undefined && body.category_id !== null) {
      if (typeof body.category_id !== 'string') {
        return NextResponse.json({ error: 'category_id must be a string' }, { status: 400 });
      }
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id, merchant_id')
        .eq('id', body.category_id)
        .single();
      if (categoryError || !category || category.merchant_id !== merchantId) {
        return NextResponse.json({ error: 'category_id does not belong to this merchant' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validation.name !== undefined) updateData.name = validation.name;
    if (body.description !== undefined) updateData.description = validation.description ?? null;
    if (body.price !== undefined) updateData.price = validation.price;
    if (body.discount_price !== undefined) updateData.discount_price = validation.discountPrice;
    if (body.image_url !== undefined) updateData.image_url = validation.imageUrl ?? null;
    if (body.category_id !== undefined) updateData.category_id = body.category_id || null;
    if (body.is_available !== undefined) updateData.is_available = body.is_available;
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
    if (body.show_prices !== undefined) updateData.show_prices = body.show_prices;
    if (validation.sortOrder !== undefined) updateData.sort_order = validation.sortOrder;

    const { data, error } = await supabase
      .from('products')
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

    return NextResponse.json({ product: data });
  } catch (error) {
    const bodyError = bodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Menu products PUT error:', error);
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

  const { data: existing, error: existingError } = await supabase
    .from('products')
    .select('id, merchant_id')
    .eq('id', id)
    .single();
  if (existingError || !existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  if (existing.merchant_id !== merchantId) {
    return NextResponse.json({ error: 'Product does not belong to this merchant' }, { status: 403 });
  }

  const { error } = await supabase.from('products').delete().eq('id', id).eq('merchant_id', merchantId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: merchant } = await supabase.from('merchants').select('slug').eq('id', merchantId).single();
  if (merchant?.slug) revalidatePath(`/store/${merchant.slug}`);

  return NextResponse.json({ success: true });
}
