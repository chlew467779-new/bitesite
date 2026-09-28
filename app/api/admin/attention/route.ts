/* bitesite/app/api/admin/attention/route.ts */

/**
 * What needs the Admin team now (sidebar badges): restaurants waiting for review, link and name/address/cuisine requests, restaurant claims,
 * new feedback, Story submissions waiting for review, and notification emails waiting to be sent
 * or given up after five attempts. Counts only.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });

  const count = (table: string) => supabase.from(table).select('id', { count: 'exact', head: true });
  const [reviews, links, basics, claims, feedback, stories, notifyPending, notifyFailed] = await Promise.all([
    count('merchant_review_submissions').eq('status', 'pending'),
    count('merchant_link_requests').eq('status', 'pending'),
    count('merchant_basics_requests').eq('status', 'pending'),
    count('merchant_claims').eq('status', 'pending'),
    count('merchant_feedback').eq('status', 'new'),
    count('story_submissions').eq('status', 'pending_review'),
    count('merchant_notifications').is('delivered_at', null).lt('attempts', 5),
    count('merchant_notifications').is('delivered_at', null).gte('attempts', 5),
  ]);
  const failed = [reviews, links, basics, claims, feedback, stories, notifyPending, notifyFailed].find((r) => r.error);
  if (failed?.error) {
    console.error('admin attention counts failed:', failed.error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load the counts.' } }, { status: 500 });
  }
  return NextResponse.json({
    data: {
      'restaurant-reviews': reviews.count ?? 0,
      'link-reviews': (links.count ?? 0) + (basics.count ?? 0),
      claims: claims.count ?? 0,
      feedback: feedback.count ?? 0,
      'story-submissions': stories.count ?? 0,
      notifications: { pending: notifyPending.count ?? 0, failed: notifyFailed.count ?? 0 },
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
