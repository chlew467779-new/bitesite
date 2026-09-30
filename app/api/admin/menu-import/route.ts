/* bitesite/app/api/admin/menu-import/route.ts */

/**
 * Admin menu import (CH 2026-09-30): POST { merchantId, categories } → public.merchant_menu_import.
 * The Admin menu editor reads Gemini's answer (lib/menu-import-core.mjs) and sends the checked
 * sections and dishes. One transaction; dishes already on the menu are skipped, never changed.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL } from '@/app/api/_lib/merchant-field-patch';
import { parseImportRequest } from '@/lib/menu-import-core.mjs';
import { mapMenuRpcError } from '@/lib/merchant-menu-core.mjs';

// 1000 dishes with descriptions fit comfortably.
const MAX_BODY_BYTES = 1024 * 1024;

const fail = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status });

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return fail(401, 'AUTH_REQUIRED', 'Unauthorized');
  let body: unknown;
  try { body = await readBoundedJson(request, MAX_BODY_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return fail(413, 'BODY_TOO_LARGE', 'Too much at once. Import the menu in two parts.');
    if (error instanceof InvalidJsonBodyError) return fail(400, 'INVALID_JSON', 'Invalid request.');
    return fail(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseImportRequest(body);
  if (!parsed.ok) return fail(400, 'VALIDATION_FAILED', parsed.message);

  const { data, error } = await supabase.rpc('merchant_menu_import', {
    p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL, p_merchant_id: parsed.merchantId, p_items: parsed.items,
  });
  if (error) {
    const mapped = mapMenuRpcError(error);
    if (mapped.status >= 500) console.error('merchant_menu_import failed:', error.message);
    return fail(mapped.status, mapped.code, mapped.message);
  }
  const { data: merchant } = await supabase.from('merchants').select('slug').eq('id', parsed.merchantId).maybeSingle();
  if (merchant?.slug) revalidatePath(`/store/${merchant.slug}`);
  return NextResponse.json({ data });
}
