import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth";
import { v2AuthMiddleware } from "../middleware/v2-auth";
import { v2Error } from "../middleware/v2-error";
import { FacilityServiceV2 } from "@/server/modules/facilities/application/facility-service";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";

export const facilitiesRouter = new Hono<{ Variables: AuthVariables }>();
facilitiesRouter.use("*", v2AuthMiddleware);
async function service() {
  const { facilityRepositoryV2 } = await import("@/server/modules/facilities/infrastructure/supabase-facility-repository");
  return new FacilityServiceV2(await facilityRepositoryV2());
}
facilitiesRouter.get("/", async (c) => {
  try { return c.json(await (await service()).list(c.get("member"), c.req.query())); }
  catch (error) { return v2Error(c, error); }
});
facilitiesRouter.get("/:id", async (c) => {
  try { return c.json(await (await service()).get(c.get("member"), c.req.param("id"))); }
  catch (error) { return v2Error(c, error); }
});
facilitiesRouter.post("/", async (c) => {
  try {
    let value: unknown;
    try { value = await c.req.json(); }
    catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
    const result = await (await service()).create(c.get("member"), value, c.req.header("Idempotency-Key"));
    return c.json(result, result.meta.idempotentReplay ? 200 : 201);
  } catch (error) { return v2Error(c, error); }
});
facilitiesRouter.post("/:id/revisions", async (c) => {
  try {
    let value: unknown;
    try { value = await c.req.json(); }
    catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
    return c.json(await (await service()).revise(c.get("member"), c.req.param("id"), value,
      c.req.header("Idempotency-Key")));
  } catch (error) { return v2Error(c, error); }
});
