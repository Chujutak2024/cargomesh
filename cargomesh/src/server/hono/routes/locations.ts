import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth";
import { v2AuthMiddleware } from "../middleware/v2-auth";
import { v2Error } from "../middleware/v2-error";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { LocationServiceV2 } from "@/server/modules/locations/application/location-service";
export const locationsRouter = new Hono<{ Variables: AuthVariables }>();
locationsRouter.use("*", v2AuthMiddleware);
for (const action of ["resolve", "confirm"] as const) locationsRouter.post(action === "resolve" ? "/resolutions" : "/confirmations", async c => {
  try {
    let body: unknown;
    try { body = await c.req.json(); } catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
    const { locationRepositoryV2 } = await import("@/server/modules/locations/infrastructure/supabase-location-repository");
    const service = new LocationServiceV2(await locationRepositoryV2());
    return c.json(await service[action](c.get("member"), body));
  } catch (error) { return v2Error(c, error); }
});
