/* bitesite/lib/supabase-admin.ts */
/**
 * SERVER-ONLY Supabase client that uses the service-role key.
 *
 * SECURITY RULES (do not relax):
 *  - The key comes from SUPABASE_SERVICE_ROLE_KEY. That name must NEVER get a
 *    NEXT_PUBLIC_ prefix, or Next.js would ship it to every visitor's browser.
 *  - This module must only be imported from server code (app/api/**, server
 *    components, server actions). `import "server-only"` makes the build fail
 *    if a client component ever imports it.
 *  - The service-role key BYPASSES Row Level Security. Every caller must
 *    authenticate the request first (e.g. verifyAdminToken) or be a narrowly
 *    scoped, input-validated public write (track / view counters).
 *  - It is a short-term bridge, NOT a replacement for RLS. RLS stays on for
 *    everything the browser (anon key) can reach.
 *  - Never log this client, its options, or the key.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    // Deliberately do not include any value in the message.
    throw new Error(
      "Supabase admin client is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server."
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}

/**
 * Lazy proxy: the client (and the env-var check) is created on first use, so
 * `next build` can import route modules without the secret being present.
 * Usage: `import { supabaseAdmin as supabase } from "@/lib/supabase-admin";`
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
