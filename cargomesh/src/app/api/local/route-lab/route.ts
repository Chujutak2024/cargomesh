import "server-only";
import { createRoadRoutingHandler } from "@/server/maps/road-routing-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createRoadRoutingHandler({
  enabled: process.env.CARGOMESH_LOCAL_ROUTES_ENABLED === "true" && process.env.CM_ENABLE_DEMO === "1",
  localOrigin: process.env.CARGOMESH_LOCAL_ROUTES_ORIGIN,
  apiKey: process.env.GOOGLE_ROUTES_API_KEY,
});
