import { Hono } from "hono";
import { errorHandler } from "./middleware/error-handler";
import { healthRouter } from "./routes/health";
import { freightRequestsRouter } from "./routes/freight/requests";

// ---------------------------------------------------------------------------
// CargoMesh V2 Hono application factory.
//
// All routes are mounted at their logical paths. The Next.js catch-all
// at src/app/api/v2/[[...route]]/route.ts strips the /api/v2 prefix
// before handing off to this app, so paths here are relative:
//
//   /health                → GET  /api/v2/health
//   /freight/requests      → POST /api/v2/freight/requests
// ---------------------------------------------------------------------------

export function createHonoApp() {
  const app = new Hono();

  // Global error handler
  app.onError(errorHandler);

  // Routes
  app.route("/health", healthRouter);
  app.route("/freight/requests", freightRequestsRouter);

  return app;
}
