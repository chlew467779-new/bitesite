/* bitesite/app/api/admin/today/route.ts */

/**
 * Admin "Today" page (dashboard phase 1): pilot capacity and the restaurants with gaps worth
 * fixing (lib/admin-today-core.mjs). The queue counts come from /api/admin/attention.
 * Dish counts and the latest Story are embedded per restaurant, so the 1,000-row response cap
 * never cuts them short.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';
import { compareIssueRows, merchantIssues } from '@/lib/admin-today-core.mjs';

type MerchantRow = {
  id: string; slug: string; name: string; latitude: number | null; longitude: number | null; cover_image: string | null;
  phone: string | null; whatsapp: string | null; email: string | null; first_published_at: string | null;
  is_published: boolean | null; review_status: string | null; platform_restriction: string | null;
  products: { count: number }[]; story_submissions: { created_at: string }[];
};

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });

  const [merchants, queue] = await Promise.all([
    supabase.from('merchants')
      .select('id,slug,name,latitude,longitude,cover_image,phone,whatsapp,email,first_published_at,is_published,review_status,platform_restriction,products(count),story_submissions(created_at)')
      .neq('platform_restriction', 'archived')
      .order('created_at', { referencedTable: 'story_submissions', ascending: false })
      .limit(1, { referencedTable: 'story_submissions' })
      .returns<MerchantRow[]>(),
    supabase.rpc('merchant_review_queue', { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL }),
  ]);
  const failed = [merchants, queue].find((r) => r.error);
  if (failed?.error) {
    console.error('admin today failed:', failed.error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load today’s summary.' } }, { status: 500 });
  }

  const now = new Date();
  const rows = (merchants.data ?? [])
    .map((m) => {
      const isPublic = m.is_published === true;
      return {
        id: m.id, slug: m.slug, name: m.name, isPublic,
        status: m.platform_restriction === 'suspended' ? 'suspended' : isPublic ? 'public' : m.review_status === 'pending' ? 'waiting' : 'draft',
        issues: merchantIssues(m, { productCount: m.products?.[0]?.count ?? 0, lastStoryAt: m.story_submissions?.[0]?.created_at ?? null, isPublic, now }),
      };
    })
    .filter((row) => row.issues.length > 0)
    .sort(compareIssueRows);

  const q = (queue.data ?? {}) as { capacity?: number; pilotCapacity?: number; pilotUsed?: number; pending?: number };
  return NextResponse.json({
    data: {
      capacity: { pending: q.pending ?? 0, pendingCapacity: q.capacity ?? 0, pilotUsed: q.pilotUsed ?? 0, pilotCapacity: q.pilotCapacity ?? 0 },
      incomplete: rows,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
