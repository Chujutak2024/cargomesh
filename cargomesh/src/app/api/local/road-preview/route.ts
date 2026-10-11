import "server-only";
import { createLocalRoadPreviewHandler } from "@/server/maps/local-road-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createLocalRoadPreviewHandler({
  localOrigin: "http://127.0.0.1:8080",
  enabled: process.env.CARGOMESH_LOCAL_ROUTES_ENABLED === "true",
  apiKey: process.env.GOOGLE_ROUTES_API_KEY,
});
