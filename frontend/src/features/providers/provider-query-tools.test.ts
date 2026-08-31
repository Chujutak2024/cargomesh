import assert from "node:assert/strict";
import test from "node:test";

import { createCheckCapacityTool } from "./check-capacity-tool";
import { createCheckServiceCoverageTool } from "./check-service-coverage-tool";
import type {
  ProviderPageConfig,
  ProviderQuote,
  ProviderToolEnvelope,
} from "./contracts";
import type { CapacityResult } from "./check-capacity-tool";
import type { ServiceCoverageResult } from "./check-service-coverage-tool";
import type {
  ProviderBookFreightResult,
  ProviderBookingStatusResult,
} from "./provider-booking-contracts";
import {
  createInMemoryProviderBookingStorage,
  createProviderFixtureController,
} from "./provider-booking-runtime";
import { createQuoteFreightTool } from "./quote-freight-tool";
import {
  CARGOMESH_TOOL_CALLER_ORIGINS,
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

const compatibleQuoteInput = {
  freight_request_id: "f2000000-0000-0000-0000-000000000001",
  origin: "Callao, Peru",
  destination: "Santiago, Chile",
  cargo_weight_kg: 8_000,
  cargo_volume_m3: 18,
  cargo_category: "MACHINERY",
  pickup_mode: "ASAP",
};

async function executeTool<T>(
  tool: WebMCP.ModelContextTool,
  input: Record<string, unknown>,
  signal = new AbortController().signal,
): Promise<ProviderToolEnvelope<T>> {
  return (await tool.execute(input, { signal })) as ProviderToolEnvelope<T>;
}

test("the provider exposes all five expected tool definitions", () => {
  const tools = createProviderTools(seededProvider);

  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "check_service_coverage",
      "check_capacity",
      "quote_freight",
      "book_freight",
      "get_provider_booking_status",
    ],
  );
  assert.deepEqual(
    tools.map((tool) => tool.annotations?.readOnlyHint),
    [true, true, true, false, true],
  );
});

test("registration exposes all five tools cross-origin and the shared signal cleans them up", async () => {
  const registeredTools = new Map<
    string,
    {
      options: WebMCP.ModelContextRegisterToolOptions;
      tool: WebMCP.ModelContextTool;
    }
  >();
  const modelContext = {
    async registerTool(
      tool: WebMCP.ModelContextTool,
      options?: WebMCP.ModelContextRegisterToolOptions,
    ) {
      registeredTools.set(tool.name, { options: options ?? {}, tool });
      options?.signal?.addEventListener(
        "abort",
        () => registeredTools.delete(tool.name),
        { once: true },
      );
    },
    async getTools(options?: WebMCP.ModelContextGetToolOptions) {
      return [...registeredTools.values()]
        .filter(({ options: registrationOptions }) =>
          !options?.fromOrigins?.length ||
          options.fromOrigins.some((origin) =>
            registrationOptions.exposedTo?.includes(origin),
          ),
        )
        .map(({ tool }) => ({ name: tool.name })) as WebMCP.RegisteredTool[];
    },
    async executeTool(
      tool: WebMCP.RegisteredTool,
      inputJson = "{}",
      options?: WebMCP.ModelContextExecuteToolOptions,
    ) {
      const registration = registeredTools.get(tool.name);
      if (!registration) {
        throw new Error(`Tool '${tool.name}' is not registered.`);
      }

      const result = await registration.tool.execute(JSON.parse(inputJson), {
        signal: options?.signal ?? new AbortController().signal,
      });
      return JSON.stringify(result);
    },
  } as WebMCP.ModelContext;
  const registrationController = new AbortController();
  const bookingStorage = createInMemoryProviderBookingStorage();

  assert.equal(
    await registerProviderTools(
      modelContext,
      seededProvider,
      registrationController.signal,
      {
        bookingStorage,
        now: () => new Date("2026-08-30T20:00:00.000Z"),
      },
    ),
    true,
  );
  assert.deepEqual(
    (await modelContext.getTools()).map((tool) => tool.name),
    [
      "check_service_coverage",
      "check_capacity",
      "quote_freight",
      "book_freight",
      "get_provider_booking_status",
    ],
  );
  assert.equal(registeredTools.size, 5);
  for (const { options } of registeredTools.values()) {
    assert.deepEqual(options.exposedTo, CARGOMESH_TOOL_CALLER_ORIGINS);
    assert.equal(options.signal, registrationController.signal);
  }

  const cargoMeshOrigin = "http://localhost:3001";
  const crossOriginTools = await modelContext.getTools({
    fromOrigins: [cargoMeshOrigin],
  });
  assert.deepEqual(
    crossOriginTools.map((tool) => tool.name),
    [
      "check_service_coverage",
      "check_capacity",
      "quote_freight",
      "book_freight",
      "get_provider_booking_status",
    ],
  );

  const coverageTool = crossOriginTools.find(
    (tool) => tool.name === "check_service_coverage",
  );
  assert.ok(coverageTool);
  const coverageResult = JSON.parse(
    (await modelContext.executeTool(
      coverageTool,
      JSON.stringify(compatibleCoverageInput),
    )) as string,
  ) as ProviderToolEnvelope<ServiceCoverageResult>;
  assert.equal(coverageResult.ok && coverageResult.data.supported, true);

  const bookTool = crossOriginTools.find(
    (tool) => tool.name === "book_freight",
  );
  assert.ok(bookTool);
  const bookResult = JSON.parse(
    (await modelContext.executeTool(
      bookTool,
      JSON.stringify({
        freight_request_id: compatibleQuoteInput.freight_request_id,
        provider_offer_reference: "AND-OFF-8821",
        idempotency_key: "cm:a04:model-context:booking:v1",
        authorization_context: {
          authorization_reference: "server-selection:decision-1:offer-1",
          authorized_by: "HUMAN_SELECTION",
        },
        selection_mode: "ASSISTED",
      }),
    )) as string,
  ) as ProviderToolEnvelope<ProviderBookFreightResult>;
  assert.equal(bookResult.ok, true);
  if (!bookResult.ok) return;

  createProviderFixtureController(
    seededProvider.service.providerServiceCode,
    bookingStorage,
  ).setNextResponse(bookResult.data.providerReference, "ACCEPT");
  const statusTool = crossOriginTools.find(
    (tool) => tool.name === "get_provider_booking_status",
  );
  assert.ok(statusTool);
  const statusResult = JSON.parse(
    (await modelContext.executeTool(
      statusTool,
      JSON.stringify({ provider_reference: bookResult.data.providerReference }),
    )) as string,
  ) as ProviderToolEnvelope<ProviderBookingStatusResult>;
  assert.equal(
    statusResult.ok && statusResult.data.providerBookingStatus,
    "CONFIRMED",
  );

  registrationController.abort();

  assert.deepEqual(
    await modelContext.getTools({ fromOrigins: [cargoMeshOrigin] }),
    [],
  );
});

test("registration rejects wildcard and query-based caller authorization", async () => {
  const modelContext = {
    async registerTool() {
      assert.fail("Unsafe origins must be rejected before registering a tool.");
    },
    async getTools() {
      return [];
    },
  } as unknown as WebMCP.ModelContext;
  const signal = new AbortController().signal;

  await assert.rejects(
    registerProviderTools(modelContext, seededProvider, signal, {
      exposedTo: ["*"],
    }),
    /must not contain wildcards/,
  );
  await assert.rejects(
    registerProviderTools(modelContext, seededProvider, signal, {
      exposedTo: ["https://cargomesh.example/?tenant=client-controlled"],
    }),
    /without credentials, paths, queries, or fragments/,
  );
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

test("quote uses an injected clock and remains valid for exactly six hours", async () => {
  const fixedNow = new Date("2026-08-31T00:30:00.000Z");
  let clockReads = 0;
  const tool = createQuoteFreightTool(seededProvider, {
    now: () => {
      clockReads += 1;
      return fixedNow;
    },
  });

  const result = await executeTool<ProviderQuote>(tool, compatibleQuoteInput);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(clockReads, 1);
  assert.equal(result.data.estimatedPickup, "2026-09-01T00:30:00.000Z");
  assert.equal(result.data.validUntil, "2026-08-31T06:30:00.000Z");
  assert.equal(
    Date.parse(result.data.validUntil) - fixedNow.getTime(),
    6 * 60 * 60 * 1000,
  );
});

test("quote keeps a scheduled pickup while validity derives from the frozen clock", async () => {
  const fixedNow = new Date("2026-08-30T20:00:00.000Z");
  const result = await executeTool<ProviderQuote>(
    createQuoteFreightTool(seededProvider, { now: () => fixedNow }),
    {
      ...compatibleQuoteInput,
      pickup_mode: "SCHEDULED",
      pickup_window_start: "2026-09-01T12:00:00.000Z",
      pickup_window_end: "2026-09-01T18:00:00.000Z",
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.estimatedPickup, "2026-09-01T12:00:00.000Z");
  assert.equal(result.data.validUntil, "2026-08-31T02:00:00.000Z");
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
