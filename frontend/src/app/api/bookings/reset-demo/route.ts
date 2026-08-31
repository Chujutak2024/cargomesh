import { NextRequest, NextResponse } from "next/server";
import { BookingBridgeError, reset_demo_booking_runtime } from "@/features/booking";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { freightRequestId?: unknown };
    if (typeof body.freightRequestId !== "string") {
      return NextResponse.json({ ok: false, error: { code: "INVALID_ARGUMENT", message: "freightRequestId is required." } }, { status: 400 });
    }
    const data = await reset_demo_booking_runtime(body.freightRequestId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof BookingBridgeError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.httpStatus });
    }
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.startsWith("UNAUTHENTICATED") ? 401 : message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ ok: false, error: { code: "BOOKING_DEMO_RESET_FAILED", message } }, { status });
  }
}
