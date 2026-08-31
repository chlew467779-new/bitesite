/* bitesite/app/api/admin/merchants-crud/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

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
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0;
}

async function verifyToken(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('x-admin-token');
  if (!token) return false;
  return verifyAdminToken(token);
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
    const { data: views } = await supabase
      .from('page_views')
      .select('slug')
      .eq('page_type', 'merchant')
      .eq('event_type', 'page_view');

    const productCounts: Record<string, number> = {};
    products?.forEach((p) => {
      productCounts[p.merchant_id] = (productCounts[p.merchant_id] || 0) + 1;
    });

    const viewCounts: Record<string, number> = {};
    views?.forEach((v) => {
      if (v.slug) viewCounts[v.slug] = (viewCounts[v.slug] || 0) + 1;
    });

    const enriched = merchants?.map((m) => ({
      ...m,
      product_count: productCounts[m.id] || 0,
      view_count: viewCounts[m.slug] || 0,
    }));

    return NextResponse.json({ merchants: enriched });
  } catch (error) {
    console.error('Merchants CRUD GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyToken(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!body.whatsapp?.trim()) {
      return NextResponse.json({ error: 'WhatsApp is required' }, { status: 400 });
    }

    const slug = body.slug?.trim() || generateSlug(body.name);
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    const insertData: Record<string, unknown> = {
      slug,
      name: body.name.trim(),
      tagline: body.tagline?.trim() || null,
      description: body.description?.trim() || null,
      layout: body.layout || 'classic',
      cuisine_type: body.cuisine_type?.trim() || null,
      area: body.area?.trim() || null,
      tags: body.tags?.length ? body.tags : null,
      payment_methods: body.payment_methods?.length ? body.payment_methods : null,
      address: body.address?.trim() || null,
      phone: body.phone?.trim() || null,
      whatsapp: body.whatsapp.trim(),
      email: body.email?.trim() || null,
      website: body.website?.trim() || null,
      instagram: body.instagram?.trim() || null,
      facebook: body.facebook?.trim() || null,
      latitude: body.latitude ? parseFloat(body.latitude) : null,
      longitude: body.longitude ? parseFloat(body.longitude) : null,
      operating_hours: Object.fromEntries(
        Object.entries(body.operating_hours || {}).filter(([, v]) => (v as string)?.trim())
      ) || null,
      is_published: body.is_published === true,
      status: body.status || 'active',
      features: body.features || null,
      logo_image: body.logo_image?.trim() || null,
      cover_image: body.cover_image?.trim() || null,
      menu_pdf_url: body.menu_pdf_url?.trim() || null,
    };

    const { data, error } = await supabase
      .from('merchants')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Revalidate pages immediately
    revalidatePath(`/store/${data.slug}`);
    revalidatePath('/');

    return NextResponse.json({ merchant: data }, { status: 201 });
  } catch (error) {
    console.error('Merchants CRUD POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await verifyToken(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Merchant ID is required' }, { status: 400 });
    }

    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (body.whatsapp !== undefined && !body.whatsapp?.trim()) {
      return NextResponse.json({ error: 'WhatsApp is required' }, { status: 400 });
    }

    const slug = body.slug?.trim();
    if (slug && !isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 });
    }

    if (slug) {
      const { data: existing } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.slug !== undefined) updateData.slug = slug;
    if (body.tagline !== undefined) updateData.tagline = body.tagline?.trim() || null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.layout !== undefined) updateData.layout = body.layout;
    if (body.cuisine_type !== undefined) updateData.cuisine_type = body.cuisine_type?.trim() || null;
    if (body.area !== undefined) updateData.area = body.area?.trim() || null;
    if (body.tags !== undefined) updateData.tags = body.tags?.length ? body.tags : null;
    if (body.payment_methods !== undefined) updateData.payment_methods = body.payment_methods?.length ? body.payment_methods : null;
    if (body.address !== undefined) updateData.address = body.address?.trim() || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
    if (body.whatsapp !== undefined) updateData.whatsapp = body.whatsapp.trim();
    if (body.email !== undefined) updateData.email = body.email?.trim() || null;
    if (body.website !== undefined) updateData.website = body.website?.trim() || null;
    if (body.instagram !== undefined) updateData.instagram = body.instagram?.trim() || null;
    if (body.facebook !== undefined) updateData.facebook = body.facebook?.trim() || null;
    if (body.latitude !== undefined) updateData.latitude = body.latitude ? parseFloat(body.latitude) : null;
    if (body.longitude !== undefined) updateData.longitude = body.longitude ? parseFloat(body.longitude) : null;
    if (body.operating_hours !== undefined) {
      updateData.operating_hours = Object.fromEntries(
        Object.entries(body.operating_hours).filter(([, v]) => (v as string)?.trim())
      ) || null;
    }
    if (body.is_published !== undefined) updateData.is_published = body.is_published === true;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.logo_image !== undefined) updateData.logo_image = body.logo_image?.trim() || null;
    if (body.cover_image !== undefined) updateData.cover_image = body.cover_image?.trim() || null;
    if (body.menu_pdf_url !== undefined) updateData.menu_pdf_url = body.menu_pdf_url?.trim() || null;

    const { data, error } = await supabase
      .from('merchants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Revalidate pages immediately
    revalidatePath(`/store/${data.slug}`);
    revalidatePath('/');

    return NextResponse.json({ merchant: data });
  } catch (error) {
    console.error('Merchants CRUD PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await verifyToken(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Merchant ID is required' }, { status: 400 });
    }

    // Get slug before deleting for revalidation
    const { data: merchantToDelete } = await supabase
      .from('merchants')
      .select('slug')
      .eq('id', id)
      .single();

    await supabase.from('products').delete().eq('merchant_id', id);
    await supabase.from('categories').delete().eq('merchant_id', id);
    await supabase.from('merchant_videos').delete().eq('merchant_id', id);
    await supabase.from('events').delete().eq('merchant_id', id);

    const { error } = await supabase.from('merchants').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Revalidate after deletion
    if (merchantToDelete?.slug) {
      revalidatePath(`/store/${merchantToDelete.slug}`);
    }
    revalidatePath('/');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Merchants CRUD DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
