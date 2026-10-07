import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { hasSessionOrigin } from "@/server/auth/session-origin";
const noStore = { "Cache-Control": "no-store, private" };
const Credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(1024) }).strict();
export async function POST(request: Request) {
  if (!hasSessionOrigin(request)) return Response.json({ ok: false }, { status: 403, headers: noStore });
  const input = Credentials.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ ok: false }, { status: 400, headers: noStore });
  try {
    const db = await createV2ServerSupabaseClient();
    const { data, error } = await db.auth.signInWithPassword(input.data);
    if (error || !data.user) return Response.json({ ok: false }, { status: 401, headers: noStore });
    const { data: member, error: membershipError } = await db.from("organization_members").select("id")
      .eq("auth_user_id", data.user.id).eq("status", "ACTIVE").limit(1).maybeSingle();
    if (membershipError || !member) {
      await db.auth.signOut();
      return Response.json({ ok: false }, { status: membershipError ? 503 : 403, headers: noStore });
    }
    return Response.json({ ok: true }, { headers: noStore });
  } catch { return Response.json({ ok: false }, { status: 503, headers: noStore }); }
}
