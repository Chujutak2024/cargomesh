import {buildVoiceIntakeCatalog} from "@/server/conversation/voice-intake-catalog";
import {assignedDemoConfig} from '@/server/auth/assigned-demo';
import {assignedVoicePreviewAllowed} from '@/server/auth/assigned-demo-policy';
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { hasSessionOrigin } from "@/server/auth/session-origin";
import { requireAuthenticatedMember } from "@/server/auth/member";
import { z } from "zod";
import { VoiceDraftContextSchema, type VoiceDraftContext } from "@/features/v2-conversation-prep/voice-draft-context";
import { carrierVoiceOpportunity, voiceFact } from "@/server/conversation/carrier-voice-scope";
import { readCarrierBriefing } from "@/server/conversation/carrier-briefing";
import { readShipperOfferBriefing } from "@/server/conversation/shipper-offer-context";

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
  let language: "es" | "en" = "en";
  let draftContext: VoiceDraftContext | undefined;
  try {
    const body = await request.json() as unknown;
    if (typeof body === "object" && body !== null) {
      const session = z.object({ language: z.enum(["es", "en"]).optional(), draftContext: VoiceDraftContextSchema.optional() }).safeParse(body);
      if (!session.success) return NextResponse.json({ error: "INVALID_DRAFT_CONTEXT" }, { status: 400 });
      language = session.data.language ?? "en";
      draftContext = session.data.draftContext;
    }
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
        briefing: await readCarrierBriefing(actor,row),
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
        const actor = await requireAuthenticatedMember({ organizationId: identity.organizationId });
        const briefing = await readShipperOfferBriefing(actor, offerRequestId);
        voiceScope = { role: "shipper_offers", offerBriefing: briefing.script.slice(0, 1600) };
      } catch {
        return NextResponse.json({ error: "FORBIDDEN_OFFER_SCOPE" }, { status: 403 });
      }
    }
  }
  voiceScope = { ...voiceScope, language };
  if (!carrierScope && !offerRequestId && draftContext) voiceScope = { ...voiceScope, draftContext };
  if (!carrierScope && voiceContext.length) voiceScope = { ...voiceScope,
    voiceContext: voiceContext.slice(offerRequestId ? -6 : -12).map((turn) => turn.slice(0, offerRequestId ? 160 : 180)) };
  if (!carrierScope && !offerRequestId) {
    try {
      const catalog = voicePreview
        ? (await import("@/features/v2-intake/fixtures/intake-options.fixture")).INTAKE_OPTIONS_FIXTURE.data
        : await (await import("@/server/modules/intake/application/get-intake-options")).getIntakeOptions(identity,
            await (await import("@/server/modules/intake/infrastructure/supabase-intake-options-repository")).v2IntakeOptionsRepository()).then(result => result.data);
      voiceScope = { ...voiceScope,
        facilityCatalog: {
          complete: catalog.facilities.length <= 40,
          locations: catalog.facilities.slice(0, 40).map(facility => `${facility.city.slice(0, 80)}, ${facility.countryCode.slice(0, 3)}`),
          facilities: catalog.facilities.slice(0, 40).map(facility => ({ id: facility.id, label: facility.label.slice(0, 120), city: facility.city.slice(0, 80) })),
        },
        // Enable after the gateway accepts 64 KiB signed envelopes; older deployments cap auth at 4 KiB.
        intakeCatalog: process.env.CARGOMESH_VOICE_EXTENDED_CATALOG === "true"
          ? buildVoiceIntakeCatalog(catalog) : {
            complete: catalog.cargoCategories.length <= 16 && catalog.equipmentOptions.length <= 30,
            categories: catalog.cargoCategories.slice(0,16).map(item=>({code:item.code,label:item.name.slice(0,100)})),
            equipment: catalog.equipmentOptions.slice(0,30).map(item=>({code:item.code,label:item.label.slice(0,100)})),
          },
      };
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
