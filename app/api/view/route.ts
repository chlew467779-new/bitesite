/* bitesite/app/api/view/route.ts */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { isPublicMerchantSlug } from "@/lib/supabase";
import { allowAnalyticsRequest, getClientIp, isDuplicateAnalyticsEvent } from "@/lib/analytics-rate-limit";

const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/;

export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 1024) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const requestIp = getClientIp(request);
    if (!allowAnalyticsRequest(`view:${requestIp}`)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1024) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const { slug } = JSON.parse(rawBody || "{}");
    if (!slug || typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    if (isDuplicateAnalyticsEvent(`view:${requestIp}:${slug}`)) {
      return NextResponse.json({ success: true, deduplicated: true }, { status: 202 });
    }

    // Checked with the public client so hidden, draft and suspended merchants are refused, using
    // the same database rule as the public pages (the service role would see every merchant).
    if (!(await isPublicMerchantSlug(slug))) {
      return NextResponse.json({ error: "Unknown merchant" }, { status: 400 });
    }

    const { error } = await supabase.rpc("increment_view_count", {
      merchant_slug: slug,
    });

    if (error) {
      console.error("View count RPC error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
