import { Hono } from "hono";
import { errorHandler } from "./middleware/error-handler";
import { healthRouter } from "./routes/health";
import { freightRequestsRouter } from "./routes/freight/requests";
import { intakeOptionsRouter } from "./routes/intake/options";

// ---------------------------------------------------------------------------
// CargoMesh V2 Hono application factory.
//
// The Vercel adapter retains the full pathname, so install the prefix before
// registering any logical routes:
//
//   /health                → GET  /api/v2/health
//   /freight/requests      → POST /api/v2/freight/requests
// ---------------------------------------------------------------------------

export function createHonoApp() {
  const app = new Hono().basePath("/api/v2");

  // Global error handler
  app.onError(errorHandler);

  // Routes
  app.route("/health", healthRouter);
  app.route("/freight/requests", freightRequestsRouter);
  app.route("/intake/options", intakeOptionsRouter);

  return app;
}
