import { NextResponse } from "next/server";
import { InterpretationRequestSchema } from "@/features/v2-conversation-prep/interpretation";
import { interpretConversationTurn } from "@/server/conversation/interpret";

export const runtime = "nodejs";

// Development-only conversation probe. It cannot create, read, or evaluate freight requests.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const target = new URL(request.url);
  const origin = request.headers.get("origin");
  let source: URL | null = null;
  try { source = origin ? new URL(origin) : null; } catch { /* Reject malformed origins. */ }
  const loopback = source && ["localhost", "127.0.0.1"].includes(source.hostname) &&
    ["localhost", "127.0.0.1"].includes(target.hostname) && source.port === target.port && source.protocol === target.protocol;
  if (!loopback) {
    return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 413 });
  }
  try {
    const input = InterpretationRequestSchema.parse(await request.json());
    return NextResponse.json(await interpretConversationTurn(input), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
}
