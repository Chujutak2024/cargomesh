import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { hasSessionOrigin } from "@/server/auth/session-origin";
import { requireAuthenticatedMember } from "@/server/auth/member";

export const runtime = "nodejs";

const ISSUER = "cargomesh-web";
const AUDIENCE = "cargomesh-voice-gateway";

export async function POST(request: Request) {
  if (!hasSessionOrigin(request)) {
    return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  }
  const secret = process.env.CARGOMESH_VOICE_BRIDGE_SECRET;
  const rawUrl = process.env.CARGOMESH_VOICE_WS_URL;
  if (!secret || Buffer.byteLength(secret) < 32 || !rawUrl) {
    return NextResponse.json({ error: "VOICE_UNAVAILABLE" }, { status: 503 });
  }
  let wsUrl: URL;
  try {
    wsUrl = new URL(rawUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(wsUrl.hostname);
    if (wsUrl.username || wsUrl.password || wsUrl.search || wsUrl.hash
      || !["ws:", "wss:"].includes(wsUrl.protocol)
      || (process.env.NODE_ENV === "production" && wsUrl.protocol !== "wss:")
      || (wsUrl.protocol === "ws:" && (!local || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)))) {
      throw new Error("Invalid voice gateway URL");
    }
  } catch {
    return NextResponse.json({ error: "VOICE_UNAVAILABLE" }, { status: 503 });
  }
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  let preview = false;
  try {
    const body = await request.json() as unknown;
    preview = typeof body === "object" && body !== null && "preview" in body && body.preview === true;
  } catch { /* Ordinary authenticated requests need no body. */ }
  const localPreview = preview && process.env.NODE_ENV !== "production"
    && process.env.CARGOMESH_NOVA_DEMO_VOICE === "true"
    && localHosts.includes(new URL(request.url).hostname)
    && localHosts.includes(new URL(request.headers.get("origin") ?? "").hostname);
  if (preview && !localPreview) {
    return NextResponse.json({ error: "VOICE_UNAVAILABLE" }, { status: 403 });
  }
  let identity: { userId: string; organizationId: string; memberId: string };
  if (localPreview) {
    identity = { userId: "local-voice-preview", organizationId: "synthetic-preview", memberId: "local-voice-preview" };
  } else {
    try {
      identity = await requireAuthenticatedMember();
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }
  const token = await new SignJWT({ organizationId: identity.organizationId, memberId: identity.memberId, preview: localPreview })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(identity.userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("45s")
    .sign(new TextEncoder().encode(secret));
  return NextResponse.json({ schemaVersion: "2.0", wsUrl: wsUrl.toString(), token, expiresInSeconds: 45 }, {
    headers: { "Cache-Control": "no-store, private" },
  });
}
