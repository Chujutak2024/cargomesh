import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedMember } from "@/server/auth/member";
import { synthesizeConversationSpeech } from "@/server/conversation/speech";

export const runtime = "nodejs";

const RequestSchema = z.object({ text: z.string().trim().min(1).max(1000), language: z.enum(["es-PE", "en-US"]) }).strict();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  let source: URL | null = null;
  try { source = origin ? new URL(origin) : null; } catch { /* Invalid origins are rejected below. */ }
  const localAlias = source && ["localhost", "127.0.0.1"].includes(source.hostname) && ["localhost", "127.0.0.1"].includes(target.hostname) && source.port === target.port && source.protocol === target.protocol;
  if (origin && origin !== target.origin && !localAlias) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 415 });
  try { await requireAuthenticatedMember(); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 413 });
  let input: z.infer<typeof RequestSchema>;
  try { input = RequestSchema.parse(await request.json()); } catch { return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 }); }
  if (process.env.CARGOMESH_POLLY_VOICE_ENABLED !== "true") return NextResponse.json({ error: "VOICE_UNAVAILABLE" }, { status: 503 });
  try {
    const audio = await synthesizeConversationSpeech(input.text, input.language);
    return new Response(Buffer.from(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "VOICE_UNAVAILABLE" }, { status: 503 });
  }
}
