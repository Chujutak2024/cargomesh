import { NextRequest, NextResponse } from "next/server";
import { BookingBridgeError, reset_demo_booking_runtime } from "@/features/booking";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function performReset(freightRequestId?: string | null, fullClean: boolean = true) {
  const admin = createAdminClient();
  let requestId = freightRequestId;

  if (!requestId) {
    const { data: fr } = await admin
      .from("freight_requests")
      .select("id")
      .eq("code", "FR-1042")
      .maybeSingle();
    if (fr) requestId = fr.id;
  }

  if (!requestId) {
    throw new Error("FR-1042 FreightRequest not found.");
  }

  let resetData = null;
  try {
    resetData = await reset_demo_booking_runtime(requestId);
  } catch {
    // If runtime had no active bookings, continue to reset freight request
  }

  // Restore canonical budget_max = 2000 so Inca ($1,920) is eligible with canonical score 84
  await admin
    .from("freight_requests")
    .update({
      budget_max: 2000,
      status: "PENDING",
    })
    .eq("id", requestId);

  if (fullClean) {
    await admin.from("freight_decisions").delete().eq("freight_request_id", requestId);
    await admin.from("carrier_offers").delete().eq("freight_request_id", requestId);
    await admin.from("orchestration_runs").delete().eq("freight_request_id", requestId);
    await admin.from("bookings").delete().eq("freight_request_id", requestId);
  }

  return {
    freightRequestId: requestId,
    code: "FR-1042",
    budgetMax: 2000,
    status: "PENDING",
    bookingRuntimeReset: resetData,
    cleanMessage: "FR-1042 reset to clean PENDING state with budget_max=2000 (Inca eligible: 84 pts)",
  };
}

export async function GET() {
  try {
    const result = await performReset();
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: { code: "RESET_FAILED", message } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { freightRequestId?: unknown; fullClean?: boolean };
    const requestId = typeof body.freightRequestId === "string" ? body.freightRequestId : null;
    const fullClean = body.fullClean !== false;

    const data = await performReset(requestId, fullClean);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof BookingBridgeError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.httpStatus });
    }
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: { code: "BOOKING_DEMO_RESET_FAILED", message } }, { status: 500 });
  }
}
