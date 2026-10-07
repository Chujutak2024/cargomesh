import { NextRequest, NextResponse } from "next/server";
import { BookingBridgeError, record_provider_booking_status } from "@/features/booking";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof BookingBridgeError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.httpStatus });
  }
  const message = error instanceof Error ? error.message : "Internal error";
  const status = message.startsWith("UNAUTHENTICATED") ? 401 : message.startsWith("FORBIDDEN") ? 403 : 500;
  return NextResponse.json({ ok: false, error: { code: "BOOKING_STATUS_BRIDGE_FAILED", message } }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const data = await record_provider_booking_status(await request.json(), new URL(request.url).origin);
    return NextResponse.json({ ok: true, data }, { status: data.deduplicated ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
