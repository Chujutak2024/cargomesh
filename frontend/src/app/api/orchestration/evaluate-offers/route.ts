import { NextRequest, NextResponse } from "next/server";
import { evaluate_offers } from "@/features/decision-engine";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { orchestrationRunId?: unknown };
    if (typeof body.orchestrationRunId !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_ARGUMENT", message: "orchestrationRunId is required" } },
        { status: 400 },
      );
    }

    const result = await evaluate_offers(body.orchestrationRunId);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.startsWith("UNAUTHENTICATED")
      ? 401
      : message.startsWith("FORBIDDEN")
        ? 403
        : message.startsWith("INVALID_ARGUMENT")
          ? 400
          : message.startsWith("NOT_FOUND")
            ? 404
            : message.startsWith("RUN_NOT_ACTIVE")
              ? 409
              : 500;

    return NextResponse.json(
      { ok: false, error: { code: "EVALUATION_FAILED", message } },
      { status },
    );
  }
}
