import type { ProviderPageConfig, ProviderToolEnvelope } from "./contracts";
import type {
  BookFreightInput,
  ProviderBookFreightResult,
} from "./provider-booking-contracts";
import {
  createProviderEventId,
  createProviderReference,
  createSessionProviderBookingStorage,
  fingerprintBookFreightInput,
  normalizeBookFreightInput,
  type ProviderBookingStorage,
} from "./provider-booking-runtime";
import {
  createProviderToolError,
  isNonEmptyProviderString,
  isProviderInputRecord,
  type ParsedProviderInput,
  waitForProviderTool,
} from "./provider-tool-runtime";

export const BOOK_FREIGHT_TOOL_NAME = "book_freight";

export const bookFreightInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    freight_request_id: { type: "string", minLength: 1 },
    provider_offer_reference: { type: "string", minLength: 1 },
    idempotency_key: { type: "string", minLength: 1 },
    authorization_context: {
      type: "object",
      additionalProperties: false,
      properties: {
        authorization_reference: { type: "string", minLength: 1 },
        authorized_by: {
          type: "string",
          enum: ["HUMAN_SELECTION", "AUTO_BOOKING_POLICY"],
        },
      },
      required: ["authorization_reference", "authorized_by"],
    },
    selection_mode: {
      type: "string",
      enum: ["ASSISTED", "SMART_AUTO"],
    },
  },
  required: [
    "freight_request_id",
    "provider_offer_reference",
    "idempotency_key",
    "authorization_context",
    "selection_mode",
  ],
} as const;

const allowedKeys = new Set([
  "freight_request_id",
  "provider_offer_reference",
  "idempotency_key",
  "authorization_context",
  "selection_mode",
]);
const allowedAuthorizationKeys = new Set([
  "authorization_reference",
  "authorized_by",
]);

function parseBookFreightInput(
  rawInput: unknown,
): ParsedProviderInput<BookFreightInput> {
  if (!isProviderInputRecord(rawInput)) {
    return { ok: false, message: "El payload debe ser un objeto JSON." };
  }
  const unknownKey = Object.keys(rawInput).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    return { ok: false, message: `El campo '${unknownKey}' no pertenece al contrato.` };
  }

  for (const field of [
    "freight_request_id",
    "provider_offer_reference",
    "idempotency_key",
  ] as const) {
    if (!isNonEmptyProviderString(rawInput[field])) {
      return { ok: false, message: `${field} es obligatorio.` };
    }
  }

  if (!isProviderInputRecord(rawInput.authorization_context)) {
    return { ok: false, message: "authorization_context es obligatorio." };
  }
  const unknownAuthorizationKey = Object.keys(rawInput.authorization_context).find(
    (key) => !allowedAuthorizationKeys.has(key),
  );
  if (unknownAuthorizationKey) {
    return {
      ok: false,
      message: `authorization_context.${unknownAuthorizationKey} no pertenece al contrato.`,
    };
  }
  if (
    !isNonEmptyProviderString(
      rawInput.authorization_context.authorization_reference,
    )
  ) {
    return {
      ok: false,
      message: "authorization_context.authorization_reference es obligatorio.",
    };
  }

  const authorizedBy = rawInput.authorization_context.authorized_by;
  const selectionMode = rawInput.selection_mode;
  if (
    authorizedBy !== "HUMAN_SELECTION" &&
    authorizedBy !== "AUTO_BOOKING_POLICY"
  ) {
    return { ok: false, message: "authorization_context.authorized_by es inválido." };
  }
  if (selectionMode !== "ASSISTED" && selectionMode !== "SMART_AUTO") {
    return { ok: false, message: "selection_mode es inválido." };
  }
  if (
    (authorizedBy === "HUMAN_SELECTION" && selectionMode !== "ASSISTED") ||
    (authorizedBy === "AUTO_BOOKING_POLICY" && selectionMode !== "SMART_AUTO")
  ) {
    return {
      ok: false,
      message: "authorization_context no corresponde al selection_mode.",
    };
  }

  return { ok: true, value: rawInput as BookFreightInput };
}

export type BookFreightToolOptions = {
  storage?: ProviderBookingStorage;
  now?: () => Date;
};

export function createBookFreightTool(
  provider: ProviderPageConfig,
  options: BookFreightToolOptions = {},
): WebMCP.ModelContextTool {
  const storage = options.storage ?? createSessionProviderBookingStorage();
  const now = options.now ?? (() => new Date());

  return {
    name: BOOK_FREIGHT_TOOL_NAME,
    title: "Book freight",
    description: `Solicita una reserva con el servicio ${provider.service.providerServiceCode} del transportista actual.`,
    inputSchema: bookFreightInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      untrustedContentHint: false,
    },
    execute: async (rawInput, executionOptions) => {
      const signal =
        executionOptions?.signal ?? new AbortController().signal;
      const parsedInput = parseBookFreightInput(rawInput);
      if (!parsedInput.ok) {
        return createProviderToolError<ProviderBookFreightResult>(
          "INVALID_INPUT",
          parsedInput.message,
        );
      }

      await waitForProviderTool(signal);
      signal.throwIfAborted();

      const input = normalizeBookFreightInput(parsedInput.value);
      const inputFingerprint = fingerprintBookFreightInput(input);
      const serviceCode = provider.service.providerServiceCode;
      const state = storage.read(serviceCode);
      const replayReference =
        state.referenceByIdempotencyKey[input.idempotency_key];

      if (replayReference) {
        const replay = state.bookingsByReference[replayReference];
        if (!replay || replay.inputFingerprint !== inputFingerprint) {
          return createProviderToolError<ProviderBookFreightResult>(
            "IDEMPOTENCY_CONFLICT",
            "La idempotency_key ya fue utilizada con otro payload.",
          );
        }
        return {
          ok: true,
          data: {
            schemaVersion: "1.0",
            freightRequestId: replay.input.freight_request_id,
            providerOfferReference: replay.input.provider_offer_reference,
            providerReference: replay.providerReference,
            providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
            providerResponseDeadline: replay.providerResponseDeadline,
            paymentRequired: false,
            paymentUrl: null,
            idempotentReplay: true,
          },
        } satisfies ProviderToolEnvelope<ProviderBookFreightResult>;
      }

      const existingOfferReference =
        state.referenceByOffer[input.provider_offer_reference];
      if (existingOfferReference) {
        return createProviderToolError<ProviderBookFreightResult>(
          "BOOKING_ALREADY_EXISTS",
          `La oferta ya tiene una reserva provider activa: ${existingOfferReference}.`,
        );
      }

      // Freeze the provider clock once for the request and its initial event.
      const issuedAt = new Date(now().getTime());
      const providerResponseDeadline = new Date(
        issuedAt.getTime() + 15 * 60 * 1000,
      ).toISOString();
      const providerReference = createProviderReference(serviceCode, input);

      state.bookingsByReference[providerReference] = {
        input,
        inputFingerprint,
        providerReference,
        providerResponseDeadline,
        providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
        providerStatusReason: null,
        currentLocation: null,
        updatedEta: null,
        paymentStatus: "NOT_REQUIRED",
        events: [
          {
            providerEventId: createProviderEventId(
              providerReference,
              "BOOKING_REQUESTED",
            ),
            eventType: "BOOKING_REQUESTED",
            providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
            occurredAt: issuedAt.toISOString(),
            location: null,
            description: "Solicitud de reserva recibida por el provider.",
          },
        ],
      };
      state.referenceByIdempotencyKey[input.idempotency_key] = providerReference;
      state.referenceByOffer[input.provider_offer_reference] = providerReference;

      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          const defaultControl = window.sessionStorage.getItem(
            `cargomesh:provider-fixture:default-response:${serviceCode}`,
          );
          if (defaultControl === "ACCEPT" || defaultControl === "REJECT" || defaultControl === "NO_RESPONSE") {
            state.nextControlByReference[providerReference] = defaultControl;
          }
        } catch {
          // ignore sessionStorage access errors in sandboxed environments
        }
      }

      storage.write(serviceCode, state);

      return {
        ok: true,
        data: {
          schemaVersion: "1.0",
          freightRequestId: input.freight_request_id,
          providerOfferReference: input.provider_offer_reference,
          providerReference,
          providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
          providerResponseDeadline,
          paymentRequired: false,
          paymentUrl: null,
          idempotentReplay: false,
        },
      } satisfies ProviderToolEnvelope<ProviderBookFreightResult>;
    },
  };
}
