import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database-v2.types";
import { currentMcpSupabaseAccessToken } from "@/server/mcp/auth/request-context";

/** Typed against the HAC-29 clean bootstrap plus the HAC-12 ROAD delta. */
type V2Client = ReturnType<typeof createClient<Database>>;

export async function createV2ServerSupabaseClient(): Promise<V2Client> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing V2 Supabase URL or anon key.");

  const requestToken = currentMcpSupabaseAccessToken();
  if (requestToken) {
    return createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${requestToken}` } },
    });
  }

  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A Server Component cannot mutate cookies; route handlers can.
        }
      },
    },
  }) as unknown as V2Client;
}
