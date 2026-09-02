import assert from "node:assert/strict";
import test from "node:test";

import {
  GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
  type FreightRecommendationInput,
  type FreightRecommendationToolEnvelope,
} from "./contracts";
import {
  executeFreightRecommendationToolViaWebMcp,
  registerFreightRecommendationTool,
} from "./recommendation-webmcp-runtime";

const freightRequestId = "f2000000-0000-0000-0000-000000000001";
const sourceRequestId = "f2100000-0000-0000-0000-000000000001";
const input: FreightRecommendationInput = {
  freightRequestId,
  draftVersion: 3,
};

type RecommendationFixtureBody = {
  schemaVersion: string;
  freightRequestId: string;
  draftVersion: number;
  suggestions: Array<{
    suggestionId: string;
    sourceType: string;
    sourceRequestId: string;
    reasonCodes: string[];
    explanation: string;
    proposedFields: Record<string, unknown>;
  }>;
};

function recommendationBody(
  proposedFields: Record<string, unknown> = {},
): RecommendationFixtureBody {
  return {
    schemaVersion: "1.0",
    freightRequestId,
    draftVersion: 3,
    suggestions: [
      {
        suggestionId: "suggestion-d1-001",
        sourceType: "SYNTHETIC_RECOMMENDATION_HISTORY",
        sourceRequestId,
        reasonCodes: ["SAME_CORRIDOR", "SAME_CATEGORY"],
        explanation: "Antecedente sintético similar para revisión humana.",
        proposedFields: {
          origin_country: "PE",
          origin_city: "Lima",
          destination_country: "PE",
          destination_city: "Arequipa",
          cargo_entry_method: "PALLETS",
          entry_quantity: 7,
          entry_unit_weight_kg: 1000,
          units_per_entry: 1,
          ...proposedFields,
        },
      },
    ],
  };
}

function createModelContextHarness() {
  const registered = new Map<string, WebMCP.ModelContextTool>();
  const registrationOptions = new Map<
    string,
    WebMCP.ModelContextRegisterToolOptions
  >();
  const executions: Array<{
    name: string;
    input: Record<string, unknown>;
  }> = [];
  const modelContext = {
    async registerTool(
      tool: WebMCP.ModelContextTool,
      options: WebMCP.ModelContextRegisterToolOptions = {},
    ) {
      registered.set(tool.name, tool);
      registrationOptions.set(tool.name, options);
      options.signal?.addEventListener(
        "abort",
        () => {
          registered.delete(tool.name);
          registrationOptions.delete(tool.name);
        },
        { once: true },
      );
    },
    async getTools() {
      return [...registered.values()].map((tool) => ({
        name: tool.name,
      })) as WebMCP.RegisteredTool[];
    },
    async executeTool(
      tool: WebMCP.RegisteredTool,
      input: Record<string, unknown> = {},
      options?: WebMCP.ModelContextExecuteToolOptions,
    ) {
      const implementation = registered.get(tool.name);
      if (!implementation) throw new Error("Tool is not registered.");
      executions.push({ name: tool.name, input });
      const output = await implementation.execute(input, {
        signal: options?.signal ?? new AbortController().signal,
      });
      return output;
    },
  } as WebMCP.ModelContext;

  return {
    documentHost: { modelContext },
    executions,
    registered,
    registrationOptions,
  };
}

test("getTools and executeTool cross document.modelContext with a strict read-only tool", async () => {
  const harness = createModelContextHarness();
  const registrationController = new AbortController();
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  assert.equal(
    await registerFreightRecommendationTool(
      harness.documentHost,
      registrationController.signal,
      {
        request: async (url, init) => {
          requests.push({ url: String(url), init });
          return Response.json(recommendationBody());
        },
      },
    ),
    true,
  );

  const tools = await harness.documentHost.modelContext.getTools();
  assert.deepEqual(tools.map((tool) => tool.name), [
    GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
  ]);
  const implementation = harness.registered.get(
    GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
  );
  assert.equal(implementation?.annotations?.readOnlyHint, true);
  assert.equal(
    (implementation?.inputSchema as { additionalProperties?: boolean })
      .additionalProperties,
    false,
  );

  const result = await executeFreightRecommendationToolViaWebMcp(
    harness.documentHost,
    input,
    new AbortController().signal,
  );

  assert.equal(result.ok, true);
  assert.equal(harness.executions.length, 1);
  assert.equal(
    harness.executions[0]?.name,
    GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
  );
  assert.deepEqual(harness.executions[0]?.input, input);
  assert.equal(
    requests[0]?.url,
    `/api/freight-requests/${freightRequestId}/recommendations?draftVersion=3`,
  );
  assert.equal(requests[0]?.init?.method, "GET");
  assert.equal(requests[0]?.init?.cache, "no-store");
  assert.equal(requests[0]?.init?.credentials, "same-origin");

  registrationController.abort();
  assert.deepEqual(await harness.documentHost.modelContext.getTools(), []);
});

test("HTTP 409 becomes a STALE_DRAFT tool response through executeTool", async () => {
  const harness = createModelContextHarness();
  const registrationController = new AbortController();
  await registerFreightRecommendationTool(
    harness.documentHost,
    registrationController.signal,
    {
      request: async () => Response.json(
        { code: "STALE_DRAFT" },
        { status: 409 },
      ),
    },
  );

  const result = await executeFreightRecommendationToolViaWebMcp(
    harness.documentHost,
    input,
    new AbortController().signal,
  );

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "STALE_DRAFT",
      message:
        "La versión del borrador cambió; vuelve a consultar antes de aplicar sugerencias.",
      retryable: false,
    },
  });
  assert.equal(harness.executions.length, 1);
});

test("HTTP 403 stays a read-only authorization failure", async () => {
  const harness = createModelContextHarness();
  const registrationController = new AbortController();
  await registerFreightRecommendationTool(
    harness.documentHost,
    registrationController.signal,
    {
      request: async () => Response.json({}, { status: 403 }),
    },
  );

  const result = await executeFreightRecommendationToolViaWebMcp(
    harness.documentHost,
    input,
    new AbortController().signal,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "FORBIDDEN");
    assert.equal(result.error.retryable, false);
  }
});

test("the canonical whitelist rejects aliases, totals and groups", async () => {
  for (const invalidProposedFields of [
    { originCountry: "PE" },
    { cargo_weight_kg: 7000 },
    { cargo_volume_m3: 10.5 },
    { route: { origin_country: "PE" } },
  ]) {
    const harness = createModelContextHarness();
    const controller = new AbortController();
    await registerFreightRecommendationTool(harness.documentHost, controller.signal, {
      request: async () => Response.json(recommendationBody(invalidProposedFields)),
    });

    const result = await executeFreightRecommendationToolViaWebMcp(
      harness.documentHost,
      input,
      new AbortController().signal,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "INVALID_RECOMMENDATION_RESPONSE");
    }
    controller.abort();
  }
});

test("the response validator rejects extra envelope fields", async () => {
  const harness = createModelContextHarness();
  const controller = new AbortController();
  await registerFreightRecommendationTool(harness.documentHost, controller.signal, {
    request: async () => Response.json({
      ...recommendationBody(),
      applied: true,
    }),
  });

  const result = await executeFreightRecommendationToolViaWebMcp(
    harness.documentHost,
    input,
    new AbortController().signal,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "INVALID_RECOMMENDATION_RESPONSE");
  }
});

test("TOTAL_WEIGHT never carries unitized quantities from a suggestion", async () => {
  const harness = createModelContextHarness();
  const controller = new AbortController();
  await registerFreightRecommendationTool(harness.documentHost, controller.signal, {
    request: async () => Response.json(
      recommendationBody({ cargo_entry_method: "TOTAL_WEIGHT" }),
    ),
  });

  const result = await executeFreightRecommendationToolViaWebMcp(
    harness.documentHost,
    input,
    new AbortController().signal,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "INVALID_RECOMMENDATION_RESPONSE");
    assert.match(result.error.message, /distinto de TOTAL_WEIGHT/);
  }
});

test("TOTAL_WEIGHT is accepted only when unitized quantities are absent", async () => {
  const harness = createModelContextHarness();
  const controller = new AbortController();
  const body = recommendationBody();
  body.suggestions[0]!.proposedFields = {
    cargo_entry_method: "TOTAL_WEIGHT",
    cargo_description: "Carga total sintética para revisión.",
  };
  await registerFreightRecommendationTool(harness.documentHost, controller.signal, {
    request: async () => Response.json(body),
  });

  const result = await executeFreightRecommendationToolViaWebMcp(
    harness.documentHost,
    input,
    new AbortController().signal,
  );
  assert.equal(result.ok, true);
});

test("strict input rejects missing, invalid and additional fields before calling the endpoint", async () => {
  const harness = createModelContextHarness();
  const controller = new AbortController();
  let requests = 0;
  await registerFreightRecommendationTool(harness.documentHost, controller.signal, {
    request: async () => {
      requests += 1;
      return Response.json(recommendationBody());
    },
  });
  const registeredTool = (await harness.documentHost.modelContext.getTools())[0];
  assert.ok(registeredTool);

  for (const invalidInput of [
    { freightRequestId, draftVersion: 0 },
    { freightRequestId: "not-a-uuid", draftVersion: 1 },
    { freightRequestId, draftVersion: 1, organizationId: "forbidden" },
  ]) {
    const output = await (
      harness.documentHost.modelContext as unknown as {
        executeTool(
          tool: WebMCP.RegisteredTool,
          input: Record<string, unknown>,
        ): Promise<unknown>;
      }
    ).executeTool(registeredTool, invalidInput);
    const result = output as FreightRecommendationToolEnvelope;
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "INVALID_INPUT");
  }
  assert.equal(requests, 0);
});

test("an empty authorized history is a successful empty suggestion list", async () => {
  const harness = createModelContextHarness();
  const controller = new AbortController();
  await registerFreightRecommendationTool(harness.documentHost, controller.signal, {
    request: async () => Response.json({
      schemaVersion: "1.0",
      freightRequestId,
      draftVersion: 3,
      suggestions: [],
    }),
  });

  const result = await executeFreightRecommendationToolViaWebMcp(
    harness.documentHost,
    input,
    new AbortController().signal,
  );
  assert.deepEqual(result, {
    ok: true,
    data: {
      schemaVersion: "1.0",
      freightRequestId,
      draftVersion: 3,
      suggestions: [],
    },
  });
});
