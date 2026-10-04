/* bitesite/app/api/admin/photo-cleanup/route.ts */

/**
 * Admin photo cleanup (C6): GET lists uploaded photos that nothing uses any more (older than 30
 * days, path not found in any page, menu, Story, submission, event, pop-up, pending request or
 * review snapshot); POST `{ items: [{ bucket, path }] }` deletes those that are STILL unused when
 * re-checked now. Deletion goes through the Storage API (SQL cannot delete storage objects).
 * If any referencing table cannot be read, nothing is listed as unused and nothing is deleted.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { CLEANUP_BUCKETS, MAX_DELETE_PER_RUN, REFERENCE_SOURCES, findUnusedPhotos, parseCleanupDelete, type StoredPhoto } from '@/lib/photo-cleanup-core.mjs';

export const maxDuration = 60;
const PAGE = 1000;
const MAX_OBJECTS = 50_000;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function adminDenied(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : errorResponse(401, 'AUTH_REQUIRED', 'Unauthorized');
}

class ScanError extends Error {}

async function listBucket(bucket: string): Promise<StoredPhoto[]> {
  const out: StoredPhoto[] = [];
  const folders = [''];
  while (folders.length > 0) {
    const prefix = folders.shift() as string;
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw new ScanError(`list ${bucket}/${prefix}: ${error.message}`);
      for (const entry of data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) folders.push(path);
        else out.push({ bucket, path, size: Number((entry.metadata as { size?: number } | null)?.size) || 0, createdAt: entry.created_at ?? '' });
      }
      if (out.length > MAX_OBJECTS) throw new ScanError('too many files to check at once');
      if (!data || data.length < PAGE) break;
    }
  }
  return out;
}

async function referenceText(): Promise<string> {
  const parts: string[] = [];
  for (const source of REFERENCE_SOURCES) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(source.table).select(source.columns.join(',')).range(from, from + PAGE - 1);
      if (error) throw new ScanError(`read ${source.table}: ${error.message}`);
      parts.push(JSON.stringify(data ?? []));
      if (!data || data.length < PAGE) break;
    }
  }
  return parts.join('\n');
}

async function scan() {
  const objects = (await Promise.all(CLEANUP_BUCKETS.map(listBucket))).flat();
  const unused = findUnusedPhotos(objects, await referenceText());
  return { objects, unused };
}

export async function GET(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  try {
    const { objects, unused } = await scan();
    const publicUrl = (o: StoredPhoto) => supabase.storage.from(o.bucket).getPublicUrl(o.path).data.publicUrl;
    return NextResponse.json({
      data: {
        totalFiles: objects.length,
        totalBytes: objects.reduce((n, o) => n + o.size, 0),
        unusedFiles: unused.length,
        unusedBytes: unused.reduce((n, o) => n + o.size, 0),
        maxPerRun: MAX_DELETE_PER_RUN,
        items: unused.slice(0, MAX_DELETE_PER_RUN).map((o) => ({ ...o, url: publicUrl(o) })),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('photo cleanup scan failed:', error instanceof Error ? error.message : error);
    return errorResponse(503, 'SCAN_FAILED', 'Could not check the photos safely. Nothing was changed. Try again later.');
  }
}

export async function POST(request: NextRequest) {
  const denied = adminDenied(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await readBoundedJson(request, 128 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse(413, 'BODY_TOO_LARGE', error.message);
    if (error instanceof InvalidJsonBodyError) return errorResponse(400, 'INVALID_JSON', error.message);
    return errorResponse(400, 'INVALID_JSON', 'Invalid request.');
  }
  const parsed = parseCleanupDelete(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message);
  let stillUnused: Set<string>;
  try {
    stillUnused = new Set((await scan()).unused.map((o) => `${o.bucket}/${o.path}`));
  } catch (error) {
    console.error('photo cleanup re-check failed:', error instanceof Error ? error.message : error);
    return errorResponse(503, 'SCAN_FAILED', 'Could not re-check the photos safely. Nothing was deleted.');
  }
  const toDelete = parsed.items.filter((i) => stillUnused.has(`${i.bucket}/${i.path}`));
  let deleted = 0;
  for (const bucket of CLEANUP_BUCKETS) {
    const paths = toDelete.filter((i) => i.bucket === bucket).map((i) => i.path);
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) {
        console.error('photo cleanup delete failed:', error.message);
        return errorResponse(500, 'DELETE_FAILED', `Deleted ${deleted} photos, then the storage refused. Check again and retry.`);
      }
      deleted += data?.length ?? 0;
    }
  }
  return NextResponse.json({ data: { deleted, skipped: parsed.items.length - toDelete.length } });
}
