/* bitesite/app/api/view/route.ts */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/;

export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json();
    if (!slug || typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
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
