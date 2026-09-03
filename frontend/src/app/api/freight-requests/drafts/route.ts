import { NextResponse } from "next/server";

import {
  RecommendationDraftError,
  createFreightRequestDraftServer,
} from "@/features/freight-requests/draft-creation-server";

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
  const status = message.startsWith("UNAUTHENTICATED")
    ? 401
    : message.startsWith("FORBIDDEN")
      ? 403
      : 500;
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "DRAFT_CREATION_UNAVAILABLE",
        message: status === 500 ? "No fue posible crear el borrador en el servidor." : message,
      },
    },
    { status, headers: privateNoStore },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createFreightRequestDraftServer(body);
    return NextResponse.json(
      { ok: true, data: result },
      { status: 201, headers: privateNoStore },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
