/* bitesite/app/api/merchant/restaurants/[merchantId]/summary/route.ts */

/**
 * Owner monthly summary: GET → this month so far, the same days last month and all of last month
 * (page views, menu views, customers who tried to reach the restaurant). Aggregates only, from
 * daily totals refreshed every hour; includes former web addresses.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { loadOwnedMerchants, merchantErrorResponse, requireMerchantUser } from '@/app/api/merchant/_lib/merchant-access';
import { isMerchantId } from '@/app/api/_lib/merchant-field-patch';
import { dailyRows, slugOwners } from '@/app/api/_lib/monthly-summary';
import { summaryRanges, summaryTotals } from '@/lib/monthly-summary-core.mjs';

type Context = { params: Promise<{ merchantId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireMerchantUser(request);
  if ('response' in auth) return auth.response;
  const { merchantId } = await params;
  if (!isMerchantId(merchantId)) return merchantErrorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');
  const owned = await loadOwnedMerchants(auth.user.id);
  if ('response' in owned) return owned.response;
  const merchant = owned.merchants.find((m) => m.id === merchantId);
  if (!merchant) return merchantErrorResponse(404, 'RESOURCE_NOT_FOUND', 'Restaurant not found.');

  try {
    const ranges = summaryRanges();
    const slugs = [...(await slugOwners([merchant])).keys()];
    const rows = await dailyRows(slugs, ranges.lastMonth.from, ranges.thisMonth.to);
    return NextResponse.json({
      data: {
        ranges,
        thisMonth: summaryTotals(rows, ranges.thisMonth),
        sameDaysLastMonth: summaryTotals(rows, ranges.sameDaysLastMonth),
        lastMonth: summaryTotals(rows, ranges.lastMonth),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner monthly summary failed:', error instanceof Error ? error.message : error);
    return merchantErrorResponse(500, 'INTERNAL_ERROR', 'Could not load your summary. Please try again.');
  }
}
