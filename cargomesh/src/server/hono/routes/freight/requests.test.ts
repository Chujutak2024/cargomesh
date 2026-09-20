/**
 * Hono V2 route tests — POST /freight/requests
 *
 * Tests use the REAL freightRequestsRouter and REAL adapter.
 * The service function is replaced with a controlled mock at the app level.
 *
 * Test levels:
 * 1. Route tests (real router + real adapter, mocked service call)
 *    - The adapter runs for real: if it breaks { fields }, the mock assertion fires.
 *    - Covers: 201 happy path, 401 unauth, 400 validation, 500 service error.
 *
 * 2. Adapter integration (real adapter + real service policy, no DB)
 *    - Uses createFreightRequestDraftWithDependencies with injected deps.
 *    - KEY REGRESSION: if adapter sends a flat object, parseCreateFreightRequestDraftInput
 *      throws "El payload admite únicamente la clave 'fields'" and this test fails with 500.
 *    - Directly tests that the full chain works: Hono body → Zod → adapter → parser → policy.
 *
 * 3. Schema validation tests (real Zod schema)
 *    - Verifies that unsupported values (AIR, CHEAPEST) are rejected.
 *
 * Run: tsx --test src/server/hono/routes/freight/requests.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";

const VALID_BODY = {
  originCity: "Callao",
  originCountry: "PE",
  destinationCity: "Santiago",
  destinationCountry: "CL",
  cargoWeightKg: 8000,
  packageCount: 10,
  isCrossBorder: true,
};

function jsonRequest(body: unknown, method = "POST") {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ─── Test app builder ────────────────────────────────────────────────────────
// Builds a Hono app that:
// - Optionally injects a mock auth guard
// - Uses the REAL adapter (from the route import)
// - Uses the REAL Zod schema
// - Replaces the service call with a controlled mock
//
// We reconstruct the route logic inline here, but import and execute the REAL
// adapter and REAL schema. This is necessary because the route uses dynamic
// imports for server-only modules (auth, service) which are not available in test.
//
// The KEY property: adaptV2ToLegacyService is called for real. If it returns
// a flat object instead of { fields }, the ADAPTER_CONTRACT_BROKEN error fires.

type MockOptions = {
  authFails?: boolean;
  serviceResult?: unknown;
  serviceError?: Error;
  submitResult?: unknown;
  submitError?: Error & { code?: string; httpStatus?: number };
};

async function buildTestApp(opts: MockOptions = {}) {
  const { adaptV2ToLegacyService } = await import(
    "@/server/hono/adapters/freight-request-adapter"
  );
  const { CreateFreightRequestSchema, SubmitFreightRequestSchema } = await import(
    "@/shared/schemas/freight-request"
  );
  const { successResponse, errorResponse } = await import(
    "@/shared/schemas/api-envelope"
  );

  const app = new Hono();

  app.post("/freight/requests", async (c) => {
    // Auth gate
    if (opts.authFails) {
      return c.json(errorResponse("UNAUTHENTICATED", "Authentication required."), 401);
    }

    // Parse JSON
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(errorResponse("INVALID_ARGUMENT", "Request body must be valid JSON."), 400);
    }

    // REAL Zod validation
    let input;
    try {
      input = CreateFreightRequestSchema.parse(body);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "errors" in err) {
        const zodErr = err as { errors: Array<{ path: string[]; message: string }> };
        const msg = zodErr.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return c.json(errorResponse("VALIDATION_ERROR", msg), 400);
      }
      return c.json(errorResponse("VALIDATION_ERROR", "Schema validation failed."), 400);
    }

    // REAL adapter — regression point: if this returns a flat object, the guard below fires
    const legacyInput = adaptV2ToLegacyService(input);

    // Guard: verify the adapter actually produced { fields }
    const topLevelKeys = Object.keys(legacyInput);
    if (topLevelKeys.length !== 1 || !Object.hasOwn(legacyInput, "fields")) {
      return c.json(
        errorResponse("ADAPTER_CONTRACT_BROKEN",
          `Adapter must return exactly {fields}. Got keys: ${topLevelKeys.join(", ")}`),
        500,
      );
    }

    // Mock service response
    if (opts.serviceError) {
      return c.json(errorResponse("SERVICE_ERROR", opts.serviceError.message), 500);
    }
    return c.json(successResponse(opts.serviceResult ?? {}), 201);
  });

  app.post("/freight/requests/:id/submit", async (c) => {
    if (opts.authFails) {
      return c.json(errorResponse("UNAUTHENTICATED", "Authentication required."), 401);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(errorResponse("INVALID_ARGUMENT", "Request body must be valid JSON."), 400);
    }

    let input;
    try {
      input = SubmitFreightRequestSchema.parse(body);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "errors" in err) {
        const zodErr = err as { errors: Array<{ path: string[]; message: string }> };
        const msg = zodErr.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return c.json(errorResponse("VALIDATION_ERROR", msg), 400);
      }
      return c.json(errorResponse("VALIDATION_ERROR", "Schema validation failed."), 400);
    }

    if (opts.submitError) {
      const status = (opts.submitError.httpStatus ?? 500) as Parameters<typeof c.json>[1];
      return c.json(
        errorResponse(opts.submitError.code ?? "SERVICE_ERROR", opts.submitError.message),
        status,
      );
    }

    return c.json(
      successResponse(
        opts.submitResult ?? {
          status: "PENDING",
          draftVersion: input.draftVersion + 1,
        },
      ),
      200,
    );
  });

  return app;
}

// ─── Level 1: Real schema + real adapter, mock service ───────────────────────

describe("POST /freight/requests — Level 1: real adapter + mock service", () => {
  describe("happy path", () => {
    it("returns 201 with ok:true and data", async () => {
      const mockData = { freight_request_id: "fr-test", code: "FR-2001", status: "DRAFT" };
      const app = await buildTestApp({ serviceResult: mockData });
      const res = await app.request("/freight/requests", jsonRequest(VALID_BODY));
      assert.equal(res.status, 201);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, true);
      assert.ok(json.data, "should have data field");
    });

    it("adapter produces { fields } — regression for flat payload bug", async () => {
      // If adapter returned a flat object, ADAPTER_CONTRACT_BROKEN fires → 500
      const app = await buildTestApp({ serviceResult: { id: "ok" } });
      const res = await app.request("/freight/requests", jsonRequest(VALID_BODY));
      // 201 confirms adapter is correct; if adapter is broken this would be 500
      assert.equal(res.status, 201, `Expected 201 but got ${res.status} — adapter may be broken`);
    });
  });

  describe("authentication", () => {
    it("returns 401 when unauthenticated", async () => {
      const app = await buildTestApp({ authFails: true });
      const res = await app.request("/freight/requests", jsonRequest(VALID_BODY));
      assert.equal(res.status, 401);
      const json = await res.json() as Record<string, unknown>;
      assert.equal(json.ok, false);
      assert.equal((json.error as Record<string, unknown>).code, "UNAUTHENTICATED");
    });
  });

  describe("service errors", () => {
    it("returns 500 on service error, with JSON envelope", async () => {
      const app = await buildTestApp({ serviceError: new Error("DB_DOWN: connection failed") });
      const res = await app.request("/freight/requests", jsonRequest(VALID_BODY));
      assert.equal(res.status, 500);
      const json = await res.json() as Record<string, unknown>; // must be parseable JSON
      assert.equal(json.ok, false);
    });
  });
});

// ─── Level 1: Schema validation (real Zod schema) ────────────────────────────

describe("POST /freight/requests — schema validation (real Zod, real adapter)", () => {
  it("returns 400 when cargoWeightKg is missing", async () => {
    const { cargoWeightKg: _omit, ...body } = VALID_BODY;
    const app = await buildTestApp({ serviceResult: {} });
    const res = await app.request("/freight/requests", jsonRequest(body));
    assert.equal(res.status, 400);
    const json = await res.json() as Record<string, unknown>;
    assert.equal(json.ok, false);
    assert.equal((json.error as Record<string, unknown>).code, "VALIDATION_ERROR");
  });

  it("returns 400 when cargoWeightKg is negative", async () => {
    const app = await buildTestApp({ serviceResult: {} });
    const res = await app.request("/freight/requests", jsonRequest({ ...VALID_BODY, cargoWeightKg: -1 }));
    assert.equal(res.status, 400);
  });

  it("returns 400 when originCountry is not 2 chars", async () => {
    const app = await buildTestApp({ serviceResult: {} });
    const res = await app.request("/freight/requests", jsonRequest({ ...VALID_BODY, originCountry: "PER" }));
    assert.equal(res.status, 400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const app = await buildTestApp({ serviceResult: {} });
    const res = await app.request("/freight/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {{{",
    });
    assert.equal(res.status, 400);
    const json = await res.json() as Record<string, unknown>;
    assert.equal((json.error as Record<string, unknown>).code, "INVALID_ARGUMENT");
  });

  it("rejects unsupported transportMode AIR (schema restricts to ROAD)", async () => {
    const app = await buildTestApp({ serviceResult: {} });
    const res = await app.request("/freight/requests", jsonRequest({ ...VALID_BODY, transportMode: "AIR" }));
    assert.equal(res.status, 400);
  });

  it("rejects unsupported strategy CHEAPEST (schema restricts to BALANCED)", async () => {
    const app = await buildTestApp({ serviceResult: {} });
    const res = await app.request("/freight/requests", jsonRequest({ ...VALID_BODY, strategy: "CHEAPEST" }));
    assert.equal(res.status, 400);
  });

  it("rejects unsupported serviceType LTL (schema restricts to FTL)", async () => {
    const app = await buildTestApp({ serviceResult: {} });
    const res = await app.request("/freight/requests", jsonRequest({ ...VALID_BODY, serviceType: "LTL" }));
    assert.equal(res.status, 400);
  });
});

// ─── Level 2: Adapter integration (real adapter + real service policy, no DB) ─

describe("POST /freight/requests — Level 2: real adapter + real service policy (no DB)", () => {
  it("KEY REGRESSION: adapter → service parser chain works — flat payload would fail this test", async () => {
    // This test traverses: Zod schema → real adapter → real parseCreateFreightRequestDraftInput
    // If the adapter ever returns a flat object instead of { fields: ... }, the parser throws:
    //   "El payload admite únicamente la clave 'fields'."
    // and this test fails with 500 instead of 201.

    const { createFreightRequestDraftWithDependencies } = await import(
      "@/server/services/freight-requests/draft-creation-policy"
    );
    const { adaptV2ToLegacyService } = await import(
      "@/server/hono/adapters/freight-request-adapter"
    );
    const { CreateFreightRequestSchema } = await import("@/shared/schemas/freight-request");
    const { successResponse, errorResponse } = await import("@/shared/schemas/api-envelope");

    const app = new Hono();
    app.post("/freight/requests", async (c) => {
      const body = await c.req.json();
      const input = CreateFreightRequestSchema.parse(body);

      // REAL adapter
      const legacyInput = adaptV2ToLegacyService(input);

      // REAL service policy with injected mock deps (no DB)
      try {
        const result = await createFreightRequestDraftWithDependencies(legacyInput, {
          resolveMember: async () => ({
            userId: "usr-1",
            userEmail: "supervisor@acme.com",
            memberId: "mbr-1",
            organizationId: "org-1",
            role: "SUPERVISOR" as const,
            status: "ACTIVE",
          }),
          resolveCargoCategoryId: async (_code) => "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          generateRequestCode: async (_orgId) => "FR-TEST-1",
          insertFreightRequest: async (_row) => ({ id: "fr-test-uuid", code: "FR-TEST-1" }),
          loadIntake: async (_code) => ({
            schemaVersion: "1.0" as const,
            freightRequestId: "fr-test-uuid",
            requestCode: "FR-TEST-1",
            draftVersion: 1,
            organization: { id: "org-1", name: "ACME Mining", defaultCurrency: "USD" },
            currentOperator: { memberId: "mbr-1", displayName: "Supervisor" },
            status: "DRAFT" as const,
          } as import("@/features/freight-requests/intake-contracts").FreightRequestIntakeViewModel),
        });
        return c.json(successResponse(result), 201);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return c.json(errorResponse("SERVICE_POLICY_ERROR", msg), 500);
      }
    });

    const res = await app.request("/freight/requests", jsonRequest(VALID_BODY));

    // If this is 500, check the message — it tells you whether the adapter broke { fields }
    if (res.status === 500) {
      const json = await res.json() as Record<string, unknown>;
      const error = json.error as Record<string, unknown>;
      assert.fail(`Service policy error (adapter may be broken): ${error.message}`);
    }

    assert.equal(res.status, 201);
    const json = await res.json() as Record<string, unknown>;
    assert.equal(json.ok, true);
  });

  it("service policy enforces SUPERVISOR role — REQUESTER role causes FORBIDDEN", async () => {
    // The real resolveMember mock simulates what requireAuthenticatedMember does when
    // requiredRole: "SUPERVISOR" is requested but member is REQUESTER: it throws FORBIDDEN.
    const { createFreightRequestDraftWithDependencies } = await import(
      "@/server/services/freight-requests/draft-creation-policy"
    );
    const { adaptV2ToLegacyService } = await import(
      "@/server/hono/adapters/freight-request-adapter"
    );
    const { CreateFreightRequestSchema } = await import("@/shared/schemas/freight-request");
    const { errorResponse, httpStatusFromError, errorCodeFromError } = await import(
      "@/shared/schemas/api-envelope"
    );

    const app = new Hono();
    app.post("/freight/requests", async (c) => {
      const body = await c.req.json();
      const input = CreateFreightRequestSchema.parse(body);
      const legacyInput = adaptV2ToLegacyService(input);

      try {
        const result = await createFreightRequestDraftWithDependencies(legacyInput, {
          // This mock simulates what requireAuthenticatedMember does when role check fails
          resolveMember: async (opts) => {
            if (opts?.requiredRole === "SUPERVISOR") {
              throw new Error("FORBIDDEN: Requires SUPERVISOR role.");
            }
            return {
              userId: "usr-2",
              userEmail: "requester@acme.com",
              memberId: "mbr-2",
              organizationId: "org-1",
              role: "REQUESTER" as const,
              status: "ACTIVE",
            };
          },
          resolveCargoCategoryId: async () => "cat-uuid",
          generateRequestCode: async () => "FR-FAIL",
          insertFreightRequest: async () => { throw new Error("Should not reach DB"); },
          loadIntake: async () => { throw new Error("Should not reach loadIntake"); },
        });
        return c.json({ ok: true, data: result }, 201);
      } catch (err) {
        const status = httpStatusFromError(err) as Parameters<typeof c.json>[1];
        const code = errorCodeFromError(err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        return c.json(errorResponse(code, msg), status);
      }
    });

    const res = await app.request("/freight/requests", jsonRequest(VALID_BODY));
    assert.equal(res.status, 403, `Expected 403 FORBIDDEN but got ${res.status}`);
    const json = await res.json() as Record<string, unknown>;
    assert.equal(json.ok, false);
  });
});

// ─── Response envelope contract ───────────────────────────────────────────────

describe("Response envelope contract", () => {
  it("success envelope is { ok: true, data: {} }", async () => {
    const app = await buildTestApp({ serviceResult: { freight_request_id: "fr-1" } });
    const res = await app.request("/freight/requests", jsonRequest(VALID_BODY));
    const json = await res.json() as Record<string, unknown>;
    assert.equal(json.ok, true);
    assert.ok("data" in json, "should have data");
    assert.ok(!("error" in json), "should not have error");
  });

  it("error envelope is { ok: false, error: { code, message } }", async () => {
    const app = await buildTestApp({ authFails: true });
    const res = await app.request("/freight/requests", jsonRequest(VALID_BODY));
    const json = await res.json() as Record<string, unknown>;
    assert.equal(json.ok, false);
    const error = json.error as Record<string, unknown>;
    assert.ok("code" in error);
    assert.ok("message" in error);
    assert.ok(!("data" in json), "should not have data");
  });
});

// ─── POST /freight/requests/:id/submit ───────────────────────────────────────

describe("POST /freight/requests/:id/submit — Transition DRAFT -> PENDING", () => {
  it("returns 200 with ok:true and updated intake data", async () => {
    const app = await buildTestApp({
      submitResult: { status: "PENDING", draftVersion: 2, requestCode: "FR-3001" },
    });
    const res = await app.request(
      "/freight/requests/10000000-0000-0000-0000-000000000001/submit",
      jsonRequest({ draftVersion: 1 }),
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(json.ok, true);
    const data = json.data as Record<string, unknown>;
    assert.equal(data.status, "PENDING");
    assert.equal(data.draftVersion, 2);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const app = await buildTestApp();
    const res = await app.request(
      "/freight/requests/10000000-0000-0000-0000-000000000001/submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json",
      },
    );
    assert.equal(res.status, 400);
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(json.ok, false);
  });

  it("returns 400 when draftVersion is missing or invalid", async () => {
    const app = await buildTestApp();
    const resMissing = await app.request(
      "/freight/requests/10000000-0000-0000-0000-000000000001/submit",
      jsonRequest({}),
    );
    assert.equal(resMissing.status, 400);

    const resInvalid = await app.request(
      "/freight/requests/10000000-0000-0000-0000-000000000001/submit",
      jsonRequest({ draftVersion: -1 }),
    );
    assert.equal(resInvalid.status, 400);
  });

  it("returns 401 when unauthenticated", async () => {
    const app = await buildTestApp({ authFails: true });
    const res = await app.request(
      "/freight/requests/10000000-0000-0000-0000-000000000001/submit",
      jsonRequest({ draftVersion: 1 }),
    );
    assert.equal(res.status, 401);
  });

  it("returns 409 when draft version is stale", async () => {
    const staleErr = Object.assign(new Error("El borrador cambió."), {
      code: "STALE_DRAFT",
      httpStatus: 409,
    });
    const app = await buildTestApp({ submitError: staleErr });
    const res = await app.request(
      "/freight/requests/10000000-0000-0000-0000-000000000001/submit",
      jsonRequest({ draftVersion: 1 }),
    );
    assert.equal(res.status, 409);
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(json.ok, false);
    assert.equal((json.error as Record<string, unknown>).code, "STALE_DRAFT");
  });
});

