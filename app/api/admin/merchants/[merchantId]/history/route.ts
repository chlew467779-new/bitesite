/* bitesite/app/api/admin/merchants/[merchantId]/history/route.ts */

/**
 * Admin change history of one restaurant, newest first: GET `?before=<revision>&limit=<n>`.
 * Reads public.merchant_change_log (the D1a audit trail) and returns readable entries; Owner
 * actors are shown with their account email. Read-only.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { describeHistoryRow, parseHistoryQuery } from '@/lib/merchant-history-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest, { params }: Context) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return errorResponse(401, 'AUTH_REQUIRED', 'Unauthorized');
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const query = parseHistoryQuery(request.nextUrl.searchParams);
  if (!query.ok) return errorResponse(400, 'VALIDATION_FAILED', query.message);

  let select = supabase
    .from('merchant_change_log')
    .select('id, actor_type, actor_id, action, changed_paths, before, after, revision, reason, operation, created_at')
    .eq('merchant_id', merchantId)
    .order('revision', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(query.limit + 1);
  if (query.before !== null) select = select.lt('revision', query.before);
  const { data, error } = await select;
  if (error) {
    console.error('merchant change history failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Could not load the history.');
  }
  const rows = data ?? [];
  const entries = rows.slice(0, query.limit).map(describeHistoryRow);

  // Owner accounts by email (a page has few distinct Owners).
  const emails = new Map<string, string | null>();
  for (const id of new Set(entries.map((e) => e.actorId).filter((v): v is string => !!v && isMerchantId(v)))) {
    const { data: user } = await supabase.auth.admin.getUserById(id);
    emails.set(id, user?.user?.email ?? null);
  }
  const items = entries.map(({ actorId, ...entry }) => ({ ...entry, actorEmail: actorId ? emails.get(actorId) ?? null : null }));
  const hasMore = rows.length > query.limit;
  return NextResponse.json(
    { data: { items, nextBefore: hasMore ? entries[entries.length - 1].revision : null } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
