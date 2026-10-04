import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CreateFreightRequestV2InputSchema, FreightRequestV2ResponseSchema } from "@/shared/schemas/v2/freight-request";
import { RoadServiceabilityEvaluationV2ResponseSchema } from "@/shared/schemas/v2/serviceability";
import { createV2Draft, getV2Draft, V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { evaluateV2RoadByRequestId } from "@/server/modules/road-serviceability/application/evaluate-v2-road";
import type { McpPrincipal } from "../auth/principal";

const CreateInput = z.object({ idempotencyKey: z.string().uuid(), request: CreateFreightRequestV2InputSchema }).strict();
const ReadInput = z.object({ requestId: z.string().uuid() }).strict();
const EvaluateInput = ReadInput.extend({ expectedDraftVersion: z.number().int().positive() }).strict();
const DraftOutput = z.object({ ok: z.literal(true), data: FreightRequestV2ResponseSchema }).strict();
const RoadOutput = z.object({ ok: z.literal(true), data: RoadServiceabilityEvaluationV2ResponseSchema }).strict();

type Actor = { memberId: string; organizationId: string };
export type V2RoadToolServices = {
  create(input: z.infer<typeof CreateInput>, actor: Actor): Promise<z.infer<typeof FreightRequestV2ResponseSchema>>;
  read(input: z.infer<typeof ReadInput>, actor: Actor): Promise<z.infer<typeof FreightRequestV2ResponseSchema>>;
  evaluate(input: z.infer<typeof EvaluateInput>, actor: Actor): Promise<z.infer<typeof RoadServiceabilityEvaluationV2ResponseSchema>>;
};

export const persistedV2RoadToolServices: V2RoadToolServices = {
  async create(input, actor) {
    const { v2DraftRepository } = await import("@/server/modules/freight-requests/infrastructure/supabase-draft-repository");
    return createV2Draft(input.request, input.idempotencyKey, actor, await v2DraftRepository());
  },
  async read(input, actor) {
    const { v2DraftRepository } = await import("@/server/modules/freight-requests/infrastructure/supabase-draft-repository");
    return getV2Draft(input.requestId, actor, await v2DraftRepository());
  },
  async evaluate(input, actor) {
    const [{ v2DraftRepository }, { createV2ServerSupabaseClient }, { loadRoadServices }] = await Promise.all([
      import("@/server/modules/freight-requests/infrastructure/supabase-draft-repository"),
      import("@/server/db/supabase/v2"),
      import("@/server/modules/road-serviceability/infrastructure/supabase-road-catalog"),
    ]);
    const [drafts, db] = await Promise.all([v2DraftRepository(), createV2ServerSupabaseClient()]);
    return evaluateV2RoadByRequestId(input.requestId, input.expectedDraftVersion, actor, drafts,
      { listRoadServices: () => loadRoadServices(db) });
  },
};

function requireActor(principal: McpPrincipal): Actor {
  if (principal.kind !== "user" || !principal.scopes.includes("mcp:tools") || principal.status !== "ACTIVE") {
    throw new Error("FORBIDDEN");
  }
  return { memberId: principal.memberId, organizationId: principal.organizationId };
}

function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof V2DraftError) {
    const descriptions: Record<string, string> = {
      VALIDATION_ERROR: "Review the freight details and try again.",
      UNAUTHORIZED: "Sign in before accessing a freight request.",
      FORBIDDEN_TENANT: "This request is not available in your organization.",
      IDEMPOTENCY_CONFLICT: "This retry key was used with different details.",
      REQUEST_NOT_FOUND: "The request was not found.",
      STALE_DRAFT: "The draft changed. Reload it before evaluating ROAD eligibility.",
    };
    return { code: error.code, message: descriptions[error.code] ?? "The V2 request could not be completed." };
  }
  if (error instanceof z.ZodError) return { code: "VALIDATION_ERROR", message: "Review the V2 request fields." };
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { code: "FORBIDDEN", message: "An authorized CargoMesh user is required." };
  }
  return { code: "V2_SERVICE_UNAVAILABLE", message: "The V2 service is unavailable. No offer or booking was made." };
}

function success<T>(data: T) {
  const output = { ok: true as const, data };
  return { structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
}
function failure(error: unknown) {
  const output = { ok: false as const, error: safeError(error) };
  return { isError: true, structuredContent: output,
    content: [{ type: "text" as const, text: JSON.stringify(output) }] };
}

export function registerV2RoadTools(server: McpServer, principal: McpPrincipal,
  services: V2RoadToolServices = persistedV2RoadToolServices) {
  server.registerTool("create_v2_freight_request", {
    title: "Create a V2 ROAD freight draft",
    description: "Create a complete V2 draft for the authorized organization. Ask for missing details first. " +
      "Retain the UUID retry key for an identical retry. No carrier quote or booking is created.",
    inputSchema: CreateInput, outputSchema: DraftOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    try {
      const actor = requireActor(principal);
      const data = FreightRequestV2ResponseSchema.parse(await services.create(input, actor));
      if (data.data.organizationId !== actor.organizationId) throw new Error("V2_RESPONSE_CORRELATION_FAILED");
      return success(data);
    }
    catch (error) { return failure(error); }
  });
  server.registerTool("get_v2_freight_request", {
    title: "Read a V2 freight draft",
    description: "Read only a V2 draft authorized for the current linked organization.",
    inputSchema: ReadInput, outputSchema: DraftOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    try {
      const actor = requireActor(principal);
      const data = FreightRequestV2ResponseSchema.parse(await services.read(input, actor));
      if (data.data.organizationId !== actor.organizationId || data.data.id !== input.requestId) {
        throw new Error("V2_RESPONSE_CORRELATION_FAILED");
      }
      return success(data);
    }
    catch (error) { return failure(error); }
  });
  server.registerTool("evaluate_v2_road", {
    title: "Evaluate V2 ROAD eligibility",
    description: "Return eligible, ineligible or unknown with evidence for the current draft version. " +
      "An eligible result is not a price, carrier offer or reservation.",
    inputSchema: EvaluateInput, outputSchema: RoadOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    try {
      const data = RoadServiceabilityEvaluationV2ResponseSchema.parse(await services.evaluate(input, requireActor(principal)));
      if (data.data.freightRequestId !== input.requestId ||
          data.data.evaluatedDraftVersion !== input.expectedDraftVersion) {
        throw new Error("V2_RESPONSE_CORRELATION_FAILED");
      }
      return success(data);
    }
    catch (error) { return failure(error); }
  });
}
