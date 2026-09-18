import { NextRequest, NextResponse } from "next/server";
import { get_candidate_provider_pages } from "@/features/discovery";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestParam = searchParams.get("request") || searchParams.get("requestId");

    if (!requestParam) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_ARGUMENT", message: "request is required" } },
        { status: 400 },
      );
    }

    const discovery = await get_candidate_provider_pages(requestParam);

    if (!discovery) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "FreightRequest not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: discovery });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.startsWith("UNAUTHENTICATED")
      ? 401
      : message.startsWith("FORBIDDEN")
        ? 403
        : message.startsWith("INVALID_ARGUMENT")
          ? 400
          : 500;
    return NextResponse.json(
      { ok: false, error: { code: "DISCOVERY_FAILED", message } },
      { status },
    );
  }
}
