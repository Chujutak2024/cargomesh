import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const createClient = (cookieStore?: any) => {
  const store = cookieStore || cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return store.getAll ? store.getAll() : [];
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            if (store.set) store.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
};
