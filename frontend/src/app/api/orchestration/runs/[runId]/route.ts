import { NextRequest, NextResponse } from "next/server";
import { OrchestrationError } from "@/features/orchestration/contracts";
import { get_orchestration_view_model } from "@/features/orchestration/view-model-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    const result = await get_orchestration_view_model(runId);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof OrchestrationError) {
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
      { ok: false, error: { code: "ORCHESTRATION_VIEW_MODEL_FAILED", message } },
      { status },
    );
  }
}
