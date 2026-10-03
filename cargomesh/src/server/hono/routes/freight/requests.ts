import { Hono } from "hono";
import type { AuthVariables } from "@/server/hono/middleware/auth";
import { v2AuthMiddleware } from "@/server/hono/middleware/v2-auth";
import { v2Error } from "@/server/hono/middleware/v2-error";
import { V2DraftError, createV2Draft, getV2Draft } from
  "@/server/modules/freight-requests/application/draft-service";

const freightRequestsRouter = new Hono<{ Variables: AuthVariables }>();
freightRequestsRouter.use("*", v2AuthMiddleware);

freightRequestsRouter.post("/", async (c) => {
  try {
    let body: unknown;
    try { body = await c.req.json(); }
    catch { throw new V2DraftError("VALIDATION_ERROR", "Request body must be valid JSON.", 400); }
    const { v2DraftRepository } = await import(
      "@/server/modules/freight-requests/infrastructure/supabase-draft-repository"
    );
    const member = c.get("member");
    const result = await createV2Draft(body, c.req.header("Idempotency-Key") ?? null,
      { memberId: member.memberId, organizationId: member.organizationId },
      await v2DraftRepository());
    return c.json(result, result.meta.idempotentReplay ? 200 : 201);
  } catch (error) { return v2Error(c, error); }
});

freightRequestsRouter.get("/:id/serviceability", async (c) => {
  try {
    const [{ v2DraftRepository }, { createV2ServerSupabaseClient },
      { loadRoadServices }, { evaluateV2RoadByRequestId, ExpectedDraftVersionSchema }] = await Promise.all([
      import("@/server/modules/freight-requests/infrastructure/supabase-draft-repository"),
      import("@/server/db/supabase/v2"),
      import("@/server/modules/road-serviceability/infrastructure/supabase-road-catalog"),
      import("@/server/modules/road-serviceability/application/evaluate-v2-road"),
    ]);
    const member = c.get("member");
    const db = await createV2ServerSupabaseClient();
    const expected = ExpectedDraftVersionSchema.parse(c.req.query("expectedDraftVersion"));
    return c.json(await evaluateV2RoadByRequestId(
      c.req.param("id"), expected,
      { memberId: member.memberId, organizationId: member.organizationId },
      await v2DraftRepository(), { listRoadServices: () => loadRoadServices(db) },
    ));
  } catch (error) { return v2Error(c, error); }
});

freightRequestsRouter.get("/:id", async (c) => {
  try {
    const { v2DraftRepository } = await import(
      "@/server/modules/freight-requests/infrastructure/supabase-draft-repository"
    );
    const member = c.get("member");
    return c.json(await getV2Draft(c.req.param("id"),
      { memberId: member.memberId, organizationId: member.organizationId },
      await v2DraftRepository()));
  } catch (error) { return v2Error(c, error); }
});

export { freightRequestsRouter };
