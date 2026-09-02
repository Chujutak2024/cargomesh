import { NextResponse } from "next/server";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const member = await requireAuthenticatedMember(); const supabase = await createServerSupabaseClient();
    const { data: requests } = await supabase.from("freight_requests").select("id,code").eq("organization_id", member.organizationId);
    const rows = (requests ?? []) as unknown as Array<{ id: string; code: string }>;
    if (!rows.length) return NextResponse.json({ events: [] });
    const codes = new Map(rows.map((row) => [row.id, row.code]));
    const { data: runs } = await supabase.from("orchestration_runs").select("id,freight_request_id,status").in("freight_request_id", [...codes.keys()]).order("started_at", { ascending: false }).limit(10);
    const runRows = (runs ?? []) as unknown as Array<{ id: string; freight_request_id: string; status: string }>;
    if (!runRows.length) return NextResponse.json({ events: [] });
    const runMap = new Map(runRows.map((run) => [run.id, run]));
    const { data: events, error } = await supabase.from("orchestration_events").select("id,orchestration_run_id,event_type,provider_url,navigation_url,tool_name,input_payload,output_payload,duration_ms,status,execution_status,persisted_entity_type,persisted_entity_id,created_at").in("orchestration_run_id", [...runMap.keys()]).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "EVIDENCE_UNAVAILABLE" }, { status: 500 });
    return NextResponse.json({ events: ((events ?? []) as unknown as Array<Record<string, unknown>>).map((event) => { const run = runMap.get(String(event.orchestration_run_id)); return { ...event, requestCode: run ? codes.get(run.freight_request_id) : null, runStatus: run?.status ?? null }; }) });
  } catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }
}
