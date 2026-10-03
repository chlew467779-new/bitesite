/* bitesite/app/api/_lib/monthly-summary.ts */

/**
 * Daily totals for monthly summaries, shared by the Owner and Admin summary routes. The caller has
 * already authorized the actor. Reads merchant_daily_views with the service role (no public
 * access) and follows former web addresses, so a renamed restaurant keeps its history.
 */

import 'server-only';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { SUMMARY_EVENTS, type DailyRow } from '@/lib/monthly-summary-core.mjs';

const PAGE = 1000;

/** Each merchant's current and former slugs: `slug → merchantId`. */
export async function slugOwners(merchants: readonly { id: string; slug: string }[]): Promise<Map<string, string>> {
  const owners = new Map(merchants.map((m) => [m.slug, m.id]));
  if (merchants.length === 0) return owners;
  const { data, error } = await supabase.from('merchant_slug_history').select('merchant_id, old_slug').in('merchant_id', merchants.map((m) => m.id));
  if (error) throw new Error(`slug history: ${error.message}`);
  for (const row of data ?? []) if (!owners.has(row.old_slug)) owners.set(row.old_slug, row.merchant_id);
  return owners;
}

/** All summary rows for these slugs between two dates (inclusive), page by page. */
export async function dailyRows(slugs: readonly string[], from: string, to: string): Promise<(DailyRow & { slug: string })[]> {
  if (slugs.length === 0) return [];
  const rows: (DailyRow & { slug: string })[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from('merchant_daily_views')
      .select('slug, view_date, event_type, page_type, count')
      .in('slug', [...slugs])
      .in('event_type', [...SUMMARY_EVENTS])
      .gte('view_date', from)
      .lte('view_date', to)
      .order('id')
      .range(start, start + PAGE - 1);
    if (error) throw new Error(`daily views: ${error.message}`);
    rows.push(...((data ?? []) as (DailyRow & { slug: string })[]));
    if (!data || data.length < PAGE) return rows;
  }
}
