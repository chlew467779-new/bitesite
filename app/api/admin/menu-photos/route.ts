/* bitesite/app/api/admin/menu-photos/route.ts */

/**
 * Admin menu photos (CH 2026-09-30): restaurants that sent photos of their menu.
 *   GET                  → the queue: restaurant, number of photos, oldest upload, dishes on its menu now
 *   GET ?merchantId=     → that restaurant's photos (signed URLs, valid one hour)
 *   DELETE ?merchantId=  → "Done": delete all of that restaurant's photos after adding the menu
 * Before migration 20261003130000 the bucket is missing and GET answers `available: false`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { deleteMenuPhotos, listMenuPhotos, menuPhotoQueue } from '@/app/api/_lib/menu-photos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status });
const NO_STORE = { 'Cache-Control': 'private, no-store' };

function authorized(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return Boolean(token && verifyAdminToken(token));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return fail(401, 'AUTH_REQUIRED', 'Unauthorized');
  const merchantId = request.nextUrl.searchParams.get('merchantId');
  if (merchantId !== null) {
    if (!UUID.test(merchantId)) return fail(400, 'VALIDATION_FAILED', 'Invalid restaurant.');
    const photos = await listMenuPhotos(merchantId);
    if (!photos.ok) return fail(photos.status, photos.code, photos.message);
    return NextResponse.json({ data: { photos: photos.value } }, { headers: NO_STORE });
  }
  const queue = await menuPhotoQueue();
  if (!queue.ok) {
    if (queue.code === 'NOT_AVAILABLE') return NextResponse.json({ data: { available: false, items: [] } }, { headers: NO_STORE });
    return fail(queue.status, queue.code, queue.message);
  }
  const ids = queue.value.map((q) => q.merchantId);
  const { data: merchants, error } = ids.length
    ? await supabase.from('merchants').select('id, name, slug').in('id', ids)
    : { data: [], error: null };
  if (error) return fail(500, 'INTERNAL_ERROR', 'Could not load the restaurants.');
  const byId = new Map((merchants ?? []).map((m) => [m.id as string, m as { id: string; name: string; slug: string }]));
  // A folder left behind by a deleted restaurant is not shown.
  const shown = queue.value.filter((q) => byId.has(q.merchantId));
  // Dishes on the menu now (T4): "Done" with 0 dishes asks again. null = could not count.
  const dishCounts = await Promise.all(shown.map((q) => supabase.from('products').select('id', { count: 'exact', head: true }).eq('merchant_id', q.merchantId)));
  const items = shown.map((q, i) => ({ ...q, name: byId.get(q.merchantId)!.name, slug: byId.get(q.merchantId)!.slug, dishes: dishCounts[i].error ? null : dishCounts[i].count ?? 0 }));
  return NextResponse.json({ data: { available: true, items } }, { headers: NO_STORE });
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return fail(401, 'AUTH_REQUIRED', 'Unauthorized');
  const merchantId = request.nextUrl.searchParams.get('merchantId') ?? '';
  if (!UUID.test(merchantId)) return fail(400, 'VALIDATION_FAILED', 'Invalid restaurant.');
  const removed = await deleteMenuPhotos(merchantId, null);
  if (!removed.ok) return fail(removed.status, removed.code, removed.message);
  return NextResponse.json({ data: { removed: removed.value } }, { headers: NO_STORE });
}
