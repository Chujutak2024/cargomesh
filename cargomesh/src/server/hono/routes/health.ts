import { Hono } from "hono";
import { successResponse } from "@/shared/schemas/api-envelope";

const healthRouter = new Hono();

// GET /health — no auth required
healthRouter.get("/", (c) => {
  return c.json(
    successResponse({
      status: "ok",
      version: "v2",
      timestamp: new Date().toISOString(),
    }),
    200,
  );
});

export { healthRouter };
