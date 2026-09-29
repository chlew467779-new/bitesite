import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { isAnnouncementId, parseAnnouncement } from '@/lib/announcement-core.mjs';

/**
 * Homepage pop-up (Admin only). GET lists every pop-up; POST creates one; PUT replaces one
 * ({ id, ...form }); DELETE removes one ({ id }). Turning one on turns every other one off, so
 * visitors never see two.
 */

const MAX_BODY_BYTES = 8192;
const COLUMNS = 'id,title,body,image_url,link_url,link_label,is_active,starts_at,ends_at,created_at,updated_at';

function unauthorized(request: Request) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function readBody(request: Request): Promise<{ body: Record<string, unknown> } | { response: NextResponse }> {
  try {
    const body = await readBoundedJson<unknown>(request, MAX_BODY_BYTES);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { response: NextResponse.json({ error: 'Invalid request' }, { status: 400 }) };
    return { body: body as Record<string, unknown> };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return { response: NextResponse.json({ error: error.message }, { status: 413 }) };
    if (error instanceof InvalidJsonBodyError) return { response: NextResponse.json({ error: error.message }, { status: 400 }) };
    return { response: NextResponse.json({ error: 'Invalid request' }, { status: 400 }) };
  }
}

async function turnOthersOff(keepId: string) {
  return supabaseAdmin.from('site_announcements').update({ is_active: false, updated_at: new Date().toISOString() }).eq('is_active', true).neq('id', keepId);
}

export async function GET(request: Request) {
  const authError = unauthorized(request);
  if (authError) return authError;
  const { data, error } = await supabaseAdmin.from('site_announcements').select(COLUMNS).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load pop-ups' }, { status: 500 });
  return NextResponse.json({ announcements: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const authError = unauthorized(request);
  if (authError) return authError;
  const read = await readBody(request);
  if ('response' in read) return read.response;
  const parsed = parseAnnouncement(read.body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('site_announcements').insert(parsed.row).select(COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Could not save the pop-up' }, { status: 500 });
  if (data.is_active && (await turnOthersOff(data.id)).error) return NextResponse.json({ error: 'Saved, but other pop-ups could not be turned off. Check the list.' }, { status: 500 });
  revalidatePath('/');
  return NextResponse.json({ announcement: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const authError = unauthorized(request);
  if (authError) return authError;
  const read = await readBody(request);
  if ('response' in read) return read.response;
  const { id, ...form } = read.body;
  if (!isAnnouncementId(id)) return NextResponse.json({ error: 'Pop-up not found' }, { status: 404 });
  const parsed = parseAnnouncement(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('site_announcements')
    .update({ ...parsed.row, updated_at: new Date().toISOString() }).eq('id', id).select(COLUMNS).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not save the pop-up' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Pop-up not found' }, { status: 404 });
  if (data.is_active && (await turnOthersOff(data.id)).error) return NextResponse.json({ error: 'Saved, but other pop-ups could not be turned off. Check the list.' }, { status: 500 });
  revalidatePath('/');
  return NextResponse.json({ announcement: data });
}

export async function DELETE(request: Request) {
  const authError = unauthorized(request);
  if (authError) return authError;
  const read = await readBody(request);
  if ('response' in read) return read.response;
  if (!isAnnouncementId(read.body.id)) return NextResponse.json({ error: 'Pop-up not found' }, { status: 404 });
  const { error } = await supabaseAdmin.from('site_announcements').delete().eq('id', read.body.id);
  if (error) return NextResponse.json({ error: 'Could not delete the pop-up' }, { status: 500 });
  revalidatePath('/');
  return NextResponse.json({ ok: true });
}
