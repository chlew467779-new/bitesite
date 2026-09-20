import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

function accessToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function GET(request: NextRequest) {
  const token = accessToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('merchant_memberships')
    .select('merchant:merchants(*)')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const merchant = data?.merchant;
  if (!merchant) return NextResponse.json({ error: 'No active merchant membership' }, { status: 404 });
  return NextResponse.json({ merchant });
}

export async function PUT(request: NextRequest) {
  const token = accessToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: membership, error: membershipError } = await supabase.from('merchant_memberships').select('merchant_id').eq('user_id', userData.user.id).eq('status', 'active').limit(1).maybeSingle();
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
  if (!membership) return NextResponse.json({ error: 'No active merchant membership' }, { status: 404 });
  try {
    const body = await request.json();
    const allowed = ['tagline', 'description', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook', 'cover_image', 'logo_image', 'menu_pdf_url', 'operating_hours'] as const;
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) if (body[key] !== undefined) updateData[key] = body[key];
    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 });
    for (const key of ['website', 'instagram', 'facebook', 'cover_image', 'logo_image', 'menu_pdf_url']) {
      if (typeof updateData[key] === 'string' && updateData[key]) {
        try { const url = new URL(updateData[key] as string); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
        catch { return NextResponse.json({ error: `${key} must be a valid http(s) URL` }, { status: 400 }); }
      }
    }
    const { data, error } = await supabase.from('merchants').update(updateData).eq('id', membership.merchant_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ merchant: data });
  } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
}
