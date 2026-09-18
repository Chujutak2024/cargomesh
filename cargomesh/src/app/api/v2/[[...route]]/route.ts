import { handle } from "hono/vercel";
import { createHonoApp } from "@/server/hono/app";

// ---------------------------------------------------------------------------
// Next.js App Router catch-all that mounts the Hono V2 application.
//
// URL mapping:
//   /api/v2/health              → Hono GET /health
//   /api/v2/freight/requests    → Hono POST /freight/requests
//
// The "hono/vercel" adapter handles the Next.js ↔ Hono bridging.
// Existing /api/* routes are untouched and continue to work normally.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";

const app = createHonoApp();

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
