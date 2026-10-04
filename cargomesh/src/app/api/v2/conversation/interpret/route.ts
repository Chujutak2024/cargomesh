import { NextResponse } from "next/server";
import { requireAuthenticatedMember } from "@/server/auth/member";
import { InterpretationRequestSchema } from "@/features/v2-conversation-prep/interpretation";
import { interpretConversationTurn } from "@/server/conversation/interpret";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  let source: URL | null = null;
  try { source = origin ? new URL(origin) : null; } catch { /* Reject malformed origins below. */ }
  const localAlias = source && ["localhost", "127.0.0.1"].includes(source.hostname) && ["localhost", "127.0.0.1"].includes(target.hostname) && source.port === target.port && source.protocol === target.protocol;
  if (origin && origin !== target.origin && !localAlias) {
    return NextResponse.json({ schemaVersion: "2.0", error: { code: "FORBIDDEN_ORIGIN", message: "This origin is not allowed." } }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ schemaVersion: "2.0", error: { code: "VALIDATION_ERROR", message: "JSON is required." } }, { status: 415 });
  }
  try {
    await requireAuthenticatedMember();
  } catch {
    return NextResponse.json({ schemaVersion: "2.0", error: { code: "UNAUTHORIZED", message: "An active CargoMesh session and organization membership are required." } }, { status: 401 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json({ schemaVersion: "2.0", error: { code: "VALIDATION_ERROR", message: "Message is too long." } }, { status: 413 });
  }
  let input;
  try {
    input = InterpretationRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ schemaVersion: "2.0", error: { code: "VALIDATION_ERROR", message: "Invalid conversation message." } }, { status: 400 });
  }
  const result = await interpretConversationTurn(input);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
