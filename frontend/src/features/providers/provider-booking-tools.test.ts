import assert from "node:assert/strict";
import test from "node:test";

import { createBookFreightTool } from "./book-freight-tool";
import type { ProviderPageConfig, ProviderToolEnvelope } from "./contracts";
import { createGetProviderBookingStatusTool } from "./get-provider-booking-status-tool";
import type {
  BookFreightInput,
  ProviderBookFreightResult,
  ProviderBookingStatusResult,
} from "./provider-booking-contracts";
import {
  createInMemoryProviderBookingStorage,
  createProviderFixtureController,
} from "./provider-booking-runtime";

const provider: ProviderPageConfig = {
  carrierId: "carrier-generic",
  carrierCode: "GENERIC",
  displayName: "Generic Registered Provider",
  providerUrl: "/providers/generic",
  matchingServiceId: "service-generic",
  service: {
    providerServiceCode: "GENERIC-PECL-FTL",
    transportMode: "ROAD",
    serviceType: "FTL",
    maxCapacityKg: 20_000,
    maxVolumeM3: 90,
    supportsCrossBorder: true,
  },
};

const assistedInput: BookFreightInput = {
  freight_request_id: "f2000000-0000-0000-0000-000000000001",
  provider_offer_reference: "GEN-OFF-1001",
  idempotency_key: "cm:booking:offer-1001:v1",
  authorization_context: {
    authorization_reference: "server-selection:decision-1:offer-1001",
    authorized_by: "HUMAN_SELECTION",
  },
  selection_mode: "ASSISTED",
};

async function execute<T>(
  tool: WebMCP.ModelContextTool,
  input: Record<string, unknown>,
  signal = new AbortController().signal,
): Promise<ProviderToolEnvelope<T>> {
  return (await tool.execute(input, { signal })) as ProviderToolEnvelope<T>;
}

async function bookOnce(options?: {
  input?: BookFreightInput;
  now?: () => Date;
  storage?: ReturnType<typeof createInMemoryProviderBookingStorage>;
}) {
  const storage = options?.storage ?? createInMemoryProviderBookingStorage();
  const result = await execute<ProviderBookFreightResult>(
    createBookFreightTool(provider, {
      storage,
      now: options?.now ?? (() => new Date("2026-08-30T20:00:00.000Z")),
    }),
    (options?.input ?? assistedInput) as unknown as Record<string, unknown>,
  );
  if (!result.ok) assert.fail(result.error.message);
  return { storage, result: result.data };
}

test("book_freight exposes a mutating strict schema", () => {
  const tool = createBookFreightTool(provider, {
    storage: createInMemoryProviderBookingStorage(),
  });

  assert.equal(tool.name, "book_freight");
  assert.equal(tool.annotations?.readOnlyHint, false);
  assert.equal(
    (tool.inputSchema as { additionalProperties?: boolean }).additionalProperties,
    false,
  );
  assert.equal(
    (
      tool.inputSchema as {
        properties: {
          authorization_context: { additionalProperties?: boolean };
        };
      }
    ).properties.authorization_context.additionalProperties,
    false,
  );
});

test("book_freight freezes one clock read and sets a fifteen-minute deadline", async () => {
  let clockReads = 0;
  const issuedAt = new Date("2026-08-30T20:00:00.000Z");
  const { result } = await bookOnce({
    now: () => {
      clockReads += 1;
      return issuedAt;
    },
  });

  assert.equal(clockReads, 1);
  assert.equal(result.providerBookingStatus, "PENDING_PROVIDER_CONFIRMATION");
  assert.equal(result.providerResponseDeadline, "2026-08-30T20:15:00.000Z");
  assert.equal(
    Date.parse(result.providerResponseDeadline) - issuedAt.getTime(),
    15 * 60 * 1000,
  );
  assert.equal(result.paymentRequired, false);
  assert.equal(result.paymentUrl, null);
  assert.equal(result.idempotentReplay, false);
});

test("same idempotency identity replays the provider reference and deadline", async () => {
  const storage = createInMemoryProviderBookingStorage();
  const first = await bookOnce({ storage });
  const second = await bookOnce({
    storage,
    now: () => new Date("2027-01-01T00:00:00.000Z"),
  });

  assert.equal(second.result.providerReference, first.result.providerReference);
  assert.equal(
    second.result.providerResponseDeadline,
    first.result.providerResponseDeadline,
  );
  assert.equal(second.result.idempotentReplay, true);
});

test("same idempotency key with a changed payload returns IDEMPOTENCY_CONFLICT", async () => {
  const { storage } = await bookOnce();
  const result = await execute<ProviderBookFreightResult>(
    createBookFreightTool(provider, { storage }),
    {
      ...assistedInput,
      freight_request_id: "another-request",
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "IDEMPOTENCY_CONFLICT");
});

test("a second idempotency key for the active offer returns BOOKING_ALREADY_EXISTS", async () => {
  const { storage, result: first } = await bookOnce();
  const result = await execute<ProviderBookFreightResult>(
    createBookFreightTool(provider, { storage }),
    {
      ...assistedInput,
      idempotency_key: "cm:booking:offer-1001:v2",
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "BOOKING_ALREADY_EXISTS");
  assert.match(result.error.message, new RegExp(first.providerReference));
});

test("invalid authorization context and additional properties are rejected", async () => {
  const storage = createInMemoryProviderBookingStorage();
  const tool = createBookFreightTool(provider, { storage });
  const mismatched = await execute<ProviderBookFreightResult>(tool, {
    ...assistedInput,
    selection_mode: "SMART_AUTO",
  });
  const additional = await execute<ProviderBookFreightResult>(tool, {
    ...assistedInput,
    unexpected: true,
  });

  assert.equal(mismatched.ok, false);
  assert.equal(!mismatched.ok && mismatched.error.code, "INVALID_INPUT");
  assert.equal(additional.ok, false);
  assert.equal(!additional.ok && additional.error.code, "INVALID_INPUT");
});

test("status rejects unknown references without fabricating a booking", async () => {
  const tool = createGetProviderBookingStatusTool(provider, {
      storage: createInMemoryProviderBookingStorage(),
    });
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(
    (tool.inputSchema as { additionalProperties?: boolean }).additionalProperties,
    false,
  );
  const result = await execute<ProviderBookingStatusResult>(
    tool,
    { provider_reference: "UNKNOWN-BOOKING" },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "BOOKING_NOT_FOUND");
});

test("ACCEPT is one-shot and repeated polling preserves stable provider events", async () => {
  const { storage, result: booked } = await bookOnce();
  const controller = createProviderFixtureController(
    provider.service.providerServiceCode,
    storage,
  );
  let clockReads = 0;
  const statusTool = createGetProviderBookingStatusTool(provider, {
    storage,
    now: () => {
      clockReads += 1;
      return new Date("2026-08-30T20:04:00.000Z");
    },
  });
  controller.setNextResponse(booked.providerReference, "ACCEPT");

  const first = await execute<ProviderBookingStatusResult>(statusTool, {
    provider_reference: booked.providerReference,
  });
  const replay = await execute<ProviderBookingStatusResult>(statusTool, {
    provider_reference: booked.providerReference,
  });

  assert.equal(first.ok && first.data.providerBookingStatus, "CONFIRMED");
  assert.equal(replay.ok && replay.data.providerBookingStatus, "CONFIRMED");
  assert.equal(clockReads, 1);
  assert.deepEqual(
    first.ok && first.data.events,
    replay.ok && replay.data.events,
  );
  if (!first.ok) return;
  assert.equal(first.data.events.length, 2);
  assert.equal(first.data.events[1].providerBookingStatus, "CONFIRMED");
  assert.equal(first.data.events[1].location, null);
  assert.equal(first.data.paymentStatus, "NOT_REQUIRED");
});

test("REJECT becomes a valid commercial status with one stable terminal event", async () => {
  const input: BookFreightInput = {
    ...assistedInput,
    provider_offer_reference: "GEN-OFF-REJECT",
    idempotency_key: "cm:booking:reject:v1",
  };
  const { storage, result: booked } = await bookOnce({ input });
  createProviderFixtureController(
    provider.service.providerServiceCode,
    storage,
  ).setNextResponse(booked.providerReference, "REJECT");

  const result = await execute<ProviderBookingStatusResult>(
    createGetProviderBookingStatusTool(provider, { storage }),
    { provider_reference: booked.providerReference },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.providerBookingStatus, "REJECTED");
  assert.match(result.data.providerStatusReason ?? "", /rechazó/i);
  assert.equal(result.data.events.at(-1)?.providerBookingStatus, "REJECTED");

  const replacement = await execute<ProviderBookFreightResult>(
    createBookFreightTool(provider, { storage }),
    {
      ...input,
      idempotency_key: "cm:booking:reject:v2",
    },
  );
  assert.equal(replacement.ok, true);
});

test("NO_RESPONSE is consumed while provider status remains pending", async () => {
  const input: BookFreightInput = {
    ...assistedInput,
    provider_offer_reference: "GEN-OFF-NO-RESPONSE",
    idempotency_key: "cm:booking:no-response:v1",
  };
  const { storage, result: booked } = await bookOnce({ input });
  const controller = createProviderFixtureController(
    provider.service.providerServiceCode,
    storage,
  );
  const statusTool = createGetProviderBookingStatusTool(provider, { storage });
  controller.setNextResponse(booked.providerReference, "NO_RESPONSE");

  const pending = await execute<ProviderBookingStatusResult>(statusTool, {
    provider_reference: booked.providerReference,
  });
  assert.equal(
    pending.ok && pending.data.providerBookingStatus,
    "PENDING_PROVIDER_CONFIRMATION",
  );
  assert.equal(pending.ok && pending.data.events.length, 1);

  controller.setNextResponse(booked.providerReference, "ACCEPT");
  const confirmed = await execute<ProviderBookingStatusResult>(statusTool, {
    provider_reference: booked.providerReference,
  });
  assert.equal(confirmed.ok && confirmed.data.providerBookingStatus, "CONFIRMED");
});

test("booking and status tools honor an in-flight AbortSignal", async () => {
  const storage = createInMemoryProviderBookingStorage();
  const cases: Array<[WebMCP.ModelContextTool, Record<string, unknown>]> = [
    [
      createBookFreightTool(provider, { storage }),
      assistedInput as unknown as Record<string, unknown>,
    ],
    [
      createGetProviderBookingStatusTool(provider, { storage }),
      { provider_reference: "UNKNOWN" },
    ],
  ];

  for (const [tool, input] of cases) {
    const controller = new AbortController();
    const execution = Promise.resolve(
      tool.execute(input, { signal: controller.signal }),
    );
    controller.abort();

    await assert.rejects(execution, (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError",
    );
  }
});
