import "server-only";
import { createLocalTruck3dHandler } from "@/server/truck-3d/local-handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = createLocalTruck3dHandler({ enabled: process.env.CARGOMESH_LOCAL_3D_ENABLED === "true", apiKey: process.env.TRIPO_API_KEY });
export const GET = handler;
export const POST = handler;
