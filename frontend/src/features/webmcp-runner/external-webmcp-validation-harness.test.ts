import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateProvider } from "@/features/providers/contracts";
import { REQUIRED_PROVIDER_TOOL_NAMES } from "@/features/providers/provider-tool-registration";

import {
  INT02A_PROVIDER_TOOL_NAMES,
  type Int02aProviderToolName,
  type ProviderRunnerInputs,
} from "./contracts";
import { runExternalWebMcpValidation } from "./external-webmcp-validation-harness";

const CARGOMESH_URL = "https://cargomesh.vercel.app/";
const REQUEST_ID = "f2000000-0000-0000-0000-000000000001";
const RUN_ID = "fa000000-0000-0000-0000-000000000001";

const syntheticPolarisFixture: CandidateProvider = {
  carrierId: "b2000000-0000-0000-0000-000000000001",
  carrierCode: "POLARIS_COLD_CHAIN",
  displayName: "Polaris Cold Chain Logistics",
  providerUrl:
    "https://polaris-provider.example/providers/polaris-cold-chain",
  matchingServiceId: "d2000000-0000-0000-0000-000000000001",
};

const syntheticApexFixture: CandidateProvider = {
  carrierId: "b2000000-0000-0000-0000-000000000002",
  carrierCode: "APEX_HAZMAT",
  displayName: "Apex Hazmat Transport",
  providerUrl: "https://apex-provider.example/providers/apex-hazmat",
  matchingServiceId: "d2000000-0000-0000-0000-000000000002",
};

function inputs(cargoCategory: string, specialRequirements: string[]): ProviderRunnerInputs {
  return {
    check_service_coverage: {
      origin: "Callao, PE",
      destination: "Santiago, CL",
      transport_mode: "ROAD",
      service_type: "FTL",
      cargo_category: cargoCategory,
    },
    check_capacity: {
      origin: "Callao, PE",
      destination: "Santiago, CL",
      cargo_weight_kg: 8_000,
      cargo_volume_m3: 18,
      cargo_category: cargoCategory,
      pickup_mode: "SCHEDULED",
      pickup_window_start: "2026-09-10T13:00:00.000Z",
      pickup_window_end: "2026-09-10T17:00:00.000Z",
      delivery_deadline: "2026-09-13T13:00:00.000Z",
      special_requirements: specialRequirements,
    },
    quote_freight: {
      freight_request_id: REQUEST_ID,
      origin: "Callao, PE",
      destination: "Santiago, CL",
      cargo_weight_kg: 8_000,
      cargo_volume_m3: 18,
      cargo_category: cargoCategory,
      pickup_mode: "SCHEDULED",
      pickup_window_start: "2026-09-10T13:00:00.000Z",
      pickup_window_end: "2026-09-10T17:00:00.000Z",
      delivery_deadline: "2026-09-13T13:00:00.000Z",
      available_documents: [
        "commercial_invoice",
        "packing_list",
        "certificate_of_origin",
      ],
    },
  };
}

type Listener = () => void;

function createFrame() {
  const frameWindow = {} as Window;
  const listeners = new Map<string, Set<Listener>>();
  const attributes = new Map<string, string>();
  const navigations: string[] = [];
  let currentSrc = CARGOMESH_URL;

  const frame = {
    contentWindow: frameWindow,
    get src() {
      return currentSrc;
    },
    set src(value: string) {
      currentSrc = value;
      navigations.push(value);
      queueMicrotask(() => {
        for (const listener of listeners.get("load") ?? []) listener();
      });
    },
    addEventListener(type: string, listener: Listener) {
      const current = listeners.get(type) ?? new Set<Listener>();
      current.add(listener);
      listeners.set(type, current);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
  } as unknown as HTMLIFrameElement;

  return {
    frame,
    frameWindow,
    attributes,
    navigations,
    get src() {
      return currentSrc;
    },
  };
}

function createModelContext(frame: ReturnType<typeof createFrame>) {
  const getToolsOptions: Array<{ fromOrigins?: string[] } | undefined> = [];
  const executed: Array<{
    origin: string;
    toolName: string;
    input: Record<string, unknown>;
  }> = [];

  const modelContext = {
    async getTools(options?: { fromOrigins?: string[] }) {
      getToolsOptions.push(options);
      const activeUrl = new URL(frame.src);
      if (activeUrl.origin === new URL(CARGOMESH_URL).origin) return [];
      if (!options?.fromOrigins?.includes(activeUrl.origin)) return [];

      return REQUIRED_PROVIDER_TOOL_NAMES.map((toolName) => ({
        name: toolName,
        title: toolName,
        description: `Synthetic test tool ${toolName}`,
        origin: activeUrl.origin,
        window: frame.frameWindow,
      })) as WebMCP.RegisteredTool[];
    },
    async executeTool(
      tool: WebMCP.RegisteredTool,
      inputJson = "{}",
      options?: WebMCP.ModelContextExecuteToolOptions,
    ) {
      if (options?.signal?.aborted) {
        throw new DOMException("Execution aborted.", "AbortError");
      }

      const input = JSON.parse(inputJson) as Record<string, unknown>;
      executed.push({ origin: tool.origin, toolName: tool.name, input });

      const outputByTool: Record<Int02aProviderToolName, unknown> = {
        check_service_coverage: {
          ok: true,
          data: { supported: true, corridor: "Callao → Santiago" },
        },
        check_capacity: {
          ok: true,
          data: { available: true, availableCapacityKg: 22_000 },
        },
        quote_freight: {
          ok: true,
          data: {
            schemaVersion: "1.0",
            freightRequestId: input.freight_request_id,
            providerOfferReference: `${tool.origin}-OFFER-1`,
          },
        },
      };

      return JSON.stringify(outputByTool[tool.name as Int02aProviderToolName]);
    },
  } as WebMCP.ModelContext;

  return { modelContext, getToolsOptions, executed };
}

test("runs synthetic Polaris and Apex fixtures through the external contract harness", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);
  const result = await runExternalWebMcpValidation({
    targets: [
      {
        candidate: syntheticPolarisFixture,
        inputs: inputs("agricultural", ["temperature controlled"]),
      },
      {
        candidate: syntheticApexFixture,
        inputs: inputs("hazmat", ["dangerous goods"]),
      },
    ],
    cargoMeshBaseUrl: CARGOMESH_URL,
    frame: frame.frame,
    documentHost: { modelContext: context.modelContext },
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigationTimeoutMs: 100,
    webMcpReadyTimeoutMs: 100,
  });

  const polarisOrigin = new URL(syntheticPolarisFixture.providerUrl).origin;
  const apexOrigin = new URL(syntheticApexFixture.providerUrl).origin;
  assert.equal(frame.attributes.get("allow"), "tools");
  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.cargoMeshOrigin, "https://cargomesh.vercel.app");
  assert.deepEqual(result.providerOrigins, [polarisOrigin, apexOrigin]);
  assert.deepEqual(
    result.targets.map((target) => target.matchingServiceId),
    [
      syntheticPolarisFixture.matchingServiceId,
      syntheticApexFixture.matchingServiceId,
    ],
  );
  assert.equal(
    result.targets.every(
      (target) =>
        new URL(target.navigationUrl).searchParams.get("serviceId") ===
        target.matchingServiceId,
    ),
    true,
  );

  assert.equal(result.collection.candidateCount, 2);
  assert.equal(result.collection.completedCandidateCount, 2);
  assert.deepEqual(
    result.collection.attempts.map((attempt) => attempt.status),
    ["QUOTED", "QUOTED"],
  );
  assert.deepEqual(
    result.collection.attempts.map((attempt) => attempt.completedTools),
    [INT02A_PROVIDER_TOOL_NAMES, INT02A_PROVIDER_TOOL_NAMES],
  );
  assert.equal(
    result.collection.attempts.every((attempt) => attempt.cleanup.verified),
    true,
  );
  assert.equal(result.collection.attempts.flatMap((attempt) => attempt.calls).length, 6);
  assert.deepEqual(
    context.executed.map((call) => call.toolName),
    [...INT02A_PROVIDER_TOOL_NAMES, ...INT02A_PROVIDER_TOOL_NAMES],
  );
  assert.equal(
    context.executed.some(
      (call) =>
        call.origin === polarisOrigin &&
        call.toolName === "check_service_coverage" &&
        call.input.cargo_category === "agricultural",
    ),
    true,
  );
  assert.equal(
    context.executed.some(
      (call) =>
        call.origin === apexOrigin &&
        call.toolName === "check_capacity" &&
        call.input.cargo_category === "hazmat",
    ),
    true,
  );
  assert.equal(
    context.getToolsOptions.some(
      (options) => options?.fromOrigins?.length === 1 &&
        options.fromOrigins[0] === polarisOrigin,
    ),
    true,
  );
  assert.equal(
    context.getToolsOptions.some(
      (options) => options?.fromOrigins?.length === 1 &&
        options.fromOrigins[0] === apexOrigin,
    ),
    true,
  );
  assert.equal(
    context.getToolsOptions.some((options) =>
      options?.fromOrigins?.includes("*"),
    ),
    false,
  );
  assert.deepEqual(frame.navigations, [
    `${syntheticPolarisFixture.providerUrl}?serviceId=${syntheticPolarisFixture.matchingServiceId}`,
    CARGOMESH_URL,
    `${syntheticApexFixture.providerUrl}?serviceId=${syntheticApexFixture.matchingServiceId}`,
    CARGOMESH_URL,
  ]);
});

test("rejects a relative target before navigation because external URLs must be absolute", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);

  await assert.rejects(
    runExternalWebMcpValidation({
      targets: [{
        candidate: {
          ...syntheticPolarisFixture,
          providerUrl: "/providers/polaris-cold-chain",
        },
        inputs: inputs("agricultural", ["temperature controlled"]),
      }],
      cargoMeshBaseUrl: CARGOMESH_URL,
      frame: frame.frame,
      documentHost: { modelContext: context.modelContext },
      orchestrationRunId: RUN_ID,
      freightRequestId: REQUEST_ID,
    }),
    /INVALID_EXTERNAL_PROVIDER_ORIGIN/,
  );

  assert.deepEqual(frame.navigations, []);
  assert.deepEqual(context.executed, []);
});

test("rejects an absolute target on the CargoMesh origin before navigation", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);

  await assert.rejects(
    runExternalWebMcpValidation({
      targets: [{
        candidate: {
          ...syntheticPolarisFixture,
          providerUrl: `${CARGOMESH_URL}providers/polaris-cold-chain`,
        },
        inputs: inputs("agricultural", ["temperature controlled"]),
      }],
      cargoMeshBaseUrl: CARGOMESH_URL,
      frame: frame.frame,
      documentHost: { modelContext: context.modelContext },
      orchestrationRunId: RUN_ID,
      freightRequestId: REQUEST_ID,
    }),
    /EXTERNAL_PROVIDER_REQUIRED/,
  );

  assert.deepEqual(frame.navigations, []);
});

test("rejects wildcard origins and credentials before navigation", async () => {
  for (const providerUrl of [
    "https://*.provider.example/providers/fixture",
    "https://user:password@provider.example/providers/fixture",
  ]) {
    const frame = createFrame();
    const context = createModelContext(frame);
    await assert.rejects(
      runExternalWebMcpValidation({
        targets: [{
          candidate: { ...syntheticPolarisFixture, providerUrl },
          inputs: inputs("agricultural", ["temperature controlled"]),
        }],
        cargoMeshBaseUrl: CARGOMESH_URL,
        frame: frame.frame,
        documentHost: { modelContext: context.modelContext },
        orchestrationRunId: RUN_ID,
        freightRequestId: REQUEST_ID,
      }),
      /INVALID_EXTERNAL_PROVIDER_ORIGIN/,
    );
    assert.deepEqual(frame.navigations, []);
  }
});

test("rejects an empty matchingServiceId before navigation", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);

  await assert.rejects(
    runExternalWebMcpValidation({
      targets: [{
        candidate: { ...syntheticPolarisFixture, matchingServiceId: "" },
        inputs: inputs("agricultural", ["temperature controlled"]),
      }],
      cargoMeshBaseUrl: CARGOMESH_URL,
      frame: frame.frame,
      documentHost: { modelContext: context.modelContext },
      orchestrationRunId: RUN_ID,
      freightRequestId: REQUEST_ID,
    }),
    /INVALID_MATCHING_SERVICE_ID/,
  );

  assert.deepEqual(frame.navigations, []);
});

test("rejects a duplicated provider service snapshot", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);
  const target = {
    candidate: syntheticPolarisFixture,
    inputs: inputs("agricultural", ["temperature controlled"]),
  };

  await assert.rejects(
    runExternalWebMcpValidation({
      targets: [target, target],
      cargoMeshBaseUrl: CARGOMESH_URL,
      frame: frame.frame,
      documentHost: { modelContext: context.modelContext },
      orchestrationRunId: RUN_ID,
      freightRequestId: REQUEST_ID,
    }),
    /DUPLICATE_EXTERNAL_PROVIDER_TARGET/,
  );

  assert.deepEqual(frame.navigations, []);
});

test("rejects duplicate effective destinations with different carrier metadata", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);

  await assert.rejects(
    runExternalWebMcpValidation({
      targets: [
        {
          candidate: syntheticPolarisFixture,
          inputs: inputs("agricultural", ["temperature controlled"]),
        },
        {
          candidate: {
            ...syntheticPolarisFixture,
            carrierId: "another-synthetic-carrier",
            carrierCode: "SYNTHETIC_DUPLICATE",
          },
          inputs: inputs("agricultural", ["temperature controlled"]),
        },
      ],
      cargoMeshBaseUrl: CARGOMESH_URL,
      frame: frame.frame,
      documentHost: { modelContext: context.modelContext },
      orchestrationRunId: RUN_ID,
      freightRequestId: REQUEST_ID,
    }),
    /DUPLICATE_EXTERNAL_PROVIDER_TARGET/,
  );

  assert.deepEqual(frame.navigations, []);
});
