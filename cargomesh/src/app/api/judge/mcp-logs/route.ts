import { NextResponse } from "next/server";
import { requireAuthenticatedMember } from "@/server/auth/member";
import { createServerSupabaseClient } from "@/server/db/supabase/server";

export async function GET() {
  let organizationId: string;
  try { organizationId = (await requireAuthenticatedMember()).organizationId; }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("mcp_audit_events")
      .select("id,source,tool_name,request_id,started_at,duration_ms,http_status,status,input_payload,output_payload")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ events: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "MCP_AUDIT_UNAVAILABLE" }, { status: 500 });
  }
}
