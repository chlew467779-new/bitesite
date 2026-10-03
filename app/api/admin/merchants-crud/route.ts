/* bitesite/app/api/admin/merchants-crud/route.ts */

/**
 * Admin restaurant list and creation.
 *
 * D2-B write cutover: restaurant fields are edited only through the field-level save contract
 * (PATCH /api/admin/merchants/[merchantId]/fields). The old whole-form PUT, which also wrote
 * publication state, links, images and the GrabFood link without a baseline, is retired, and
 * hard DELETE is closed until a reviewed governance operation exists (both 410
 * LEGACY_WRITE_RETIRED). POST creates only a hidden draft from a name (and optional slug);
 * everything else is filled in afterwards through the field contract.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { selectAllPages } from '@/lib/analytics-pagination.mjs';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

const MAX_CREATE_BODY_BYTES = 4 * 1024;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 64;
}

async function verifyToken(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('x-admin-token');
  if (!token) return false;
  return verifyAdminToken(token);
}

function retired(message: string) {
  return NextResponse.json({ error: message, code: 'LEGACY_WRITE_RETIRED' }, { status: 410 });
}

export async function GET(request: NextRequest) {
  try {
    if (!(await verifyToken(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: merchants, error: merchantsError } = await supabase
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false });

    if (merchantsError) {
      return NextResponse.json({ error: merchantsError.message }, { status: 500 });
    }

    const { data: products } = await supabase.from('products').select('merchant_id');
    const { data: grabFoodLinks } = await supabase.from('merchant_external_links').select('merchant_id, url').eq('link_type', 'grabfood').eq('is_active', true);
    const { data: views } = await selectAllPages(() => supabase
      .from('page_views')
      .select('slug')
      .eq('page_type', 'merchant')
      .eq('event_type', 'page_view'));

    const productCounts: Record<string, number> = {};
    products?.forEach((p) => {
      productCounts[p.merchant_id] = (productCounts[p.merchant_id] || 0) + 1;
    });

    const viewCounts: Record<string, number> = {};
    views?.forEach((v) => {
      if (v.slug) viewCounts[v.slug] = (viewCounts[v.slug] || 0) + 1;
    });

    const grabFoodByMerchant = new Map(grabFoodLinks?.map((link) => [link.merchant_id, link.url]));
    const enriched = merchants?.map((m) => ({
      ...m,
      grabfood_url: grabFoodByMerchant.get(m.id) || '',
      product_count: productCounts[m.id] || 0,
      view_count: viewCounts[m.slug] || 0,
    }));

    return NextResponse.json({ merchants: enriched });
  } catch (error) {
    console.error('Merchants CRUD GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Create a hidden draft restaurant: only `name` and an optional `slug`. It is never published,
 * has no links or images, and uses the database defaults for everything else.
 */
export async function POST(request: NextRequest) {
  if (!(await verifyToken(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_CREATE_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).filter((key) => key !== 'name' && key !== 'slug');
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Only name and slug can be set when creating a restaurant (got ${unknown[0]}). Fill in the rest after it is created.`, code: 'UNKNOWN_FIELD' }, { status: 400 });
  }
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 160) {
    return NextResponse.json({ error: 'Enter a name of up to 160 characters.', code: 'VALIDATION_FAILED' }, { status: 400 });
  }
  if (input.slug !== undefined && input.slug !== null && typeof input.slug !== 'string') {
    return NextResponse.json({ error: 'slug must be text.', code: 'VALIDATION_FAILED' }, { status: 400 });
  }
  const name = input.name.trim();
  const slug = (typeof input.slug === 'string' && input.slug.trim()) || generateSlug(name);
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Use 2–64 lowercase letters, numbers and single hyphens for the web address.', code: 'VALIDATION_FAILED' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('merchants')
    .insert({ name, slug, is_published: false, platform_status: 'DRAFT' })
    .select('id, name, slug')
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'This web address is already used.', code: 'SLUG_TAKEN' }, { status: 409 });
    console.error('Merchant draft create failed:', error.message);
    return NextResponse.json({ error: 'The restaurant could not be created.', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
  return NextResponse.json({ merchant: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await verifyToken(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return retired('This editor was replaced. Reload the Admin page and edit the restaurant section by section.');
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyToken(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return retired('Deleting restaurants is not available. Ask the BiteSite team to hide or archive the restaurant instead.');
}
