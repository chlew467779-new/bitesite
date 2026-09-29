/* bitesite/app/api/admin/attention/route.ts */

/**
 * What needs the Admin team now (sidebar badges and the Today page): restaurants waiting for review,
 * link and name/address/cuisine requests, visitor reports, feedback that reports a problem, Story
 * submissions waiting for review, and notification emails waiting to be sent or given up after
 * five attempts. Counts only.
 *
 * Feedback is split (CH 2026-09-29): problems (merchant "problem"/"listing", visitor "problem") are
 * handled as they come in and count toward the Feedback badge; ideas and design comments are
 * collected for a batch and reported separately as `ideas` with the date of the oldest one.
 * Visitor feedback counts are optional so the page still works before its table exists.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });

  const count = (table: string) => supabase.from(table).select('id', { count: 'exact', head: true });
  const oldest = (table: string) => supabase.from(table).select('created_at').eq('status', 'new').order('created_at').limit(1);
  const [reviews, links, basics, reports, merchantProblems, merchantIdeas, merchantIdeaOldest, stories, notifyPending, notifyFailed] = await Promise.all([
    count('merchant_review_submissions').eq('status', 'pending'),
    count('merchant_link_requests').eq('status', 'pending'),
    count('merchant_basics_requests').eq('status', 'pending'),
    count('public_reports').eq('status', 'new'),
    count('merchant_feedback').eq('status', 'new').in('topic', ['problem', 'listing']),
    count('merchant_feedback').eq('status', 'new').eq('topic', 'suggestion'),
    oldest('merchant_feedback').eq('topic', 'suggestion'),
    count('story_submissions').eq('status', 'pending_review'),
    count('merchant_notifications').is('delivered_at', null).lt('attempts', 5),
    count('merchant_notifications').is('delivered_at', null).gte('attempts', 5),
  ]);
  const failed = [reviews, links, basics, reports, merchantProblems, merchantIdeas, merchantIdeaOldest, stories, notifyPending, notifyFailed].find((r) => r.error);
  if (failed?.error) {
    console.error('admin attention counts failed:', failed.error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load the counts.' } }, { status: 500 });
  }

  const [siteProblems, siteIdeas, siteIdeaOldest] = await Promise.all([
    count('site_feedback').eq('status', 'new').eq('topic', 'problem'),
    count('site_feedback').eq('status', 'new').neq('topic', 'problem'),
    oldest('site_feedback').neq('topic', 'problem'),
  ]);
  const siteFailed = [siteProblems, siteIdeas, siteIdeaOldest].find((r) => r.error);
  if (siteFailed?.error) console.error('admin attention: visitor feedback counts unavailable:', siteFailed.error.message);
  const firstDate = (rows: unknown) => (Array.isArray(rows) ? (rows[0] as { created_at?: string } | undefined)?.created_at : undefined);
  const site = siteFailed
    ? { problems: 0, ideas: 0, oldest: undefined }
    : { problems: siteProblems.count ?? 0, ideas: siteIdeas.count ?? 0, oldest: firstDate(siteIdeaOldest.data) };
  const ideaDates = [firstDate(merchantIdeaOldest.data), site.oldest].filter((d): d is string => Boolean(d)).sort();

  return NextResponse.json({
    data: {
      'restaurant-reviews': reviews.count ?? 0,
      'link-reviews': (links.count ?? 0) + (basics.count ?? 0),
      reports: reports.count ?? 0,
      feedback: (merchantProblems.count ?? 0) + site.problems,
      'story-submissions': stories.count ?? 0,
      notifications: { pending: notifyPending.count ?? 0, failed: notifyFailed.count ?? 0 },
      ideas: { count: (merchantIdeas.count ?? 0) + site.ideas, oldestAt: ideaDates[0] ?? null },
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
