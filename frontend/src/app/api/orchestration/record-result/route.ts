import { NextRequest, NextResponse } from "next/server";
import {
  record_provider_result,
  ResultBridgeError,
} from "@/features/result-bridge";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const result = await record_provider_result(await request.json());
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof ResultBridgeError) {
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

    return NextResponse.json(
      { ok: false, error: { code: "RECORD_PROVIDER_RESULT_FAILED", message } },
      { status },
    );
  }
}
