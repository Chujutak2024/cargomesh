import { NextRequest, NextResponse } from "next/server";
import { BookingBridgeError, get_booking_view_model } from "@/features/booking";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await context.params;
    const data = await get_booking_view_model(bookingId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof BookingBridgeError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.httpStatus });
    }
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.startsWith("UNAUTHENTICATED") ? 401 : message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ ok: false, error: { code: "BOOKING_VIEW_MODEL_FAILED", message } }, { status });
  }
}
