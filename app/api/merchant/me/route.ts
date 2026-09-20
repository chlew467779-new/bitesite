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
