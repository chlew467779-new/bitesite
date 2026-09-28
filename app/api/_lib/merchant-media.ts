/* bitesite/app/api/_lib/merchant-media.ts */

/**
 * Server side of M6b profile images (logo / cover), shared by the Owner and Admin endpoints.
 * The caller has established the actor; this module passes only that actor to the database.
 *
 * Ticket: the server chooses the object path, the database authorizes and records the ticket,
 * then a signed upload URL is issued for exactly that path. Bind: the server downloads the object,
 * checks its size and real type, and only then asks the database to bind it (compare-and-set,
 * audit, idempotency). The public URL is derived from the ticket's bucket/path, never from the body.
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { ADMIN_PRINCIPAL, isMerchantId, type FieldActor } from '@/app/api/_lib/merchant-field-patch';
import {
  MAX_MEDIA_BODY_BYTES,
  MEDIA_BUCKET,
  dishObjectPath,
  mapDishMediaRpcError,
  parseDishBindRequest,
  parseDishTicketRequest,
  MEDIA_MAX_BYTES,
  mapMediaRpcError,
  mediaBindResponse,
  mediaObjectPath,
  parseBindRequest,
  parseTicketRequest,
  sniffImageType,
} from '@/lib/merchant-media-core.mjs';

function actorArgs(actor: FieldActor) {
  return actor.type === 'owner' ? { p_actor_type: 'owner', p_actor_id: actor.userId } : { p_actor_type: 'admin', p_actor_id: ADMIN_PRINCIPAL };
}

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

async function readBody(request: NextRequest): Promise<{ body: unknown } | { response: NextResponse }> {
  try {
    return { body: await readBoundedJson(request, MAX_MEDIA_BODY_BYTES) };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return { response: errorResponse(413, 'BODY_TOO_LARGE', error.message) };
    if (error instanceof InvalidJsonBodyError) return { response: errorResponse(400, 'INVALID_JSON', error.message) };
    return { response: errorResponse(400, 'INVALID_JSON', 'Invalid request.') };
  }
}

function rpcFailure(error: { message: string }, label: string, extra: Record<string, unknown> = {}) {
  const mapped = mapMediaRpcError(error);
  if (mapped.status === 500) console.error(`${label} failed:`, error.message);
  return errorResponse(mapped.status, mapped.code, mapped.message, extra);
}

/** GET: the current logo and cover URLs. */
export async function readMerchantMedia(actor: FieldActor, merchantId: string) {
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const { data, error } = await supabase.rpc('merchant_media_read', { ...actorArgs(actor), p_merchant_id: merchantId });
  if (error) return rpcFailure(error, 'merchant_media_read');
  const media = data as { logo: string | null; cover: string | null; revision: number };
  return NextResponse.json({ data: { logo: media.logo, cover: media.cover }, revision: media.revision }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST ticket: authorize, record the ticket, issue a signed upload URL for the server-chosen path. */
export async function createMediaTicket(request: NextRequest, actor: FieldActor, merchantId: string) {
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const read = await readBody(request);
  if ('response' in read) return read.response;
  const parsed = parseTicketRequest(read.body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);

  const path = mediaObjectPath(merchantId.toLowerCase(), parsed.slot, parsed.contentType, crypto.randomUUID());
  const { data, error } = await supabase.rpc('merchant_media_ticket', {
    ...actorArgs(actor), p_merchant_id: merchantId, p_slot: parsed.slot, p_path: path, p_content_type: parsed.contentType,
  });
  if (error) return rpcFailure(error, 'merchant_media_ticket');
  const ticket = data as { uploadId: string; bucket: string; path: string };
  const signed = await supabase.storage.from(ticket.bucket).createSignedUploadUrl(ticket.path);
  if (signed.error || !signed.data) {
    console.error('createSignedUploadUrl failed:', signed.error?.message);
    return errorResponse(503, 'STORAGE_UNAVAILABLE', 'Photo upload is not available right now. Please try again later.');
  }
  return NextResponse.json({ data: { uploadId: ticket.uploadId, bucket: ticket.bucket, path: ticket.path, token: signed.data.token, maxBytes: MEDIA_MAX_BYTES } });
}

/** PUT: check the uploaded object (if any), then bind it (or remove the photo) under compare-and-set. */
export async function bindMerchantMedia(request: NextRequest, actor: FieldActor, merchantId: string) {
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const read = await readBody(request);
  if ('response' in read) return read.response;
  const parsed = parseBindRequest(read.body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);

  let publicUrl: string | null = null;
  if (parsed.uploadId) {
    // Screen access first, so nobody can make the server download objects of another restaurant.
    const access = await supabase.rpc('merchant_media_read', { ...actorArgs(actor), p_merchant_id: merchantId });
    if (access.error) return rpcFailure(access.error, 'merchant_media_read', { requestId: parsed.requestId });
    const { data: upload } = await supabase
      .from('merchant_media_uploads')
      .select('bucket, path, content_type, merchant_id, slot')
      .eq('id', parsed.uploadId)
      .maybeSingle();
    // Ownership, slot, expiry and single use are enforced again by the bind RPC under lock.
    if (!upload || upload.merchant_id !== merchantId.toLowerCase() || upload.slot !== parsed.slot || upload.bucket !== MEDIA_BUCKET) {
      return errorResponse(409, 'VALIDATION_FAILED', 'This upload does not belong to this photo. Please choose the photo again.', { requestId: parsed.requestId });
    }
    const object = await supabase.storage.from(upload.bucket).download(upload.path);
    if (object.error || !object.data) {
      return errorResponse(409, 'UPLOAD_MISSING', 'The photo did not finish uploading. Please choose it again.', { requestId: parsed.requestId });
    }
    const bytes = new Uint8Array(await object.data.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MEDIA_MAX_BYTES) {
      return errorResponse(422, 'VALIDATION_FAILED', 'The photo must be smaller than 5 MB.', { requestId: parsed.requestId });
    }
    if (sniffImageType(bytes) !== upload.content_type) {
      return errorResponse(422, 'VALIDATION_FAILED', 'This file is not a JPG, PNG or WebP photo.', { requestId: parsed.requestId });
    }
    publicUrl = supabase.storage.from(upload.bucket).getPublicUrl(upload.path).data.publicUrl;
  }

  const { data, error } = await supabase.rpc('merchant_media_bind', {
    ...actorArgs(actor),
    p_merchant_id: merchantId,
    p_request_id: parsed.requestId,
    p_slot: parsed.slot,
    p_upload_id: parsed.uploadId,
    p_public_url: publicUrl,
    p_expected_value: parsed.expected,
  });
  if (error) return rpcFailure(error, 'merchant_media_bind', { requestId: parsed.requestId });
  if ((data as { status?: string })?.status === 'applied') await revalidateMerchant(merchantId);
  const response = mediaBindResponse(data, parsed.requestId);
  return NextResponse.json(response.body, { status: response.status });
}

/** Download the stored object and check size and real type; the public URL, or an error response. */
async function checkedPublicUrl(upload: { bucket: string; path: string; content_type: string }, requestId: string): Promise<{ url: string } | { response: NextResponse }> {
  const object = await supabase.storage.from(upload.bucket).download(upload.path);
  if (object.error || !object.data) {
    return { response: errorResponse(409, 'UPLOAD_MISSING', 'The photo did not finish uploading. Please choose it again.', { requestId }) };
  }
  const bytes = new Uint8Array(await object.data.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MEDIA_MAX_BYTES) {
    return { response: errorResponse(422, 'VALIDATION_FAILED', 'The photo must be smaller than 5 MB.', { requestId }) };
  }
  if (sniffImageType(bytes) !== upload.content_type) {
    return { response: errorResponse(422, 'VALIDATION_FAILED', 'This file is not a JPG, PNG or WebP photo.', { requestId }) };
  }
  return { url: supabase.storage.from(upload.bucket).getPublicUrl(upload.path).data.publicUrl };
}

/** POST dish ticket: the dish must be this restaurant's (checked by the database under lock). */
export async function createDishTicket(request: NextRequest, actor: FieldActor, merchantId: string) {
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const read = await readBody(request);
  if ('response' in read) return read.response;
  const parsed = parseDishTicketRequest(read.body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const path = dishObjectPath(merchantId.toLowerCase(), parsed.productId, parsed.contentType, crypto.randomUUID());
  const { data, error } = await supabase.rpc('merchant_dish_media_ticket', {
    ...actorArgs(actor), p_merchant_id: merchantId, p_product_id: parsed.productId, p_path: path, p_content_type: parsed.contentType,
  });
  if (error) {
    const mapped = mapDishMediaRpcError(error);
    if (mapped.status === 500) console.error('merchant_dish_media_ticket failed:', error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  const ticket = data as { uploadId: string; bucket: string; path: string };
  const signed = await supabase.storage.from(ticket.bucket).createSignedUploadUrl(ticket.path);
  if (signed.error || !signed.data) {
    console.error('createSignedUploadUrl failed:', signed.error?.message);
    return errorResponse(503, 'STORAGE_UNAVAILABLE', 'Photo upload is not available right now. Please try again later.');
  }
  return NextResponse.json({ data: { uploadId: ticket.uploadId, bucket: ticket.bucket, path: ticket.path, token: signed.data.token, maxBytes: MEDIA_MAX_BYTES } });
}

/** PUT dish photo: check the uploaded object (if any), then bind it (or remove) under compare-and-set. */
export async function bindDishMedia(request: NextRequest, actor: FieldActor, merchantId: string) {
  if (!isMerchantId(merchantId)) return errorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const read = await readBody(request);
  if ('response' in read) return read.response;
  const parsed = parseDishBindRequest(read.body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  const fail = (error: { message: string }, label: string) => {
    const mapped = mapDishMediaRpcError(error);
    if (mapped.status === 500) console.error(`${label} failed:`, error.message);
    return errorResponse(mapped.status, mapped.code, mapped.message, { requestId: parsed.requestId });
  };

  let publicUrl: string | null = null;
  if (parsed.uploadId) {
    // Screen access first, so nobody can make the server download objects of another restaurant.
    const access = await supabase.rpc('merchant_media_read', { ...actorArgs(actor), p_merchant_id: merchantId });
    if (access.error) return fail(access.error, 'merchant_media_read');
    const { data: upload } = await supabase
      .from('merchant_media_uploads')
      .select('bucket, path, content_type, merchant_id, slot, product_id')
      .eq('id', parsed.uploadId)
      .maybeSingle();
    // Ownership, dish, expiry and single use are enforced again by the bind RPC under lock.
    if (!upload || upload.merchant_id !== merchantId.toLowerCase() || upload.slot !== 'dish' || upload.product_id !== parsed.productId || upload.bucket !== MEDIA_BUCKET) {
      return errorResponse(409, 'VALIDATION_FAILED', 'This upload does not belong to this dish. Please choose the photo again.', { requestId: parsed.requestId });
    }
    const checked = await checkedPublicUrl(upload, parsed.requestId);
    if ('response' in checked) return checked.response;
    publicUrl = checked.url;
  }

  const { data, error } = await supabase.rpc('merchant_dish_media_bind', {
    ...actorArgs(actor),
    p_merchant_id: merchantId,
    p_request_id: parsed.requestId,
    p_product_id: parsed.productId,
    p_upload_id: parsed.uploadId,
    p_public_url: publicUrl,
    p_expected_value: parsed.expected,
  });
  if (error) return fail(error, 'merchant_dish_media_bind');
  const result = data as { status?: string; value?: string | null; current?: string | null; replayed?: boolean };
  if (result.status === 'conflict') {
    return NextResponse.json({ error: { code: 'FIELD_CONFLICT', message: 'This dish photo was changed in another session. The latest photo is shown now; choose again if you still want to change it.', current: result.current ?? null }, requestId: parsed.requestId }, { status: 409 });
  }
  if (result.status === 'applied') await revalidateMerchant(merchantId);
  return NextResponse.json({ data: { status: result.status, productId: parsed.productId, value: result.value ?? null }, requestId: parsed.requestId, replayed: result.replayed === true });
}

async function revalidateMerchant(merchantId: string) {
  const { data } = await supabase.from('merchants').select('slug').eq('id', merchantId).maybeSingle();
  if (data?.slug) revalidatePath(`/store/${data.slug}`);
  revalidatePath('/');
  revalidatePath('/our-partner');
}
