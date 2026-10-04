import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth";
import { v2AuthMiddleware } from "../middleware/v2-auth";
import { v2Error } from "../middleware/v2-error";
import { OrganizationServiceV2 } from "@/server/modules/organizations/application/organization-service";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";

export const organizationsRouter = new Hono<{ Variables: AuthVariables }>();
organizationsRouter.use("*", v2AuthMiddleware);
async function service() {
  const { organizationRepositoryV2 } = await import("@/server/modules/organizations/infrastructure/supabase-organization-repository");
  return new OrganizationServiceV2(await organizationRepositoryV2());
}
organizationsRouter.get("/current", async (c) => {
  try { return c.json(await (await service()).get(c.get("member"))); }
  catch (error) { return v2Error(c, error); }
});
organizationsRouter.post("/current/revisions", async (c) => {
  try {
    let value: unknown;
    try { value = await c.req.json(); }
    catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
    return c.json(await (await service()).revise(c.get("member"), value, c.req.header("Idempotency-Key")));
  } catch (error) { return v2Error(c, error); }
});
