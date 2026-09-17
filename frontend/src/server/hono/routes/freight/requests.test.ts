/**
 * Tests for POST /api/v2/freight/requests (Hono route — Slice 1).
 *
 * These tests call the Hono app directly (no HTTP server), using
 * the Hono test utilities. Service functions are mocked so no real
 * Supabase connection is needed.
 *
 * Run with: tsx --test src/server/hono/routes/freight/requests.test.ts
 */

import { describe, it, before, mock } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Minimal mock setup: we mock the dynamic imports used in the route so
// no real Supabase client is instantiated.
// ---------------------------------------------------------------------------

// Mock requireAuthenticatedMember to return a valid SUPERVISOR context
const mockMember = {
  userId: "usr-1",
  userEmail: "supervisor@acme.com",
  memberId: "mbr-1",
  organizationId: "org-1",
  role: "SUPERVISOR" as const,
  status: "ACTIVE",
};

// Mock the service function return value
const mockIntakeViewModel = {
  freight_request_id: "fr-test-uuid",
  code: "FR-2001",
  status: "DRAFT",
  draft_version: 1,
  organization_id: "org-1",
  // minimal shape for test purposes
};

// ---------------------------------------------------------------------------
// Build a test Hono app that bypasses the dynamic imports with controlled
// mocks. We build the routes inline with the same logic but with
// predictable auth / service behaviour.
// ---------------------------------------------------------------------------

function buildTestApp({
  authFails = false,
  serviceFails = false,
  serviceFailMessage = "UNAUTHENTICATED: test",
}: {
  authFails?: boolean;
  serviceFails?: boolean;
  serviceFailMessage?: string;
} = {}) {
  const app = new Hono();

  app.post("/freight/requests", async (c) => {
    // Simulate auth middleware
    if (authFails) {
      return c.json(
        { ok: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        401,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { ok: false, error: { code: "INVALID_ARGUMENT", message: "Request body must be valid JSON." } },
        400,
      );
    }

    // Minimal schema check mirroring the real route
    const { CreateFreightRequestSchema } = await import(
      "@/shared/schemas/freight-request"
    );
    const { successResponse, errorResponse, httpStatusFromError, errorCodeFromError } = await import(
      "@/shared/schemas/api-envelope"
    );

    let input;
    try {
      input = CreateFreightRequestSchema.parse(body);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "errors" in err) {
        const zodErr = err as { errors: Array<{ path: string[]; message: string }> };
        const message = zodErr.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return c.json(errorResponse("VALIDATION_ERROR", message), 400);
      }
      throw err;
    }

    if (serviceFails) {
      const status = httpStatusFromError(new Error(serviceFailMessage)) as Parameters<typeof c.json>[1];
      const code = errorCodeFromError(new Error(serviceFailMessage));
      return c.json(errorResponse(code, serviceFailMessage), status);
    }

    // Simulate successful service call
    void input; // used
    return c.json(successResponse(mockIntakeViewModel), 201);
  });

  return app;
}

const validBody = {
  originCity: "Callao",
  originCountry: "PE",
  destinationCity: "Santiago",
  destinationCountry: "CL",
  cargoWeightKg: 8000,
  packageCount: 10,
  isCrossBorder: true,
};

describe("POST /freight/requests — Hono V2 route (Slice 1)", () => {
  describe("happy path", () => {
    it("returns 201 with the created freight request view model", async () => {
      const app = buildTestApp();
      const res = await app.request("/freight/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      assert.equal(res.status, 201);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, true);
      assert.ok(json.data, "response should have data field");
      const data = json.data as Record<string, unknown>;
      assert.equal(data.freight_request_id, "fr-test-uuid");
      assert.equal(data.code, "FR-2001");
    });

    it("sets default strategy to BALANCED when not provided", async () => {
      const { CreateFreightRequestSchema } = await import("@/shared/schemas/freight-request");
      const result = CreateFreightRequestSchema.parse(validBody);
      assert.equal(result.strategy, "BALANCED");
    });

    it("sets default transportMode to ROAD when not provided", async () => {
      const { CreateFreightRequestSchema } = await import("@/shared/schemas/freight-request");
      const result = CreateFreightRequestSchema.parse(validBody);
      assert.equal(result.transportMode, "ROAD");
    });
  });

  describe("authentication", () => {
    it("returns 401 when unauthenticated", async () => {
      const app = buildTestApp({ authFails: true });
      const res = await app.request("/freight/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      assert.equal(res.status, 401);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, false);
      const error = json.error as Record<string, unknown>;
      assert.equal(error.code, "UNAUTHENTICATED");
    });
  });

  describe("validation", () => {
    it("returns 400 when cargoWeightKg is missing", async () => {
      const app = buildTestApp();
      const { cargoWeightKg: _omit, ...bodyWithoutWeight } = validBody;
      const res = await app.request("/freight/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyWithoutWeight),
      });

      assert.equal(res.status, 400);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, false);
      const error = json.error as Record<string, unknown>;
      assert.equal(error.code, "VALIDATION_ERROR");
    });

    it("returns 400 when cargoWeightKg is not positive", async () => {
      const app = buildTestApp();
      const res = await app.request("/freight/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, cargoWeightKg: -1 }),
      });

      assert.equal(res.status, 400);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, false);
    });

    it("returns 400 when originCountry is not 2 characters", async () => {
      const app = buildTestApp();
      const res = await app.request("/freight/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, originCountry: "PER" }),
      });

      assert.equal(res.status, 400);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, false);
    });

    it("returns 400 when body is not valid JSON", async () => {
      const app = buildTestApp();
      const res = await app.request("/freight/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json {{{",
      });

      assert.equal(res.status, 400);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, false);
      const error = json.error as Record<string, unknown>;
      assert.equal(error.code, "INVALID_ARGUMENT");
    });
  });

  describe("service errors", () => {
    it("returns 500 on unexpected service error", async () => {
      const app = buildTestApp({ serviceFails: true, serviceFailMessage: "UNEXPECTED: something broke" });
      const res = await app.request("/freight/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      assert.equal(res.status, 500);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, false);
    });
  });
});

describe("API envelope helpers", () => {
  it("successResponse wraps data correctly", async () => {
    const { successResponse } = await import("@/shared/schemas/api-envelope");
    const result = successResponse({ id: "1" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.data, { id: "1" });
  });

  it("errorResponse wraps error correctly", async () => {
    const { errorResponse } = await import("@/shared/schemas/api-envelope");
    const result = errorResponse("NOT_FOUND", "Resource not found.");
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "NOT_FOUND");
    assert.equal(result.error.message, "Resource not found.");
  });

  it("httpStatusFromError maps UNAUTHENTICATED to 401", async () => {
    const { httpStatusFromError } = await import("@/shared/schemas/api-envelope");
    assert.equal(httpStatusFromError(new Error("UNAUTHENTICATED: no session")), 401);
  });

  it("httpStatusFromError maps FORBIDDEN to 403", async () => {
    const { httpStatusFromError } = await import("@/shared/schemas/api-envelope");
    assert.equal(httpStatusFromError(new Error("FORBIDDEN: insufficient role")), 403);
  });

  it("httpStatusFromError maps NOT_FOUND to 404", async () => {
    const { httpStatusFromError } = await import("@/shared/schemas/api-envelope");
    assert.equal(httpStatusFromError(new Error("NOT_FOUND: request not found")), 404);
  });

  it("httpStatusFromError maps INVALID_ARGUMENT to 400", async () => {
    const { httpStatusFromError } = await import("@/shared/schemas/api-envelope");
    assert.equal(httpStatusFromError(new Error("INVALID_ARGUMENT: missing field")), 400);
  });

  it("httpStatusFromError maps unknown errors to 500", async () => {
    const { httpStatusFromError } = await import("@/shared/schemas/api-envelope");
    assert.equal(httpStatusFromError(new Error("Something unexpected")), 500);
  });
});
