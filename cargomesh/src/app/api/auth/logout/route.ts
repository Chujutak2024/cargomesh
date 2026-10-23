import {assignedDemoEnabled} from '@/server/auth/assigned-demo';
import {workspaceDemoEnabled} from '@/server/auth/workspace-demo';
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { hasSessionOrigin } from "@/server/auth/session-origin";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store, private" };
  if (!hasSessionOrigin(request)) return Response.json({ ok: false }, { status: 403, headers });
  const db = await createV2ServerSupabaseClient();
  const demoSession=await assignedDemoEnabled()||await workspaceDemoEnabled();
  const { error } = await db.auth.signOut(demoSession?{scope:'local'}:undefined);
  if (error) return Response.json({ ok: false }, { status: 503, headers });
  return new Response(null, { status: 303, headers: { ...headers, Location: "/" } });
}
