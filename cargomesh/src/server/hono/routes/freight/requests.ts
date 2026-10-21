import { Hono } from "hono";
import {hasSessionOrigin} from "@/server/auth/session-origin";
import type { AuthVariables } from "@/server/hono/middleware/auth";
import { v2AuthMiddleware } from "@/server/hono/middleware/v2-auth";
import { v2Error } from "@/server/hono/middleware/v2-error";
import { V2DraftError, createV2Draft, getV2Draft } from
  "@/server/modules/freight-requests/application/draft-service";

const freightRequestsRouter = new Hono<{ Variables: AuthVariables }>();
freightRequestsRouter.use("*", v2AuthMiddleware);

async function lifecycleService() {
  const [{ RequestLifecycleServiceV2 }, { requestLifecycleRepositoryV2 }] = await Promise.all([
    import("@/server/modules/freight-requests/application/request-lifecycle-service"),
    import("@/server/modules/freight-requests/infrastructure/supabase-request-lifecycle-repository"),
  ]);
  return new RequestLifecycleServiceV2(await requestLifecycleRepositoryV2());
}
freightRequestsRouter.get("/", async (c) => {
  try { return c.json(await (await lifecycleService()).list(c.get("member"), c.req.query())); }
  catch (error) { return v2Error(c, error); }
});
freightRequestsRouter.post("/:id/revisions", async (c) => {
  try {
    let body: unknown;
    try { body = await c.req.json(); }
    catch { throw new V2DraftError("VALIDATION_ERROR", "Request body must be valid JSON.", 400); }
    return c.json(await (await lifecycleService()).revise(c.get("member"), c.req.param("id"), body,
      c.req.header("Idempotency-Key")));
  } catch (error) { return v2Error(c, error); }
});
freightRequestsRouter.post("/:id/submissions", async (c) => {
  try {
    let body: unknown;
    try { body = await c.req.json(); }
    catch { throw new V2DraftError("VALIDATION_ERROR", "Request body must be valid JSON.", 400); }
    return c.json(await (await lifecycleService()).submit(c.get("member"), c.req.param("id"), body,
      c.req.header("Idempotency-Key")));
  } catch (error) { return v2Error(c, error); }
});

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

freightRequestsRouter.get("/:id/cargo-readiness", async (c) => {
  c.header("Cache-Control", "private, no-store");
  try {
    const [{ v2DraftRepository }, { getCargoReadinessV2 }, { z }] = await Promise.all([
      import("@/server/modules/freight-requests/infrastructure/supabase-draft-repository"),
      import("@/server/modules/freight-requests/application/cargo-readiness"),
      import("zod"),
    ]);
    const expected = z.coerce.number().int().positive().optional().parse(c.req.query("expectedDraftVersion"));
    return c.json(await getCargoReadinessV2(c.req.param("id"), expected,
      c.get("member"), await v2DraftRepository()));
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

freightRequestsRouter.post("/:id/quotes", async (c) => {
  c.header("Cache-Control", "private, no-store");
  try {
    if (!c.req.header("Authorization") && !hasSessionOrigin(c.req.raw)) throw new V2DraftError("FORBIDDEN_ORIGIN", "Same-origin session request required.", 403);
    const { searchRequestQuotes } = await import("@/server/modules/commercial/application/quote-search");
    const body = await c.req.json().catch(() => { throw new V2DraftError("VALIDATION_ERROR", "JSON required.", 400); });
    return c.json(await searchRequestQuotes(c.get("member"), c.req.param("id"), body, c.req.header("Idempotency-Key")));
  } catch (error) { return v2Error(c, error); }
});
freightRequestsRouter.get("/:id/similar-cases", async (c) => {
  c.header("Cache-Control", "private, no-store");
  try {
    const { readQuoteHistory } = await import("@/server/modules/commercial/application/quote-service");
    const data = await readQuoteHistory(c.get("member"), c.req.param("id"));
    return c.json({ schemaVersion: "2.0", data });
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
