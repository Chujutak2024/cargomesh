import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { authenticatedLoginDestination } from "@/server/auth/carrier-portal";
import { LoginReturnToSchema } from "@/shared/schemas/v2/carrier-portal";
import { hasSessionOrigin } from "@/server/auth/session-origin";
const noStore = { "Cache-Control": "no-store, private" };
const Credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(1024), returnTo:LoginReturnToSchema.optional() }).strict();
export async function POST(request: Request) {
  if (!hasSessionOrigin(request)) return Response.json({ ok: false }, { status: 403, headers: noStore });
  const input = Credentials.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ ok: false }, { status: 400, headers: noStore });
  try {
    const db = await createV2ServerSupabaseClient();
    const { data, error } = await db.auth.signInWithPassword({email:input.data.email,password:input.data.password});
    if (error || !data.user) return Response.json({ ok: false }, { status: 401, headers: noStore });
    const destination=await authenticatedLoginDestination(input.data.returnTo);
    if(!destination){await db.auth.signOut();return Response.json({ok:false},{status:403,headers:noStore});}
    return Response.json({ok:true,destination},{headers:noStore});
  } catch { return Response.json({ ok: false }, { status: 503, headers: noStore }); }
}
