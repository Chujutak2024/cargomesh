import type { ProviderPageConfig, ProviderToolEnvelope } from "./contracts";
import type {
  GetProviderBookingStatusInput,
  ProviderBookingStatus,
  ProviderBookingStatusResult,
} from "./provider-booking-contracts";
import {
  createProviderEventId,
  createSessionProviderBookingStorage,
  type ProviderBookingStorage,
  type StoredProviderBooking,
} from "./provider-booking-runtime";
import {
  createProviderToolError,
  isNonEmptyProviderString,
  isProviderInputRecord,
  type ParsedProviderInput,
  waitForProviderTool,
} from "./provider-tool-runtime";

export const GET_PROVIDER_BOOKING_STATUS_TOOL_NAME =
  "get_provider_booking_status";

export const getProviderBookingStatusInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    provider_reference: { type: "string", minLength: 1 },
  },
  required: ["provider_reference"],
} as const;

function parseStatusInput(
  rawInput: unknown,
): ParsedProviderInput<GetProviderBookingStatusInput> {
  if (!isProviderInputRecord(rawInput)) {
    return { ok: false, message: "El payload debe ser un objeto JSON." };
  }
  const unknownKey = Object.keys(rawInput).find(
    (key) => key !== "provider_reference",
  );
  if (unknownKey) {
    return { ok: false, message: `El campo '${unknownKey}' no pertenece al contrato.` };
  }
  if (!isNonEmptyProviderString(rawInput.provider_reference)) {
    return { ok: false, message: "provider_reference es obligatorio." };
  }
  return {
    ok: true,
    value: { provider_reference: rawInput.provider_reference.trim() },
  };
}

function statusResult(
  booking: StoredProviderBooking,
): ProviderToolEnvelope<ProviderBookingStatusResult> {
  return {
    ok: true,
    data: {
      schemaVersion: "1.0",
      providerReference: booking.providerReference,
      providerBookingStatus: booking.providerBookingStatus,
      providerStatusReason: booking.providerStatusReason,
      currentLocation: booking.currentLocation,
      updatedEta: booking.updatedEta,
      providerResponseDeadline: booking.providerResponseDeadline,
      paymentStatus: booking.paymentStatus,
      events: booking.events,
    },
  };
}

function terminalTransition(
  booking: StoredProviderBooking,
  status: Extract<ProviderBookingStatus, "CONFIRMED" | "REJECTED">,
  occurredAt: Date,
): void {
  booking.providerBookingStatus = status;
  booking.providerStatusReason =
    status === "REJECTED"
      ? "El provider rechazó la solicitud mediante el fixture técnico."
      : null;
  const eventType = status === "CONFIRMED" ? "BOOKING_CONFIRMED" : "BOOKING_REJECTED";
  booking.events.push({
    providerEventId: createProviderEventId(booking.providerReference, eventType),
    eventType,
    providerBookingStatus: status,
    occurredAt: occurredAt.toISOString(),
    location: null,
    description:
      status === "CONFIRMED"
        ? "El provider confirmó la reserva de transporte."
        : "El provider rechazó la reserva de transporte.",
  });
}

export type GetProviderBookingStatusToolOptions = {
  storage?: ProviderBookingStorage;
  now?: () => Date;
};

export function createGetProviderBookingStatusTool(
  provider: ProviderPageConfig,
  options: GetProviderBookingStatusToolOptions = {},
): WebMCP.ModelContextTool {
  const storage = options.storage ?? createSessionProviderBookingStorage();
  const now = options.now ?? (() => new Date());

  return {
    name: GET_PROVIDER_BOOKING_STATUS_TOOL_NAME,
    title: "Get provider booking status",
    description: `Consulta el estado de una reserva del servicio ${provider.service.providerServiceCode}.`,
    inputSchema: getProviderBookingStatusInputSchema,
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false,
    },
    execute: async (rawInput, executionOptions) => {
      const signal =
        executionOptions?.signal ?? new AbortController().signal;
      const parsedInput = parseStatusInput(rawInput);
      if (!parsedInput.ok) {
        return createProviderToolError<ProviderBookingStatusResult>(
          "INVALID_INPUT",
          parsedInput.message,
        );
      }

      await waitForProviderTool(signal);
      signal.throwIfAborted();

      const serviceCode = provider.service.providerServiceCode;
      const state = storage.read(serviceCode);
      const booking =
        state.bookingsByReference[parsedInput.value.provider_reference];
      if (!booking) {
        return createProviderToolError<ProviderBookingStatusResult>(
          "BOOKING_NOT_FOUND",
          "La referencia no pertenece a una reserva de este provider.",
        );
      }

      const control = state.nextControlByReference[booking.providerReference];
      if (control) {
        delete state.nextControlByReference[booking.providerReference];
        if (control === "ACCEPT" || control === "REJECT") {
          // Freeze the status clock once for the whole transition event.
          const occurredAt = new Date(now().getTime());
          terminalTransition(
            booking,
            control === "ACCEPT" ? "CONFIRMED" : "REJECTED",
            occurredAt,
          );
          if (control === "REJECT") {
            delete state.referenceByOffer[
              booking.input.provider_offer_reference
            ];
          }
        }
        storage.write(serviceCode, state);
      }

      return statusResult(booking);
    },
  };
}
