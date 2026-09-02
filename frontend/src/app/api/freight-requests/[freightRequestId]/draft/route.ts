import { NextResponse } from "next/server";

import {
  RecommendationDraftError,
  applyFreightRequestRecommendation,
  getFreightRequestDraft,
} from "@/features/recommendations/recommendation-draft-server";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof RecommendationDraftError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.httpStatus, headers: { "Cache-Control": "no-store" } },
    );
  }
  const message = error instanceof Error ? error.message : "Internal error";
  const status = message.startsWith("UNAUTHENTICATED")
    ? 401
    : message.startsWith("FORBIDDEN")
      ? 403
      : 500;
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "DRAFT_UNAVAILABLE",
        message,
      },
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ freightRequestId: string }> },
) {
  try {
    const { freightRequestId } = await context.params;
    return NextResponse.json(
      { ok: true, data: await getFreightRequestDraft(freightRequestId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ freightRequestId: string }> },
) {
  try {
    const { freightRequestId } = await context.params;
    const body = await request.json();
    return NextResponse.json(
      { ok: true, data: { draft: await applyFreightRequestRecommendation(freightRequestId, body) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
