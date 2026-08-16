/* bitesite/app/api/story-view/route.ts */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json();
    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
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
