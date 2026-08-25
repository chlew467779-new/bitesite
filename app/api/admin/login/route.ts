import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAdminToken } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MINUTES = 15;

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown';
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const now = new Date();

  try {
    const { data: attemptRecord } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('ip', ip)
      .single();

    if (attemptRecord?.locked_until && new Date(attemptRecord.locked_until) > now) {
      const remaining = Math.ceil((new Date(attemptRecord.locked_until).getTime() - now.getTime()) / 60000);
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${remaining} minutes.` },
        { status: 429 }
      );
    }

    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (password !== adminPassword) {
      const newCount = (attemptRecord?.attempt_count || 0) + 1;
      const lockedUntil = newCount >= MAX_ATTEMPTS 
        ? new Date(now.getTime() + LOCK_DURATION_MINUTES * 60000).toISOString()
        : null;

      if (attemptRecord) {
        await supabase
          .from('login_attempts')
          .update({
            attempt_count: newCount,
            last_attempt_at: now.toISOString(),
            locked_until: lockedUntil,
          })
          .eq('ip', ip);
      } else {
        await supabase.from('login_attempts').insert({
          ip,
          attempt_count: newCount,
          last_attempt_at: now.toISOString(),
          locked_until: lockedUntil,
        });
      }

      const remaining = MAX_ATTEMPTS - newCount;
      return NextResponse.json(
        { error: `Invalid password. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Account locked for 15 minutes.'}` },
        { status: 401 }
      );
    }

    if (attemptRecord) {
      await supabase
        .from('login_attempts')
        .update({ attempt_count: 0, locked_until: null, last_attempt_at: now.toISOString() })
        .eq('ip', ip);
    }

    const token = generateAdminToken();
    const expiresAt = new Date(now.getTime() + 30 * 60000).toISOString();

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
