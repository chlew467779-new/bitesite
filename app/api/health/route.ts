/* bitesite/app/api/health/route.ts */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Health check, also called once a day by the Vercel cron in vercel.json.
 *
 * The database runs on Supabase's free plan, which pauses a project after about a week without
 * requests. With few visitors that could take the live site down unnoticed, so this route makes
 * one tiny public read (one area name, row level security applies) every day. It returns only
 * up / down, never data, so it is safe to leave public and to point an uptime monitor at.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await supabase.from("areas").select("name").limit(1);
  return NextResponse.json(
    { ok: !error, database: error ? "unreachable" : "up", checkedAt: new Date().toISOString() },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
