import { NextResponse } from "next/server";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    const member = await requireAuthenticatedMember();
    if (member.role !== "OWNER" && member.role !== "SUPERVISOR") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const input = await request.json() as Record<string, unknown>;
    const confidence = Number(input.confidenceThreshold);
    const anomaly = Number(input.anomalyThresholdPct);
    const wait = Number(input.maxPickupWaitHours);
    if (![confidence, anomaly, wait].every(Number.isFinite) || confidence < 0 || confidence > 100 || anomaly < 0 || anomaly > 100 || wait < 0) {
      return NextResponse.json({ error: "INVALID_PREFERENCES" }, { status: 400 });
    }
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("organization_preferences").update({
      confidence_threshold: confidence, anomaly_threshold_pct: anomaly, max_pickup_wait_hours: wait,
      allow_auto_booking: input.allowAutoBooking === true, allow_auto_recovery: input.allowAutoRecovery === true,
    } as never).eq("organization_id", member.organizationId);
    if (error) return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }
}
