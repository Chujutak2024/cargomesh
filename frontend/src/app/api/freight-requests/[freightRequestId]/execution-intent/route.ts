import { NextResponse } from "next/server";

import {
  FreightRequestExecutionIntentError,
  getFreightRequestExecutionIntent,
} from "@/features/freight-requests/execution-intent-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ freightRequestId: string }> },
) {
  try {
    const { freightRequestId } = await context.params;
    const result = await getFreightRequestExecutionIntent(freightRequestId);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof FreightRequestExecutionIntentError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.httpStatus },
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
      { ok: false, error: { code, message } },
      { status },
    );
  }
}
