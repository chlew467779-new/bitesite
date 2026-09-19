/* bitesite/app/api/story-view/route.ts */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { allowAnalyticsRequest, getClientIp, isDuplicateAnalyticsEvent } from "@/lib/analytics-rate-limit";

const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/;

export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 1024) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const requestIp = getClientIp(request);
    if (!allowAnalyticsRequest(`story-view:${requestIp}`)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const { slug } = await request.json();
    if (!slug || typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    if (isDuplicateAnalyticsEvent(`story-view:${requestIp}:${slug}`)) {
      return NextResponse.json({ success: true, deduplicated: true }, { status: 202 });
    }

    const { data: article } = await supabase
      .from("articles")
      .select("slug")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (!article) {
      return NextResponse.json({ error: "Unknown story" }, { status: 400 });
    }

    const { error } = await supabase.rpc("increment_article_view", {
      article_slug: slug,
    });

    if (error) {
      console.error("Article view RPC error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
