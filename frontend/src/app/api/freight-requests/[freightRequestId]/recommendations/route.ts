import { NextResponse } from "next/server";

import {
  RecommendationDraftError,
  getFreightRequestRecommendations,
} from "@/features/recommendations/recommendation-draft-server";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof RecommendationDraftError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
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
    { code: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "DRAFT_UNAVAILABLE", message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ freightRequestId: string }> },
) {
  try {
    const { freightRequestId } = await context.params;
    const draftVersion = Number(new URL(request.url).searchParams.get("draftVersion"));
    const result = await getFreightRequestRecommendations(freightRequestId, draftVersion);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
