import assert from "node:assert/strict";
import test from "node:test";

import { createCheckCapacityTool } from "./check-capacity-tool";
import { createCheckServiceCoverageTool } from "./check-service-coverage-tool";
import type { ProviderPageConfig, ProviderToolEnvelope } from "./contracts";
import type { CapacityResult } from "./check-capacity-tool";
import type { ServiceCoverageResult } from "./check-service-coverage-tool";
import {
  createProviderTools,
  registerProviderTools,
} from "./provider-tool-registration";

const seededProvider: ProviderPageConfig = {
  carrierId: "carrier-a",
  carrierCode: "FIXTURE_A",
  displayName: "Fixture Provider A",
  providerUrl: "/providers/fixture-a",
  matchingServiceId: "service-a",
  service: {
    providerServiceCode: "ANDES-PECL-FTL",
    transportMode: "ROAD",
    serviceType: "FTL",
    maxCapacityKg: 18_000,
    maxVolumeM3: 80,
    supportsCrossBorder: true,
  },
};

const genericProvider: ProviderPageConfig = {
  ...seededProvider,
  carrierId: "carrier-generic",
  carrierCode: "GENERIC",
  displayName: "Generic Registered Provider",
  matchingServiceId: "service-generic",
  service: {
    ...seededProvider.service,
    providerServiceCode: "GENERIC-REGISTERED-SERVICE",
  },
};

const compatibleCoverageInput = {
  origin: "Callao, Peru",
  destination: "Santiago, Chile",
  transport_mode: "ROAD",
  service_type: "FTL",
  cargo_category: "MACHINERY",
};

const compatibleCapacityInput = {
  origin: "Callao, Peru",
  destination: "Santiago, Chile",
  cargo_weight_kg: 8_000,
  cargo_volume_m3: 18,
  cargo_category: "MACHINERY",
  pickup_mode: "SCHEDULED",
  pickup_window_start: "2026-08-30T12:00:00.000Z",
  pickup_window_end: "2026-08-30T18:00:00.000Z",
  delivery_deadline: "2026-09-02T18:00:00.000Z",
  special_requirements: ["customs coordination"],
};

async function executeTool<T>(
  tool: WebMCP.ModelContextTool,
  input: Record<string, unknown>,
  signal = new AbortController().signal,
): Promise<ProviderToolEnvelope<T>> {
  return (await tool.execute(input, { signal })) as ProviderToolEnvelope<T>;
}

test("the provider exposes the three expected read-only tool definitions", () => {
  const tools = createProviderTools(seededProvider);

  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["check_service_coverage", "check_capacity", "quote_freight"],
  );
  assert.equal(tools.every((tool) => tool.annotations?.readOnlyHint === true), true);
});

test("registration exposes all tools and the shared signal cleans them up", async () => {
  const registeredTools = new Map<string, WebMCP.ModelContextTool>();
  const modelContext = {
    async registerTool(
      tool: WebMCP.ModelContextTool,
      options?: WebMCP.ModelContextRegisterToolOptions,
    ) {
      registeredTools.set(tool.name, tool);
      options?.signal?.addEventListener(
        "abort",
        () => registeredTools.delete(tool.name),
        { once: true },
      );
    },
    async getTools() {
      return [...registeredTools.values()].map((tool) => ({
        name: tool.name,
      })) as WebMCP.RegisteredTool[];
    },
    async executeTool(
      tool: WebMCP.RegisteredTool,
      inputObject: Record<string, unknown> = {},
      options?: WebMCP.ModelContextExecuteToolOptions,
    ) {
      const registeredTool = registeredTools.get(tool.name);
      if (!registeredTool) {
        throw new Error(`Tool '${tool.name}' is not registered.`);
      }

      return registeredTool.execute(inputObject, {
        signal: options?.signal ?? new AbortController().signal,
      });
    },
  } as WebMCP.ModelContext;
  const registrationController = new AbortController();

  assert.equal(
    await registerProviderTools(
      modelContext,
      seededProvider,
      registrationController.signal,
    ),
    true,
  );
  assert.deepEqual(
    (await modelContext.getTools()).map((tool) => tool.name),
    ["check_service_coverage", "check_capacity", "quote_freight"],
  );

  const coverageTool = (await modelContext.getTools()).find(
    (tool) => tool.name === "check_service_coverage",
  );
  assert.ok(coverageTool);
  const coverageResult = (await modelContext.executeTool(
    coverageTool,
    compatibleCoverageInput,
  )) as ProviderToolEnvelope<ServiceCoverageResult>;
  assert.equal(coverageResult.ok && coverageResult.data.supported, true);

  registrationController.abort();

  assert.deepEqual(await modelContext.getTools(), []);
});

test("coverage returns a commercial success for a compatible provider fixture", async () => {
  const tool = createCheckServiceCoverageTool(seededProvider);
  const result = await executeTool<ServiceCoverageResult>(tool, compatibleCoverageInput);

  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(
    (tool.inputSchema as { additionalProperties?: boolean }).additionalProperties,
    false,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.supported, true);
  assert.equal(result.data.crossBorderSupported, true);
  assert.equal(result.data.customsCoordinationAvailable, true);
});

test("coverage represents an incompatible request as a valid commercial response", async () => {
  const result = await executeTool<ServiceCoverageResult>(
    createCheckServiceCoverageTool(seededProvider),
    { ...compatibleCoverageInput, transport_mode: "AIR" },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.supported, false);
  assert.match(result.data.serviceNotes.join(" "), /modalidad disponible/i);
});

test("coverage rejects malformed or additional input fields", async () => {
  const result = await executeTool<ServiceCoverageResult>(
    createCheckServiceCoverageTool(seededProvider),
    { ...compatibleCoverageInput, unexpected: true },
  );

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "INVALID_INPUT",
      message: "El campo 'unexpected' no pertenece al contrato.",
      retryable: false,
    },
  });
});

test("capacity confirms a compatible payload and scheduled window", async () => {
  const tool = createCheckCapacityTool(seededProvider);
  const result = await executeTool<CapacityResult>(tool, compatibleCapacityInput);

  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(
    (tool.inputSchema as { additionalProperties?: boolean }).additionalProperties,
    false,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.available, true);
  assert.equal(result.data.availableCapacityKg, 18_000);
  assert.equal(result.data.availableVolumeM3, 80);
  assert.equal(result.data.requestedWindowAvailable, true);
});

test("capacity reports insufficient weight without throwing a technical error", async () => {
  const result = await executeTool<CapacityResult>(
    createCheckCapacityTool(seededProvider),
    { ...compatibleCapacityInput, cargo_weight_kg: 18_001 },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.available, false);
  assert.equal(result.data.availabilityClass, "UNAVAILABLE");
  assert.match(result.data.capabilityNotes.join(" "), /peso solicitado excede/i);
});

test("capacity reports insufficient volume without throwing a technical error", async () => {
  const result = await executeTool<CapacityResult>(
    createCheckCapacityTool(seededProvider),
    { ...compatibleCapacityInput, cargo_volume_m3: 81 },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.available, false);
  assert.match(result.data.capabilityNotes.join(" "), /volumen solicitado excede/i);
});

test("capacity rejects an invalid scheduled window", async () => {
  const result = await executeTool<CapacityResult>(
    createCheckCapacityTool(seededProvider),
    {
      ...compatibleCapacityInput,
      pickup_window_start: "2026-08-30T18:00:00.000Z",
      pickup_window_end: "2026-08-30T12:00:00.000Z",
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_INPUT");
});

test("unknown provider service codes return conservative commercial responses", async () => {
  const coverage = await executeTool<ServiceCoverageResult>(
    createCheckServiceCoverageTool(genericProvider),
    compatibleCoverageInput,
  );
  const capacity = await executeTool<CapacityResult>(
    createCheckCapacityTool(genericProvider),
    compatibleCapacityInput,
  );

  assert.equal(coverage.ok && coverage.data.supported, false);
  assert.equal(capacity.ok && capacity.data.available, false);
});

test("both provider query tools honor an in-flight AbortSignal", async () => {
  for (const tool of [
    createCheckServiceCoverageTool(seededProvider),
    createCheckCapacityTool(seededProvider),
  ]) {
    const controller = new AbortController();
    const input =
      tool.name === "check_service_coverage"
        ? compatibleCoverageInput
        : compatibleCapacityInput;
    const execution = Promise.resolve(
      tool.execute(input, { signal: controller.signal }),
    );

    controller.abort();

    await assert.rejects(execution, (error: unknown) => {
      return error instanceof DOMException && error.name === "AbortError";
    });
  }
});
