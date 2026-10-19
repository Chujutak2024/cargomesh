import {assignedDemoConfig} from '@/server/auth/assigned-demo';
import {assignedVoicePreviewAllowed} from '@/server/auth/assigned-demo-policy';
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { hasSessionOrigin } from "@/server/auth/session-origin";
import { requireAuthenticatedMember } from "@/server/auth/member";
import { z } from "zod";
import { carrierVoiceOpportunity, voiceFact } from "@/server/conversation/carrier-voice-scope";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import { buildOfferBriefing } from "@/features/shipper-portal/offer-briefing";
import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";

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
  let offerRequestId: string | null = null;
  let voiceContext: string[] = [];
  try {
    const body = await request.json() as unknown;
    preview = typeof body === "object" && body !== null && "preview" in body && body.preview === true;
    if (typeof body === "object" && body !== null && "voiceContext" in body) {
      const parsed = z.array(z.string().min(1).max(320)).max(16).safeParse(body.voiceContext);
      if (!parsed.success) return NextResponse.json({ error: "INVALID_VOICE_CONTEXT" }, { status: 400 });
      voiceContext = parsed.data;
    }
    if (typeof body === "object" && body !== null && "carrierId" in body) {
      const parsed = z.object({ carrierId: z.string().uuid(), opportunityId: z.string().uuid() }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "INVALID_VOICE_SCOPE" }, { status: 400 });
      carrierScope = parsed.data;
    }
    if (typeof body === "object" && body !== null && "offerRequestId" in body && body.offerRequestId !== undefined) {
      const parsed = z.string().uuid().safeParse(body.offerRequestId);
      if (!parsed.success) return NextResponse.json({ error: "INVALID_OFFER_SCOPE" }, { status: 400 });
      offerRequestId = parsed.data;
    }
  } catch { /* Ordinary authenticated requests need no body. */ }
  const localPreview = preview && process.env.NODE_ENV !== "production"
    && process.env.CARGOMESH_NOVA_DEMO_VOICE === "true"
    && localHosts.includes(new URL(request.url).hostname)
    && localHosts.includes(new URL(request.headers.get("origin") ?? "").hostname);
  const hostedPreview=assignedVoicePreviewAllowed(assignedDemoConfig(),request,preview);
  const voicePreview=localPreview||hostedPreview;
  if (preview && (!voicePreview || carrierScope || offerRequestId) || carrierScope && offerRequestId) {
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
  } else if (voicePreview) {
    const profile=hostedPreview?"hosted-demo-voice":"local-voice-preview";
    identity = { userId: profile, organizationId: "synthetic-preview", memberId: profile };
  } else {
    try {
      identity = await requireAuthenticatedMember();
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (offerRequestId) {
      try {
        const { createServerSupabaseClient } = await import("@/server/db/supabase/server");
        const db = await createServerSupabaseClient();
        const { data: requestRow, error } = await db.from("freight_requests")
          .select("id").eq("id", offerRequestId).eq("organization_id", identity.organizationId).maybeSingle();
        if (error || !requestRow) throw new Error("REQUEST_NOT_FOUND");
        const { WorkflowServiceV2 } = await import("@/server/modules/workflow/application/workflow-service");
        const { workflowRepositoryV2 } = await import("@/server/modules/workflow/infrastructure/supabase-workflow-repository");
        const workflow = new WorkflowServiceV2(await workflowRepositoryV2());
        const actor = await requireAuthenticatedMember({ organizationId: identity.organizationId });
        const read = async (kind: "offers" | "ranking") => {
          const rows: WorkflowRecordV2[] = [];
          let offset = 0;
          for (let page = 0; page < 10; page++) {
            const result = await workflow.read(actor, kind,
              { requestId: offerRequestId, carrierId: null, parentId: null, id: null }, { limit: 100, offset });
            const parsed = z.array(WorkflowRecordV2Schema).parse(result.data);
            if (parsed.some((row) => row.kind !== kind || row.requestId !== offerRequestId || row.organizationId !== identity.organizationId)) throw new Error("INVALID_OFFER_SCOPE");
            rows.push(...parsed);
            if (result.meta?.nextOffset == null) return rows;
            if (result.meta.nextOffset <= offset) throw new Error("INVALID_OFFER_PAGE");
            offset = result.meta.nextOffset;
          }
          throw new Error("PARTIAL_OFFER_READ");
        };
        const offerRows = (await read("offers")).filter((row): row is Extract<WorkflowRecordV2, { kind: "offers" }> => row.kind === "offers");
        const rankingRows = (await read("ranking")).filter((row): row is Extract<WorkflowRecordV2, { kind: "ranking" }> => row.kind === "ranking");
        const latestRanking = rankingRows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
        voiceScope = { role: "shipper_offers", offerBriefing: buildOfferBriefing(offerRows, latestRanking).script.slice(0, 1600) };
      } catch {
        return NextResponse.json({ error: "FORBIDDEN_OFFER_SCOPE" }, { status: 403 });
      }
    }
  }
  if (!carrierScope && voiceContext.length) voiceScope = { ...voiceScope,
    voiceContext: voiceContext.slice(offerRequestId ? -6 : -12).map((turn) => turn.slice(0, offerRequestId ? 160 : 180)) };
  if (!carrierScope && !offerRequestId) {
    try {
      const facilities = voicePreview
        ? (await import("@/features/v2-intake/fixtures/intake-options.fixture")).INTAKE_OPTIONS_FIXTURE.data.facilities
            .map((facility) => ({ city: facility.city, countryCode: facility.countryCode }))
        : await (await (await import("@/server/modules/intake/infrastructure/supabase-intake-options-repository"))
            .v2IntakeOptionsRepository()).listActiveFacilities(identity.organizationId)
            .then((rows) => rows.filter((row) => row.active && row.organization_id === identity.organizationId)
              .map((row) => ({ city: row.city, countryCode: row.country_code })));
      voiceScope = { ...voiceScope, facilityCatalog: {
        complete: facilities.length <= 40,
        locations: facilities.slice(0, 40).map((facility) => `${facility.city.slice(0, 80)}, ${facility.countryCode.slice(0, 3)}`),
      } };
    } catch {
      voiceScope = { ...voiceScope, facilityCatalog: { complete: false, locations: [] } };
    }
  }
  const token = await new SignJWT({ organizationId: identity.organizationId, memberId: identity.memberId, preview: voicePreview, ...voiceScope })
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
