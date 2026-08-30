import { NextRequest, NextResponse } from "next/server";
import { OrchestrationError } from "@/features/orchestration/contracts";
import { start_orchestration_run } from "@/features/orchestration/start-run";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
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
    { ok: false, error: { code: "ORCHESTRATION_START_FAILED", message } },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const result = await start_orchestration_run(body);
    return NextResponse.json({ ok: true, data: result }, { status: result.deduplicated ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
