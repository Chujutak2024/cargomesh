import { NextResponse } from "next/server";

import {
  FreightRequestIntakeError,
  getFreightRequestIntake,
} from "@/features/freight-requests/intake-server";

export const dynamic = "force-dynamic";
const privateNoStore = { "cache-control": "private, no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestCode: string }> },
) {
  try {
    const { requestCode } = await context.params;
    const result = await getFreightRequestIntake(requestCode);
    return NextResponse.json({ ok: true, data: result }, { headers: privateNoStore });
  } catch (error) {
    if (error instanceof FreightRequestIntakeError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.httpStatus, headers: privateNoStore },
      );
    }

    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.startsWith("UNAUTHENTICATED")
      ? 401
      : message.startsWith("FORBIDDEN")
        ? 403
        : 500;
    const code = status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR";
    return NextResponse.json(
      { ok: false, error: { code, message: status === 500 ? "Unable to load the FreightRequest intake." : message } },
      { status, headers: privateNoStore },
    );
  }
}
