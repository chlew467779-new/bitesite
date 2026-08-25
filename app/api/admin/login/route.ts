import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MINUTES = 15;
const SESSION_DURATION_MINUTES = 30;

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown';
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const now = new Date();

  try {
    // 1. 检查该 IP 是否被锁定
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

    // 2. 验证密码
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (password !== adminPassword) {
      // 失败：增加计数
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

    // 3. 成功：重置计数，生成临时 token
    if (attemptRecord) {
      await supabase
        .from('login_attempts')
        .update({ attempt_count: 0, locked_until: null, last_attempt_at: now.toISOString() })
        .eq('ip', ip);
    }

    // 生成简单 token（实际用 JWT 或随机字符串都可以，这里用时间戳+随机数）
    const token = `admin_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MINUTES * 60000).toISOString();

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
