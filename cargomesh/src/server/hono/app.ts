import { Hono } from "hono";
import { errorHandler } from "./middleware/error-handler";
import { healthRouter } from "./routes/health";
import { freightRequestsRouter } from "./routes/freight/requests";
import { intakeOptionsRouter } from "./routes/intake/options";
import { facilitiesRouter } from "./routes/facilities";
import { organizationsRouter } from "./routes/organizations";
import { catalogRouter } from "./routes/catalog";
import { workflowRouter } from "./routes/workflow";
import { identityRouter } from "./routes/identity";
import { carrierWorkflowRouter } from "./routes/carrier-workflow";
import { locationsRouter } from "./routes/locations";

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
  app.route("/", identityRouter);
  app.route("/", carrierWorkflowRouter);
  app.route("/locations", locationsRouter);
  app.route("/freight/requests", freightRequestsRouter);
  app.route("/intake/options", intakeOptionsRouter);
  app.route("/facilities", facilitiesRouter);
  app.route("/organizations", organizationsRouter);
  app.route("/", catalogRouter);
  app.route("/", workflowRouter);

  return app;
}
