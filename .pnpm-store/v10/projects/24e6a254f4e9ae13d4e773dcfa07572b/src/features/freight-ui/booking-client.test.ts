import assert from "node:assert/strict";
import test from "node:test";
import type { BookingViewModel, PreparedBookingAuthorization } from "@/features/booking/contracts";
import type { ProviderNavigationAdapter } from "@/features/webmcp-runner";
import {
  readBookingRuntimeContext,
  recoveryOffersFor,
  refreshProviderBookingStatus,
  shouldPollProviderBooking,
  startAssistedBooking,
  startAssistedRecovery,
} from "./booking-client";
import { getDispatchFixture } from "./ui-fixtures";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function successModel() {
  const model = getDispatchFixture("three", "FR-1042");
  if (model.status !== "success") assert.fail("Expected success fixture.");
  return model;
}

function prepared(model: ReturnType<typeof successModel>): PreparedBookingAuthorization {
  const offer = model.offers[1];
  return {
    authorizationReference: "a0000000-0000-0000-0000-000000000001",
    freightDecisionId: "f0000000-0000-0000-0000-000000000001",
    freightRequestId: model.freightRequestId,
    offerId: offer.offerId,
    carrierId: offer.carrierId,
    matchingServiceId: offer.matchingServiceId,
    providerOfferReference: offer.providerOfferReference,
    authorizationContext: {
      authorizationReference: "a0000000-0000-0000-0000-000000000001",
      authorizedBy: "HUMAN_SELECTION",
    },
    selectionMode: "ASSISTED",
    bookingIdempotencyKey: "server-preserved-key",
    expiresAt: "2026-09-01T12:00:00.000Z",
    deduplicated: false,
  };
}

function bookingViewModel(overrides: Partial<BookingViewModel> = {}): BookingViewModel {
  return {
    schemaVersion: "1.0",
    bookingId: "a0000000-0000-0000-0000-000000000099",
    freightRequestId: "f2000000-0000-0000-0000-000000000001",
    offerId: "offer-demo-2",
    carrierId: "carrier-demo-2",
    providerReference: "INCA-BOOK-1",
    status: "PENDING_PROVIDER_CONFIRMATION",
    providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
    providerResponseDeadline: "2026-09-01T12:15:00.000Z",
    paymentStatus: "NOT_REQUIRED",
    paymentUrl: null,
    selectionMode: "ASSISTED",
    canRecover: false,
    recoveryOfferIds: [],
    events: [],
    ...overrides,
  };
}

test("prepares ASSISTED selection, executes book_freight through the navigation runtime and persists it", async () => {
  const model = successModel();
  const offer = model.offers[1];
  const storage = new MemoryStorage();
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];
  const boundSnapshots: unknown[] = [];
  const navigationUrls: string[] = [];
  const authorization = prepared(model);
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    requests.push({ path, body });
    const data = path === "/api/bookings/prepare"
      ? authorization
      : { bookingId: "a0000000-0000-0000-0000-000000000099", status: "INSERTED", deduplicated: false };
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const createNavigation = (): ProviderNavigationAdapter => ({
    bindRegisteredCandidates(candidates) { boundSnapshots.push(candidates); },
    async open(navigationUrl) {
      navigationUrls.push(navigationUrl);
      return {
        runtime: {
          async getToolNames() { return ["book_freight", "get_provider_booking_status"]; },
          async executeTool(name, input) {
            toolCalls.push({ name, input });
            return {
              ok: true,
              data: {
                schemaVersion: "1.0",
                freightRequestId: authorization.freightRequestId,
                providerOfferReference: authorization.providerOfferReference,
                providerReference: "INCA-BOOK-1",
                providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
                providerResponseDeadline: "2026-09-01T12:15:00.000Z",
                paymentRequired: false,
                paymentUrl: null,
                idempotentReplay: false,
              },
            };
          },
        },
        async leaveAndGetActiveToolNames() { return []; },
      };
    },
  });

  const context = await startAssistedBooking({
    model,
    offer,
    frame: {} as HTMLIFrameElement,
    baseUrl: "http://localhost:3000",
  }, { fetcher: fetcher as typeof fetch, storage, randomUUID: () => "random-1", createNavigation });

  assert.equal((requests[0].body as { selectionMode: string }).selectionMode, "ASSISTED");
  assert.equal(requests[0].path, "/api/bookings/prepare");
  assert.equal(requests[1].path, "/api/bookings/record-provider");
  assert.equal(toolCalls[0].name, "book_freight");
  assert.equal((toolCalls[0].input.authorization_context as { authorized_by: string }).authorized_by, "HUMAN_SELECTION");
  assert.equal(boundSnapshots.length, 1);
  assert.match(navigationUrls[0], /serviceId=service-demo-2/);
  assert.equal(context.bookingId, "a0000000-0000-0000-0000-000000000099");
  assert.equal(context.runtimeEvidence?.navigation[0].discoveredToolNames.includes("book_freight"), true);
  assert.equal(context.runtimeEvidence?.navigation[0].cleanupToolNames.length, 0);
  assert.equal(context.runtimeEvidence?.tools[0].toolName, "book_freight");
  assert.equal(context.runtimeEvidence?.tools[0].executionSurface, "document.modelContext");
  assert.equal(context.runtimeEvidence?.tools[0].toolInput.idempotency_key, undefined);
  assert.equal(context.runtimeEvidence?.tools[0].toolInput.idempotency_key_present, true);
  assert.equal(readBookingRuntimeContext(context.bookingId, storage)?.runtimeEvidence?.tools.length, 1);
});

test("reuses the same selection idempotency key for an assisted replay", async () => {
  const model = successModel();
  const offer = model.offers[1];
  const authorization = prepared(model);
  const storage = new MemoryStorage();
  const prepareKeys: string[] = [];
  const prepareResults: PreparedBookingAuthorization[] = [];
  const providerResults: Array<{ idempotentReplay: boolean }> = [];
  const bridgePayloads: Record<string, unknown>[] = [];
  const bridgeResponses: Array<{ httpStatus: number; status: string }> = [];
  const persisted = {
    bookings: new Set<string>(),
    events: new Set<string>(),
    decisions: new Set<string>(),
  };
  const writeAttempts = { bookings: 0, events: 0, decisions: 0 };
  let randomCalls = 0;
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (path === "/api/bookings/prepare") {
      prepareKeys.push(String(body.bookingIdempotencyKey));
      const result = {
        ...authorization,
        bookingIdempotencyKey: body.bookingIdempotencyKey as string,
        deduplicated: prepareKeys.length > 1,
      };
      prepareResults.push(result);
      return new Response(JSON.stringify({ ok: true, data: result }), { status: 200 });
    }

    bridgePayloads.push(body);
    const replay = bridgePayloads.length > 1;
    if (!replay) {
      writeAttempts.bookings += 1;
      writeAttempts.events += 1;
      writeAttempts.decisions += 1;
      persisted.bookings.add("a0000000-0000-0000-0000-000000000099");
      persisted.events.add("booking-created");
      persisted.decisions.add(authorization.freightDecisionId);
    }
    const result = {
      bookingId: "a0000000-0000-0000-0000-000000000099",
      status: replay ? "DEDUPLICATED" : "INSERTED",
      deduplicated: replay,
    };
    bridgeResponses.push({ httpStatus: 200, status: result.status });
    return new Response(JSON.stringify({ ok: true, data: result }), { status: 200 });
  };
  const createNavigation = (): ProviderNavigationAdapter => ({
    bindRegisteredCandidates() {},
    async open() {
      return {
        runtime: {
          async getToolNames() { return ["book_freight"]; },
          async executeTool() {
            const data = {
              schemaVersion: "1.0",
              freightRequestId: authorization.freightRequestId,
              providerOfferReference: authorization.providerOfferReference,
              providerReference: "INCA-BOOK-1",
              providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
              providerResponseDeadline: "2026-09-01T12:15:00.000Z",
              paymentRequired: false,
              paymentUrl: null,
              idempotentReplay: prepareKeys.length > 1,
            } as const;
            providerResults.push(data);
            return { ok: true, data };
          },
        },
        async leaveAndGetActiveToolNames() { return []; },
      };
    },
  });
  const options = { fetcher: fetcher as typeof fetch, storage, randomUUID: () => `random-${++randomCalls}`, createNavigation };

  const first = await startAssistedBooking({ model, offer, frame: {} as HTMLIFrameElement, baseUrl: "http://localhost:3000" }, options);
  const replay = await startAssistedBooking({ model, offer, frame: {} as HTMLIFrameElement, baseUrl: "http://localhost:3000" }, options);

  assert.equal(prepareKeys.length, 2);
  assert.equal(prepareKeys[0], prepareKeys[1]);
  assert.equal(prepareResults[1].deduplicated, true);
  assert.equal(first.bookingId, replay.bookingId);
  assert.equal(providerResults[0].idempotentReplay, false);
  assert.equal(providerResults[1].idempotentReplay, true);
  assert.equal(bridgeResponses[1].httpStatus, 200);
  assert.equal(bridgeResponses[1].status, "DEDUPLICATED");
  assert.equal(bridgePayloads[0].bridgeCallId, `cm:booking:v1:${authorization.authorizationReference}:initial`);
  assert.equal(bridgePayloads[1].bridgeCallId, `cm:booking:v1:${authorization.authorizationReference}:provider-replay`);
  assert.notEqual(bridgePayloads[0].bridgeCallId, bridgePayloads[1].bridgeCallId);
  assert.deepEqual({
    bookings: persisted.bookings.size,
    events: persisted.events.size,
    decisions: persisted.decisions.size,
  }, { bookings: 1, events: 1, decisions: 1 });
  assert.deepEqual({
    bookings: writeAttempts.bookings - persisted.bookings.size,
    events: writeAttempts.events - persisted.events.size,
    decisions: writeAttempts.decisions - persisted.decisions.size,
  }, { bookings: 0, events: 0, decisions: 0 });
  assert.equal(randomCalls, 1);
});

test("executes provider status through WebMCP and records a deterministic replay identity", async () => {
  const model = successModel();
  const offer = model.offers[1];
  const context = {
    bookingId: "a0000000-0000-0000-0000-000000000099",
    authorizationReference: "a0000000-0000-0000-0000-000000000001",
    freightRequestId: model.freightRequestId,
    requestCode: model.requestCode,
    offerId: offer.offerId,
    carrierId: offer.carrierId,
    matchingServiceId: offer.matchingServiceId,
    providerUrl: model.attempts[1].providerUrl,
    navigationUrl: `http://localhost:3000/providers/inca?serviceId=${offer.matchingServiceId}`,
    providerReference: "INCA-BOOK-1",
    selectedOffer: offer,
    offers: model.offers,
    candidates: model.attempts,
    dispatchHref: "/dispatch/run-fixture-three",
  };
  const payloads: Record<string, unknown>[] = [];
  const storage = new MemoryStorage();
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ ok: true, data: { bookingId: context.bookingId, status: "INSERTED", deduplicated: false } }));
  };
  const createNavigation = (): ProviderNavigationAdapter => ({
    bindRegisteredCandidates() {},
    async open() {
      return {
        runtime: {
          async getToolNames() { return ["get_provider_booking_status"]; },
          async executeTool() {
            return { ok: true, data: { schemaVersion: "1.0", providerReference: "INCA-BOOK-1", providerBookingStatus: "CONFIRMED", events: [] } };
          },
        },
        async leaveAndGetActiveToolNames() { return []; },
      };
    },
  });

  const first = await refreshProviderBookingStatus(context, {} as HTMLIFrameElement, "http://localhost:3000", { fetcher: fetcher as typeof fetch, createNavigation, storage });
  const second = await refreshProviderBookingStatus(first.context, {} as HTMLIFrameElement, "http://localhost:3000", { fetcher: fetcher as typeof fetch, createNavigation, storage });

  assert.equal(payloads[0].toolName, "get_provider_booking_status");
  assert.equal(payloads[0].bridgeCallId, payloads[1].bridgeCallId);
  assert.equal(second.context.runtimeEvidence?.navigation.length, 2);
  assert.equal(second.context.runtimeEvidence?.tools.length, 2);
  assert.equal(second.context.runtimeEvidence?.tools[0].toolName, "get_provider_booking_status");
  assert.equal(second.context.runtimeEvidence?.tools[0].executionSurface, "document.modelContext");
  assert.equal(readBookingRuntimeContext(context.bookingId, storage)?.runtimeEvidence?.tools.length, 2);
});

test("polls only pending bookings and exposes only server-authorized recovery offers", () => {
  const model = successModel();
  const context = {
    bookingId: "a0000000-0000-0000-0000-000000000099",
    authorizationReference: "a0000000-0000-0000-0000-000000000001",
    freightRequestId: model.freightRequestId,
    requestCode: model.requestCode,
    offerId: model.offers[0].offerId,
    carrierId: model.offers[0].carrierId,
    matchingServiceId: model.offers[0].matchingServiceId,
    providerUrl: model.attempts[0].providerUrl,
    navigationUrl: "http://localhost:3000/providers/andes",
    providerReference: "ANDES-BOOK-1",
    selectedOffer: model.offers[0],
    offers: model.offers,
    candidates: model.attempts,
    dispatchHref: "/dispatch/run-fixture-three",
  };
  const pending = bookingViewModel();
  const rejected = bookingViewModel({ status: "REJECTED", providerBookingStatus: "REJECTED", canRecover: true, recoveryOfferIds: [model.offers[2].offerId] });

  assert.equal(shouldPollProviderBooking(pending), true);
  assert.equal(shouldPollProviderBooking(rejected), false);
  assert.deepEqual(recoveryOffersFor(rejected, context).map((offer) => offer.offerId), [model.offers[2].offerId]);
});

test("rejects recovery before any API or WebMCP call when recoveryOfferIds does not authorize the offer", async () => {
  const model = successModel();
  const context = {
    bookingId: "a0000000-0000-0000-0000-000000000099",
    authorizationReference: "a0000000-0000-0000-0000-000000000001",
    freightRequestId: model.freightRequestId,
    requestCode: model.requestCode,
    offerId: model.offers[0].offerId,
    carrierId: model.offers[0].carrierId,
    matchingServiceId: model.offers[0].matchingServiceId,
    providerUrl: model.attempts[0].providerUrl,
    navigationUrl: "http://localhost:3000/providers/andes",
    providerReference: "ANDES-BOOK-1",
    selectedOffer: model.offers[0],
    offers: model.offers,
    candidates: model.attempts,
    dispatchHref: "/dispatch/run-fixture-three",
  };
  let fetchCalls = 0;

  await assert.rejects(
    startAssistedRecovery({
      context,
      offerId: model.offers[1].offerId,
      allowedOfferIds: [],
      replacesBookingId: context.bookingId,
      frame: {} as HTMLIFrameElement,
      baseUrl: "http://localhost:3000",
    }, { fetcher: (async () => { fetchCalls += 1; return new Response(); }) as typeof fetch, storage: new MemoryStorage() }),
    /recoveryOfferIds/,
  );
  assert.equal(fetchCalls, 0);
});
