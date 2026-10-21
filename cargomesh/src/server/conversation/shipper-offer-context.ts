import "server-only";
import { z } from "zod";
import { FreightRequestV2ResponseSchema } from "@/shared/schemas/v2/freight-request";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import type { V2Actor } from "@/server/modules/freight-requests/application/draft-service";
import { getV2Draft } from "@/server/modules/freight-requests/application/draft-service";
import { SupabaseV2DraftRepository } from "@/server/modules/freight-requests/infrastructure/supabase-draft-repository";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { WorkflowServiceV2 } from "@/server/modules/workflow/application/workflow-service";
import { workflowRepositoryV2 } from "@/server/modules/workflow/infrastructure/supabase-workflow-repository";
import { collectOperationsPages, type OperationsPage } from "@/server/services/v2-workspace/operations-collection";
import { latestRecord, type WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import type { CommercialContext } from "@/features/shipper-portal/commercial-context";
import { buildOfferBriefing } from "@/features/shipper-portal/offer-briefing";

type Kind = "plans" | "opportunities" | "offers" | "ranking";
export type OfferContextReads = {
  request: (id: string) => Promise<unknown>;
  workflow: (kind: Kind, requestId: string, page: { limit: number; offset: number }) => Promise<OperationsPage<WorkflowRecordV2>>;
};

/** Authenticated server reads only; never trust commercial facts supplied in a browser transcript. */
export async function collectShipperOfferContext(requestId: string, organizationId: string, reads: OfferContextReads): Promise<CommercialContext> {
  z.string().uuid().parse(requestId); z.string().uuid().parse(organizationId);
  const request = FreightRequestV2ResponseSchema.shape.data.parse(await reads.request(requestId));
  if (request.id !== requestId || request.organizationId !== organizationId) throw new Error("FORBIDDEN_OFFER_SCOPE");
  const kinds: Kind[] = ["plans", "opportunities", "offers", "ranking"];
  const pages = await Promise.all(kinds.map(async kind => {
    const result = await collectOperationsPages(page => reads.workflow(kind, requestId, page), raw => {
      const row = WorkflowRecordV2Schema.parse(raw);
      if (row.kind !== kind || row.requestId !== requestId || row.organizationId !== organizationId) throw new Error("FORBIDDEN_OFFER_SCOPE");
    });
    if (!result.complete || result.error) throw new Error("INCOMPLETE_OFFER_CONTEXT");
    return result.data;
  }));
  const rows = Object.fromEntries(kinds.map((kind, index) => [kind, pages[index]]));
  return { request,
    plans: rows.plans.filter((r): r is CommercialContext["plans"][number] => r.kind === "plans"),
    opportunities: rows.opportunities.filter((r): r is CommercialContext["opportunities"][number] => r.kind === "opportunities"),
    offers: rows.offers.filter((r): r is CommercialContext["offers"][number] => r.kind === "offers"),
    ranking: latestRecord(rows.ranking.filter((r): r is NonNullable<CommercialContext["ranking"]> => r.kind === "ranking")) };
}

export async function readShipperOfferBriefing(actor: V2Actor, requestId: string) {
  const repository = new SupabaseV2DraftRepository(await createV2ServerSupabaseClient());
  const workflow = new WorkflowServiceV2(await workflowRepositoryV2());
  const context = await collectShipperOfferContext(requestId, actor.organizationId, {
    request: async id => (await getV2Draft(id, actor, repository)).data,
    workflow: async (kind, id, page) => {
      const result = await workflow.read(actor, kind, { requestId: id, carrierId: null, parentId: null, id: null }, page);
      if (!Array.isArray(result.data)) throw new Error("INVALID_OFFER_COLLECTION");
      return { data: result.data, meta: result.meta };
    },
  });
  const briefing = buildOfferBriefing(context.offers, context.ranking, Date.now(), context);
  const [{quoteRpc},{quoteHistoryScript,quoteVoiceScript,quoteVoicePlanFacts}] = await Promise.all([
    import("@/server/modules/commercial/infrastructure/supabase-quotes"),
    import("@/server/modules/commercial/domain/quote-history")]);
  let historical = "Historical data is unavailable. Do not invent a historical price.";
  try { historical = quoteHistoryScript(await quoteRpc("read_v2_quote_history",{
    p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:requestId})); }
  catch { /* Preserve the verified current offer context if the history rollout is pending. */ }
  return {...briefing,script:quoteVoiceScript({count:briefing.currentOfferCount,options:quoteVoicePlanFacts(briefing.options,context),recommended:briefing.recommended?.position??null,status:context.request.status,weight:context.request.cargoSpecification.totalWeightKg,volume:context.request.cargoSpecification.totalVolumeM3,origin:context.request.origin.city??context.request.origin.label,destination:context.request.destination.city??context.request.destination.label},historical)};
}
