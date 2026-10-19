import { Hono } from "hono";
import {carrierRegularDriversRouter} from "./routes/carrier-regular-drivers";
import { errorHandler } from "./middleware/error-handler";
import { healthRouter } from "./routes/health";
import { freightRequestsRouter } from "./routes/freight/requests";
import { intakeOptionsRouter } from "./routes/intake/options";
import { facilitiesRouter } from "./routes/facilities";
import { organizationsRouter } from "./routes/organizations";
import { catalogRouter } from "./routes/catalog";
import { workflowRouter } from "./routes/workflow";
import { identityRouter } from "./routes/identity";
import { carrierPortalRouter } from "./routes/carrier-portal";
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

import { carrierRoadOperationRouter } from './routes/carrier-road-operation';
import { carrierRoadRouter } from './routes/carrier-road-routing';
import { carrierBordersRouter } from './routes/carrier-borders';
import {carrierOperationsRouter} from './routes/carrier-operations';

export function createHonoApp() {
  const app = new Hono().basePath("/api/v2");

  // Global error handler
  app.onError(errorHandler);

  // Routes
  app.route("/health", healthRouter);
  app.route("/", carrierRegularDriversRouter);
  app.route("/", carrierOperationsRouter);
  app.route("/", carrierBordersRouter);
  app.route("/", carrierRoadRouter);
  app.route("/", carrierRoadOperationRouter);
  app.route("/", carrierPortalRouter);
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
