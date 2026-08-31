import type {
  BookingBridgePersistenceResult,
  BookingViewModel,
  PreparedBookingAuthorization,
  ProviderBookFreightResult,
} from "@/features/booking/contracts";
import { buildProviderNavigationUrl } from "@/features/discovery/provider-navigation";
import type { OrchestrationViewModel, RankedOfferView } from "@/features/orchestration/contracts";
import type { CandidateProvider } from "@/features/providers/contracts";
import {
  createExternalProviderNavigationAdapter,
  type ProviderNavigationAdapter,
} from "@/features/webmcp-runner";

const BOOKING_CONTEXT_PREFIX = "cargomesh:b03:booking-context:";
const BOOKING_KEY_PREFIX = "cargomesh:b03:idempotency:";
const BOOKING_TOOL_NAMES = ["book_freight", "get_provider_booking_status"] as const;

type BookingToolName = (typeof BOOKING_TOOL_NAMES)[number];
type Fetcher = typeof fetch;

type BookingRuntime = {
  getToolNames(): Promise<string[]>;
  executeTool(
    toolName: BookingToolName,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown>;
};

export type BookingRuntimeContext = {
  bookingId: string;
  authorizationReference: string;
  freightRequestId: string;
  requestCode: string;
  offerId: string;
  carrierId: string;
  matchingServiceId: string;
  providerUrl: string;
  navigationUrl: string;
  providerReference: string;
  selectedOffer: RankedOfferView;
  offers: RankedOfferView[];
  candidates: CandidateProvider[];
  dispatchHref: string;
  runtimeEvidence?: BookingRuntimeEvidence;
};

export type BookingRuntimeEvidence = {
  navigation: Array<{
    providerUrl: string;
    navigationUrl: string;
    carrierId: string;
    matchingServiceId: string;
    openedAt: string;
    discoveredToolNames: string[];
    cleanupUrl: string;
    cleanupToolNames: string[];
    leftAt: string;
  }>;
  tools: Array<{
    toolName: BookingToolName;
    executionSurface: "document.modelContext";
    executedAt: string;
    toolInput: Record<string, unknown>;
    toolOutput: unknown;
    bridgeResult: BookingBridgePersistenceResult;
  }>;
};

export type BookingStatusRefreshResult = {
  persistence: BookingBridgePersistenceResult;
  context: BookingRuntimeContext;
};

type BookingFlowDependencies = {
  fetcher?: Fetcher;
  storage?: Storage;
  randomUUID?: () => string;
  now?: () => string;
  createNavigation?: (frame: HTMLIFrameElement, baseUrl: string) => ProviderNavigationAdapter;
};

type StartBookingInput = {
  model: Extract<OrchestrationViewModel, { status: "success" }>;
  offer: RankedOfferView;
  frame: HTMLIFrameElement;
  baseUrl: string;
};

type StartRecoveryInput = {
  context: BookingRuntimeContext;
  offerId: string;
  allowedOfferIds: readonly string[];
  replacesBookingId: string;
  frame: HTMLIFrameElement;
  baseUrl: string;
};

export async function startAssistedBooking(
  input: StartBookingInput,
  dependencies: BookingFlowDependencies = {},
): Promise<BookingRuntimeContext> {
  const candidates = input.model.attempts.map(toCandidate);
  const candidate = findExactCandidate(candidates, input.offer);
  const storage = dependencies.storage ?? sessionStorage;
  const bookingIdempotencyKey = getOrCreateBookingIdempotencyKey(
    `initial:${input.model.freightRequestId}:${input.offer.offerId}`,
    storage,
    dependencies.randomUUID,
  );
  const authorization = await postEnvelope<PreparedBookingAuthorization>(
    "/api/bookings/prepare",
    {
      freightRequestId: input.model.freightRequestId,
      offerId: input.offer.offerId,
      selectionMode: "ASSISTED",
      bookingIdempotencyKey,
    },
    dependencies.fetcher,
  );

  assertAuthorizationMatches(authorization, input.offer, candidate);
  return executePreparedBooking({
    authorization,
    candidate,
    selectedOffer: input.offer,
    offers: input.model.offers,
    candidates,
    requestCode: input.model.requestCode,
    dispatchHref: `/dispatch/${encodeURIComponent(input.model.runId)}`,
    frame: input.frame,
    baseUrl: input.baseUrl,
  }, dependencies);
}

export async function startAssistedRecovery(
  input: StartRecoveryInput,
  dependencies: BookingFlowDependencies = {},
): Promise<BookingRuntimeContext> {
  if (!input.allowedOfferIds.includes(input.offerId)) {
    throw new Error("La oferta no está autorizada por recoveryOfferIds.");
  }
  const offer = input.context.offers.find((item) => item.offerId === input.offerId);
  if (!offer) throw new Error("La oferta de recuperación no pertenece al snapshot visual disponible.");
  const candidate = findExactCandidate(input.context.candidates, offer);
  const storage = dependencies.storage ?? sessionStorage;
  const bookingIdempotencyKey = getOrCreateBookingIdempotencyKey(
    `recovery:${input.replacesBookingId}:${offer.offerId}`,
    storage,
    dependencies.randomUUID,
  );
  const authorization = await postEnvelope<PreparedBookingAuthorization>(
    "/api/bookings/recover",
    {
      freightRequestId: input.context.freightRequestId,
      offerId: offer.offerId,
      selectionMode: "ASSISTED",
      bookingIdempotencyKey,
      replacesBookingId: input.replacesBookingId,
    },
    dependencies.fetcher,
  );

  assertAuthorizationMatches(authorization, offer, candidate);
  return executePreparedBooking({
    authorization,
    candidate,
    selectedOffer: offer,
    offers: input.context.offers,
    candidates: input.context.candidates,
    requestCode: input.context.requestCode,
    dispatchHref: input.context.dispatchHref,
    frame: input.frame,
    baseUrl: input.baseUrl,
  }, dependencies);
}

export async function refreshProviderBookingStatus(
  context: BookingRuntimeContext,
  frame: HTMLIFrameElement,
  baseUrl: string,
  dependencies: BookingFlowDependencies = {},
): Promise<BookingStatusRefreshResult> {
  const candidate = context.candidates.find(
    (item) => item.carrierId === context.carrierId
      && item.matchingServiceId === context.matchingServiceId
      && item.providerUrl === context.providerUrl,
  );
  if (!candidate) throw new Error("El provider de la reserva no pertenece al snapshot registrado.");
  const navigation = createNavigation(frame, baseUrl, dependencies);
  await navigation.bindRegisteredCandidates?.(context.candidates);
  const session = await navigation.open(context.navigationUrl, candidate);
  const runtime = session.runtime as unknown as BookingRuntime;
  const controller = new AbortController();
  const openedAt = timestamp(dependencies);
  const cleanupUrl = new URL("/", baseUrl).toString();
  let discoveredToolNames: string[] = [];
  let toolInput: Record<string, unknown> = {};
  let toolOutput: unknown;
  let executedAt = openedAt;
  let persistence: BookingBridgePersistenceResult | null = null;
  let cleanupToolNames: string[] = [];

  try {
    discoveredToolNames = await requireBookingTool(runtime, "get_provider_booking_status");
    toolInput = { provider_reference: context.providerReference };
    executedAt = timestamp(dependencies);
    toolOutput = await runtime.executeTool(
      "get_provider_booking_status",
      toolInput,
      controller.signal,
    );
    persistence = await postEnvelope<BookingBridgePersistenceResult>(
      "/api/bookings/record-status",
      {
        bridgeCallId: createStatusBridgeCallId(context.bookingId, toolOutput),
        authorizationReference: context.authorizationReference,
        bookingId: context.bookingId,
        freightRequestId: context.freightRequestId,
        offerId: context.offerId,
        carrierId: context.carrierId,
        matchingServiceId: context.matchingServiceId,
        providerUrl: context.providerUrl,
        navigationUrl: context.navigationUrl,
        toolName: "get_provider_booking_status",
        toolInput,
        toolOutput,
      },
      dependencies.fetcher,
    );
  } finally {
    cleanupToolNames = await session.leaveAndGetActiveToolNames(cleanupUrl);
    assertBookingCleanup(cleanupToolNames);
  }

  if (!persistence) throw new Error("El Result Bridge no devolvió evidencia de estado.");
  const nextContext = appendRuntimeEvidence(context, {
    navigation: navigationEvidence({
      candidate,
      navigationUrl: context.navigationUrl,
      openedAt,
      discoveredToolNames,
      cleanupUrl,
      cleanupToolNames,
      leftAt: timestamp(dependencies),
    }),
    tool: {
      toolName: "get_provider_booking_status",
      executionSurface: "document.modelContext",
      executedAt,
      toolInput,
      toolOutput,
      bridgeResult: persistence,
    },
  });
  cacheBookingRuntimeContext(nextContext, dependencies.storage);
  return { persistence, context: nextContext };
}

export async function fetchBookingViewModel(
  bookingId: string,
  fetcher: Fetcher = fetch,
): Promise<BookingViewModel> {
  const response = await fetcher(`/api/bookings/${encodeURIComponent(bookingId)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload: unknown = await response.json();
  if (!response.ok || !isEnvelope(payload) || payload.ok !== true) {
    throw new Error(readEnvelopeError(payload) ?? "No fue posible consultar la reserva.");
  }
  return payload.data as BookingViewModel;
}

export function shouldPollProviderBooking(model: BookingViewModel) {
  return model.status === "PENDING_PROVIDER_CONFIRMATION";
}

export function recoveryOffersFor(
  model: BookingViewModel,
  context: BookingRuntimeContext | null,
) {
  if (!model.canRecover || !context) return [];
  const allowed = new Set(model.recoveryOfferIds);
  return context.offers.filter((offer) => allowed.has(offer.offerId));
}

export function cacheBookingRuntimeContext(context: BookingRuntimeContext, storage: Storage = sessionStorage) {
  storage.setItem(`${BOOKING_CONTEXT_PREFIX}${context.bookingId}`, JSON.stringify(context));
}

export function readBookingRuntimeContext(bookingId: string, storage: Storage = sessionStorage): BookingRuntimeContext | null {
  try {
    const value = storage.getItem(`${BOOKING_CONTEXT_PREFIX}${bookingId}`);
    if (!value) return null;
    const context = JSON.parse(value) as BookingRuntimeContext;
    return { ...context, runtimeEvidence: normalizeRuntimeEvidence(context.runtimeEvidence) };
  } catch {
    return null;
  }
}

async function executePreparedBooking(
  input: {
    authorization: PreparedBookingAuthorization;
    candidate: CandidateProvider;
    selectedOffer: RankedOfferView;
    offers: RankedOfferView[];
    candidates: CandidateProvider[];
    requestCode: string;
    dispatchHref: string;
    frame: HTMLIFrameElement;
    baseUrl: string;
  },
  dependencies: BookingFlowDependencies,
) {
  const navigationUrl = buildProviderNavigationUrl(input.candidate, input.baseUrl);
  const navigation = createNavigation(input.frame, input.baseUrl, dependencies);
  await navigation.bindRegisteredCandidates?.(input.candidates);
  const session = await navigation.open(navigationUrl, input.candidate);
  const runtime = session.runtime as unknown as BookingRuntime;
  const controller = new AbortController();
  const openedAt = timestamp(dependencies);
  const cleanupUrl = new URL("/", input.baseUrl).toString();
  let discoveredToolNames: string[] = [];
  let toolInput: Record<string, unknown> = {};
  let toolOutput: unknown;
  let executedAt = openedAt;
  let persistence: BookingBridgePersistenceResult | null = null;
  let cleanupToolNames: string[] = [];

  try {
    discoveredToolNames = await requireBookingTool(runtime, "book_freight");
    toolInput = {
      freight_request_id: input.authorization.freightRequestId,
      provider_offer_reference: input.authorization.providerOfferReference,
      idempotency_key: input.authorization.bookingIdempotencyKey,
      authorization_context: {
        authorization_reference: input.authorization.authorizationContext.authorizationReference,
        authorized_by: input.authorization.authorizationContext.authorizedBy,
      },
      selection_mode: input.authorization.selectionMode,
    };
    executedAt = timestamp(dependencies);
    toolOutput = await runtime.executeTool("book_freight", toolInput, controller.signal);
    persistence = await postEnvelope<BookingBridgePersistenceResult>(
      "/api/bookings/record-provider",
      {
        bridgeCallId: `cm:booking:v1:${input.authorization.authorizationReference}`,
        authorizationReference: input.authorization.authorizationReference,
        freightRequestId: input.authorization.freightRequestId,
        offerId: input.authorization.offerId,
        carrierId: input.authorization.carrierId,
        matchingServiceId: input.authorization.matchingServiceId,
        providerUrl: input.candidate.providerUrl,
        navigationUrl,
        toolName: "book_freight",
        toolInput,
        toolOutput,
      },
      dependencies.fetcher,
    );
  } finally {
    cleanupToolNames = await session.leaveAndGetActiveToolNames(cleanupUrl);
    assertBookingCleanup(cleanupToolNames);
  }

  if (!persistence) throw new Error("El Result Bridge no devolvió evidencia de booking.");
  const providerReference = readProviderReference(toolOutput);
  const context: BookingRuntimeContext = {
    bookingId: persistence.bookingId,
    authorizationReference: input.authorization.authorizationReference,
    freightRequestId: input.authorization.freightRequestId,
    requestCode: input.requestCode,
    offerId: input.authorization.offerId,
    carrierId: input.authorization.carrierId,
    matchingServiceId: input.authorization.matchingServiceId,
    providerUrl: input.candidate.providerUrl,
    navigationUrl,
    providerReference,
    selectedOffer: input.selectedOffer,
    offers: input.offers,
    candidates: input.candidates,
    dispatchHref: input.dispatchHref,
    runtimeEvidence: {
      navigation: [navigationEvidence({
        candidate: input.candidate,
        navigationUrl,
        openedAt,
        discoveredToolNames,
        cleanupUrl,
        cleanupToolNames,
        leftAt: timestamp(dependencies),
      })],
      tools: [{
        toolName: "book_freight",
        executionSurface: "document.modelContext",
        executedAt,
        toolInput: redactBookingToolInput(toolInput),
        toolOutput,
        bridgeResult: persistence,
      }],
    },
  };
  cacheBookingRuntimeContext(context, dependencies.storage);
  return context;
}

function createNavigation(
  frame: HTMLIFrameElement,
  baseUrl: string,
  dependencies: BookingFlowDependencies,
) {
  return dependencies.createNavigation
    ? dependencies.createNavigation(frame, baseUrl)
    : createExternalProviderNavigationAdapter({ frame, baseUrl });
}

async function requireBookingTool(runtime: BookingRuntime, toolName: BookingToolName) {
  const names = await runtime.getToolNames();
  if (!names.includes(toolName)) {
    throw new Error(`WEBMCP_TOOL_MISSING: ${toolName} no está disponible en el provider registrado.`);
  }
  return names;
}

function appendRuntimeEvidence(
  context: BookingRuntimeContext,
  evidence: {
    navigation: BookingRuntimeEvidence["navigation"][number];
    tool: BookingRuntimeEvidence["tools"][number];
  },
): BookingRuntimeContext {
  const current = normalizeRuntimeEvidence(context.runtimeEvidence);
  return {
    ...context,
    runtimeEvidence: {
      navigation: [...current.navigation, evidence.navigation],
      tools: [...current.tools, evidence.tool],
    },
  };
}

function normalizeRuntimeEvidence(value: BookingRuntimeEvidence | undefined): BookingRuntimeEvidence {
  return value ?? { navigation: [], tools: [] };
}

function navigationEvidence(input: {
  candidate: CandidateProvider;
  navigationUrl: string;
  openedAt: string;
  discoveredToolNames: string[];
  cleanupUrl: string;
  cleanupToolNames: string[];
  leftAt: string;
}): BookingRuntimeEvidence["navigation"][number] {
  return {
    providerUrl: input.candidate.providerUrl,
    navigationUrl: input.navigationUrl,
    carrierId: input.candidate.carrierId,
    matchingServiceId: input.candidate.matchingServiceId,
    openedAt: input.openedAt,
    discoveredToolNames: [...input.discoveredToolNames],
    cleanupUrl: input.cleanupUrl,
    cleanupToolNames: [...input.cleanupToolNames],
    leftAt: input.leftAt,
  };
}

function redactBookingToolInput(input: Record<string, unknown>) {
  const { idempotency_key: idempotencyKey, ...visible } = input;
  return { ...visible, idempotency_key_present: typeof idempotencyKey === "string" && idempotencyKey.length > 0 };
}

function timestamp(dependencies: BookingFlowDependencies) {
  return dependencies.now?.() ?? new Date().toISOString();
}

function assertBookingCleanup(activeTools: string[]) {
  const survivors = activeTools.filter((name) => BOOKING_TOOL_NAMES.includes(name as BookingToolName));
  if (survivors.length) throw new Error(`WEBMCP_CLEANUP_FAILED: ${survivors.join(", ")} continúa activa.`);
}

function assertAuthorizationMatches(
  authorization: PreparedBookingAuthorization,
  offer: RankedOfferView,
  candidate: CandidateProvider,
) {
  if (
    authorization.offerId !== offer.offerId
    || authorization.carrierId !== offer.carrierId
    || authorization.carrierId !== candidate.carrierId
    || authorization.matchingServiceId !== candidate.matchingServiceId
    || authorization.selectionMode !== "ASSISTED"
    || authorization.authorizationContext.authorizedBy !== "HUMAN_SELECTION"
  ) {
    throw new Error("La autorización server-side no coincide con la selección humana.");
  }
}

function findExactCandidate(candidates: CandidateProvider[], offer: RankedOfferView) {
  const candidate = candidates.find(
    (item) => item.carrierId === offer.carrierId && item.matchingServiceId === offer.matchingServiceId,
  );
  if (!candidate) throw new Error("La oferta no tiene un provider registrado con matchingServiceId exacto.");
  return candidate;
}

function toCandidate(value: CandidateProvider): CandidateProvider {
  return {
    carrierId: value.carrierId,
    carrierCode: value.carrierCode,
    displayName: value.displayName,
    providerUrl: value.providerUrl,
    matchingServiceId: value.matchingServiceId,
  };
}

function getOrCreateBookingIdempotencyKey(
  identity: string,
  storage: Storage,
  randomUUID: (() => string) | undefined,
) {
  const storageKey = `${BOOKING_KEY_PREFIX}${identity}`;
  const existing = storage.getItem(storageKey);
  if (existing) return existing;
  const value = `cm:b03:${identity}:${(randomUUID ?? (() => crypto.randomUUID()))()}`;
  storage.setItem(storageKey, value);
  return value;
}

function createStatusBridgeCallId(bookingId: string, toolOutput: unknown) {
  const serialized = JSON.stringify(toolOutput);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cm:booking-status:v1:${bookingId}:${(hash >>> 0).toString(16)}`;
}

function readProviderReference(value: unknown) {
  if (!isEnvelope(value) || value.ok !== true || !isRecord(value.data)) {
    throw new Error(readEnvelopeError(value) ?? "book_freight no devolvió una reserva válida.");
  }
  const result = value.data as Partial<ProviderBookFreightResult>;
  if (typeof result.providerReference !== "string" || !result.providerReference) {
    throw new Error("book_freight no devolvió providerReference.");
  }
  return result.providerReference;
}

async function postEnvelope<T>(path: string, body: unknown, fetcher: Fetcher = fetch): Promise<T> {
  const response = await fetcher(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  if (!response.ok || !isEnvelope(payload) || payload.ok !== true) {
    throw new Error(readEnvelopeError(payload) ?? `La operación ${path} no pudo completarse.`);
  }
  return payload.data as T;
}

function readEnvelopeError(value: unknown) {
  if (!isEnvelope(value) || value.ok !== false || !isRecord(value.error)) return null;
  return typeof value.error.message === "string" ? value.error.message : null;
}

function isEnvelope(value: unknown): value is { ok: boolean; data?: unknown; error?: unknown } {
  return isRecord(value) && typeof value.ok === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
