import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth";
import { v2AuthMiddleware } from "../middleware/v2-auth";
import { v2Error } from "../middleware/v2-error";
import { CatalogServiceV2 } from "@/server/modules/catalog/application/catalog-service";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import type { CatalogKindV2 } from "@/shared/schemas/v2/catalog";

export const catalogRouter = new Hono<{ Variables: AuthVariables }>();
catalogRouter.use("*", v2AuthMiddleware);
async function service() {
  const { catalogRepositoryV2 } = await import("@/server/modules/catalog/infrastructure/supabase-catalog-repository");
  return new CatalogServiceV2(await catalogRepositoryV2());
}
// Explicit routes keep the resource vocabulary closed; no arbitrary table access.
const resources: [CatalogKindV2, string][] = [
  ["preferences", "/organizations/current/preferences"], ["cargo-profiles", "/cargo-profiles"],
  ["cargo-categories", "/cargo-categories"], ["carriers", "/carriers"],
  ["depots", "/carriers/:carrierId/depots"], ["services", "/carriers/:carrierId/services"],
  ["partners", "/carriers/:carrierId/partners"],
  ["assets", "/carriers/:carrierId/assets"],
  ["capacity-pools", "/carriers/:carrierId/capacity-pools"],
  ["calendars", "/carriers/:carrierId/calendars"],
  ["maintenances", "/carriers/:carrierId/maintenances"],
  ["repositioning-blocks", "/carriers/:carrierId/repositioning-blocks"],
  ["asset-capabilities", "/carriers/:carrierId/asset-capabilities"],
  ["capability-definitions", "/carriers/:carrierId/capability-definitions"],
  ["areas", "/carriers/:carrierId/services/:serviceId/areas"],
  ["lanes", "/carriers/:carrierId/services/:serviceId/lanes"],
];
for (const [kind, path] of resources) {
  catalogRouter.get(path, async c => {
    try { return c.json(await (await service()).list(c.get("member"), kind,
      { carrierId: c.req.param("carrierId") ?? null, serviceId: c.req.param("serviceId") ?? null }, c.req.query())); }
    catch (error) { return v2Error(c, error); }
  });
  catalogRouter.get(path + "/:id", async c => {
    try { return c.json(await (await service()).get(c.get("member"), kind,
      { carrierId: c.req.param("carrierId") ?? null, serviceId: c.req.param("serviceId") ?? null }, c.req.param("id") ?? "")); }
    catch (error) { return v2Error(c, error); }
  });
  for (const revise of [false, true]) {
    catalogRouter.post(path + (revise ? "/:id/revisions" : ""), async c => {
      try {
        let body: unknown;
        try { body = await c.req.json(); }
        catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
        const result = await (await service()).command(c.get("member"), kind,
          { carrierId: c.req.param("carrierId") ?? null, serviceId: c.req.param("serviceId") ?? null },
          revise ? c.req.param("id") ?? "" : null, body, c.req.header("Idempotency-Key"));
        return c.json(result, revise || result.meta.idempotentReplay ? 200 : 201);
      } catch (error) { return v2Error(c, error); }
    });
  }
}
