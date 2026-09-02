import { NextResponse } from "next/server";

import {
  RecommendationDraftError,
  persistManualFreightRequestIntake,
} from "@/features/freight-requests/manual-intake-server";

export const dynamic = "force-dynamic";
const privateNoStore = { "cache-control": "private, no-store" };

function errorResponse(error: unknown) {
  if (error instanceof RecommendationDraftError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.httpStatus, headers: privateNoStore },
    );
  }
  const message = error instanceof Error ? error.message : "Internal error";
  const status = message.startsWith("UNAUTHENTICATED") ? 401 : message.startsWith("FORBIDDEN") ? 403 : 500;
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "DRAFT_UNAVAILABLE",
        message: status === 500 ? "No fue posible guardar el borrador manual." : message,
      },
    },
    { status, headers: privateNoStore },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ freightRequestId: string }> },
) {
  try {
    const [{ freightRequestId }, body] = await Promise.all([context.params, request.json()]);
    return NextResponse.json(
      { ok: true, data: await persistManualFreightRequestIntake(freightRequestId, body) },
      { headers: privateNoStore },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
