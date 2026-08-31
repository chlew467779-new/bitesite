/* bitesite/app/api/admin/merchants-crud/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-admin-token');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isValid = await verifyAdminToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch all merchants
    const { data: merchants, error: merchantsError } = await supabase
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false });

    if (merchantsError) {
      return NextResponse.json({ error: merchantsError.message }, { status: 500 });
    }

    // Fetch product counts
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('merchant_id');

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    // Fetch view counts from page_views
    const { data: views, error: viewsError } = await supabase
      .from('page_views')
      .select('slug')
      .eq('page_type', 'merchant')
      .eq('event_type', 'page_view');

    if (viewsError) {
      return NextResponse.json({ error: viewsError.message }, { status: 500 });
    }

    // Aggregate product counts by merchant_id
    const productCounts: Record<string, number> = {};
    products?.forEach((p) => {
      productCounts[p.merchant_id] = (productCounts[p.merchant_id] || 0) + 1;
    });

    // Aggregate view counts by slug
    const viewCounts: Record<string, number> = {};
    views?.forEach((v) => {
      if (v.slug) {
        viewCounts[v.slug] = (viewCounts[v.slug] || 0) + 1;
      }
    });

    // Enrich merchant data
    const enrichedMerchants = merchants?.map((m) => ({
      ...m,
      product_count: productCounts[m.id] || 0,
      view_count: viewCounts[m.slug] || 0,
    }));

    return NextResponse.json({ merchants: enrichedMerchants });
  } catch (error) {
    console.error('Merchants CRUD GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
