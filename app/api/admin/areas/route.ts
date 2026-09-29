import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';
import { findAreaConflict, parseCreateArea, parsePatchArea } from '@/lib/admin-areas-core.mjs';

const MAX_BODY_BYTES = 4096;

function unauthorized(request: Request) {
  const token = request.headers.get('x-admin-token');
  return token && verifyAdminToken(token) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function inputError(error: unknown) {
  if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
  if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

async function allAreas() {
  return supabaseAdmin.from('areas').select('id,country,state,name,aliases,is_active,created_at').order('state').order('name');
}

export async function GET(request: Request) {
  const authError = unauthorized(request);
  if (authError) return authError;
  const { data, error } = await allAreas();
  if (error) return NextResponse.json({ error: 'Could not load areas' }, { status: 500 });
  return NextResponse.json({ areas: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const authError = unauthorized(request);
  if (authError) return authError;
  let input;
  try { input = parseCreateArea(await readBoundedJson<unknown>(request, MAX_BODY_BYTES)); } catch (error) { return inputError(error); }
  const { data: areas, error: listError } = await allAreas();
  if (listError || !areas) return NextResponse.json({ error: 'Could not check areas' }, { status: 500 });
  const conflict = findAreaConflict(input, areas);
  if (conflict) return NextResponse.json({ error: `Already used as an area name: ${conflict}` }, { status: 409 });
  const { data, error } = await supabaseAdmin.from('areas').insert(input).select('id,country,state,name,aliases,is_active,created_at').single();
  if (error?.code === '23505') return NextResponse.json({ error: 'An area with this name already exists' }, { status: 409 });
  if (error) return NextResponse.json({ error: 'Could not add area' }, { status: 500 });
  revalidatePath('/');
  return NextResponse.json({ area: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authError = unauthorized(request);
  if (authError) return authError;
  let input;
  try { input = parsePatchArea(await readBoundedJson<unknown>(request, MAX_BODY_BYTES)); } catch (error) { return inputError(error); }
  const { data: areas, error: listError } = await allAreas();
  if (listError || !areas) return NextResponse.json({ error: 'Could not check areas' }, { status: 500 });
  const current = areas.find((area) => area.id === input.id);
  if (!current) return NextResponse.json({ error: 'Area not found' }, { status: 404 });
  if (input.patch.aliases) {
    const conflict = findAreaConflict({ name: current.name, aliases: input.patch.aliases }, areas, input.id);
    if (conflict) return NextResponse.json({ error: `Already used as an area name: ${conflict}` }, { status: 409 });
    if (input.patch.aliases.some((alias) => alias.toLocaleLowerCase() === current.name.toLocaleLowerCase())) {
      return NextResponse.json({ error: 'An alias cannot repeat the area name' }, { status: 400 });
    }
  }
  const { data, error } = await supabaseAdmin.from('areas').update(input.patch).eq('id', input.id)
    .select('id,country,state,name,aliases,is_active,created_at').single();
  if (error) return NextResponse.json({ error: 'Could not update area' }, { status: 500 });
  revalidatePath('/');
  return NextResponse.json({ area: data });
}
