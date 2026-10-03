/* bitesite/app/api/merchant/restaurants/[merchantId]/menu-photos/route.ts */

/**
 * Owner menu photos (CH 2026-09-30): send photos of the printed menu and BiteSite adds the menu.
 *   GET            → the photos sent so far (signed URLs, valid one hour)
 *   POST ticket    → `{ action: 'ticket', contentType }` → a signed upload URL for a server-chosen path
 *   POST confirm   → `{ action: 'confirm', name }` → the server checks the file and adds it
 *   DELETE ?name=  → remove one photo before BiteSite uses it
 * Only the active Owner of this restaurant; writing is refused for a suspended or archived one.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { loadOwnedMerchants, merchantErrorResponse, requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { resolveMerchantAccess } from '@/lib/merchant-access-core.mjs';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { MAX_MENU_PHOTO_BODY_BYTES, isMenuPhotoName, parseMenuPhotoRequest } from '@/lib/menu-photos-core.mjs';
import { confirmMenuPhoto, createMenuPhotoTicket, deleteMenuPhotos, listMenuPhotos, type PhotoResult } from '@/app/api/_lib/menu-photos';

type Context = { params: Promise<{ merchantId: string }> };

async function ownerAccess(request: NextRequest, merchantId: string, capability: 'read' | 'write') {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth;
  const owned = await loadOwnedMerchants(auth.user.id);
  if ('response' in owned) return owned;
  const result = resolveMerchantAccess({ merchants: owned.merchants, requestedMerchantId: merchantId, capability });
  if (!result.ok) return { response: merchantErrorResponse(result.status, result.code, result.message) };
  return { merchantId: result.merchant.id as string };
}

function reply<T>(result: PhotoResult<T>, status = 200) {
  if (!result.ok) return merchantErrorResponse(result.status, result.code, result.message);
  return NextResponse.json({ data: result.value }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest, { params }: Context) {
  const access = await ownerAccess(request, (await params).merchantId, 'read');
  if ('response' in access) return access.response;
  return reply(await listMenuPhotos(access.merchantId));
}

export async function POST(request: NextRequest, { params }: Context) {
  const access = await ownerAccess(request, (await params).merchantId, 'write');
  if ('response' in access) return access.response;
  let body: unknown;
  try { body = await readBoundedJson(request, MAX_MENU_PHOTO_BODY_BYTES); } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return merchantErrorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return merchantErrorResponse(400, 'INVALID_JSON', error.message);
    return merchantErrorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseMenuPhotoRequest(body);
  if (!parsed.ok) return merchantErrorResponse(parsed.status, parsed.code, parsed.message);
  if (parsed.action === 'ticket') return reply(await createMenuPhotoTicket(access.merchantId, parsed.contentType));
  return reply(await confirmMenuPhoto(access.merchantId, parsed.name), 201);
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const access = await ownerAccess(request, (await params).merchantId, 'write');
  if ('response' in access) return access.response;
  const name = request.nextUrl.searchParams.get('name');
  if (!isMenuPhotoName(name)) return merchantErrorResponse(400, 'VALIDATION_FAILED', 'Choose a photo to delete.');
  return reply(await deleteMenuPhotos(access.merchantId, [name]));
}
