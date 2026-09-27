import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readBoundedJson } from '@/lib/bounded-json';
import { validateCredentials } from '@/lib/merchant-auth-validation.mjs';

export const runtime = 'nodejs';
const reply = (status: number, error: string, retryAfter?: number) => NextResponse.json(
  { error }, { status, headers: { 'Cache-Control': 'no-store', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } },
);
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return reply(403, 'Please sign in from this website.');
  let input;
  try { input = validateCredentials(await readBoundedJson(request, 4096)); }
  catch { return reply(400, 'Enter a valid email and password.'); }
  if (!input) return reply(400, 'Enter a valid email and password.');
  // Only the platform-overwritten header is trusted. Other production hosts fail closed.
  const source = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    : process.env.NODE_ENV === 'production' ? null : 'local-development';
  if (!source) return reply(503, 'Sign in is temporarily unavailable. Please use a magic link.');
  const sourceKey = createHash('sha256').update(source).digest('hex');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return reply(503, 'Sign in is temporarily unavailable.');
  try {
    const { data: gate, error: gateError } = await supabaseAdmin.rpc('merchant_password_attempt_begin', { p_source: sourceKey });
    if (gateError || !gate) return reply(503, 'Sign in is temporarily unavailable.');
    if (!gate.allowed) return reply(429, 'Too many attempts. Try later or use Forgot password.', gate.retry_after);
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    let result;
    try { result = await client.auth.signInWithPassword(input); }
    catch {
      await supabaseAdmin.rpc('merchant_password_attempt_finish', { p_source: sourceKey, p_ticket: gate.ticket, p_outcome: 'other' });
      return reply(503, 'Sign in is temporarily unavailable.');
    }
    const confirmed = Boolean(result.data.user?.email_confirmed_at);
    const outcome = result.error?.code === 'invalid_credentials' ? 'failure' : result.error || !confirmed ? 'other' : 'success';
    const { data: finished, error: finishError } = await supabaseAdmin.rpc('merchant_password_attempt_finish', { p_source: sourceKey, p_ticket: gate.ticket, p_outcome: outcome });
    if (finishError || !finished?.accepted) return reply(503, 'Please try signing in again.');
    if (finished.retry_after > 0) return reply(429, 'Too many attempts. Try again in 15 minutes or use Forgot password.', finished.retry_after);
    if (result.error || !result.data.session || !confirmed) return reply(401, result.error?.code === 'email_not_confirmed' || (!result.error && !confirmed) ? 'Check your inbox and confirm your email first.' : 'Email or password is incorrect. You can use Forgot password.');
    return NextResponse.json({ session: { access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return reply(503, 'Sign in is temporarily unavailable.'); }
}
