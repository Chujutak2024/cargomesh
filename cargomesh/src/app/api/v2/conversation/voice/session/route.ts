import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { hasSessionOrigin } from "@/server/auth/session-origin";
import { requireAuthenticatedMember } from "@/server/auth/member";
import { z } from "zod";
import { carrierVoiceOpportunity, voiceFact } from "@/server/conversation/carrier-voice-scope";

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
  let carrierScope: { carrierId: string; opportunityId: string } | null = null;
  try {
    const body = await request.json() as unknown;
    preview = typeof body === "object" && body !== null && "preview" in body && body.preview === true;
    if (typeof body === "object" && body !== null && "carrierId" in body) {
      const parsed = z.object({ carrierId: z.string().uuid(), opportunityId: z.string().uuid() }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "INVALID_VOICE_SCOPE" }, { status: 400 });
      carrierScope = parsed.data;
    }
  } catch { /* Ordinary authenticated requests need no body. */ }
  const localPreview = preview && process.env.NODE_ENV !== "production"
    && process.env.CARGOMESH_NOVA_DEMO_VOICE === "true"
    && localHosts.includes(new URL(request.url).hostname)
    && localHosts.includes(new URL(request.headers.get("origin") ?? "").hostname);
  if (preview && (!localPreview || carrierScope)) {
    return NextResponse.json({ error: "VOICE_UNAVAILABLE" }, { status: 403 });
  }
  let identity: { userId: string; organizationId: string; memberId: string };
  let voiceScope: Record<string, unknown> = { role: "shipper" };
  if (carrierScope) {
    try {
      const { requireAuthenticatedCarrier } = await import("@/server/auth/carrier");
      const { WorkflowServiceV2 } = await import("@/server/modules/workflow/application/workflow-service");
      const { workflowRepositoryV2 } = await import("@/server/modules/workflow/infrastructure/supabase-workflow-repository");
      const actor = await requireAuthenticatedCarrier(carrierScope.carrierId);
      const result = await new WorkflowServiceV2(await workflowRepositoryV2()).read(actor, "opportunities", {
        carrierId: actor.carrierId, requestId: null, parentId: null, id: carrierScope.opportunityId,
      }, { limit: 1, offset: 0 });
      const row = carrierVoiceOpportunity(result.data, actor.carrierId, carrierScope.opportunityId);
      voiceScope = { role: "carrier", opportunity: {
        route: `${voiceFact(row.data.origin.city ?? row.data.origin.label)} to ${voiceFact(row.data.destination.city ?? row.data.destination.label)}`,
        cargo: voiceFact(row.data.cargoSpecification.categoryCode),
        responseDeadline: voiceFact(row.data.responseDeadline),
      } };
      identity = { userId: actor.userId, organizationId: actor.carrierId, memberId: actor.operatorId };
    } catch {
      return NextResponse.json({ error: "FORBIDDEN_VOICE_SCOPE" }, { status: 403 });
    }
  } else if (localPreview) {
    identity = { userId: "local-voice-preview", organizationId: "synthetic-preview", memberId: "local-voice-preview" };
  } else {
    try {
      identity = await requireAuthenticatedMember();
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }
  const token = await new SignJWT({ organizationId: identity.organizationId, memberId: identity.memberId, preview: localPreview, ...voiceScope })
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
