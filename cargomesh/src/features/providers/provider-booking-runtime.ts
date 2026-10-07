import type {
  BookFreightInput,
  ProviderBookingEvent,
  ProviderBookingLocation,
  ProviderBookingStatus,
  ProviderFixtureControl,
  ProviderPaymentStatus,
} from "./provider-booking-contracts";

export type StoredProviderBooking = {
  input: BookFreightInput;
  inputFingerprint: string;
  providerReference: string;
  providerResponseDeadline: string;
  providerBookingStatus: ProviderBookingStatus;
  providerStatusReason: string | null;
  currentLocation: ProviderBookingLocation | null;
  updatedEta: string | null;
  paymentStatus: ProviderPaymentStatus;
  events: ProviderBookingEvent[];
};

export type ProviderBookingState = {
  bookingsByReference: Record<string, StoredProviderBooking>;
  referenceByIdempotencyKey: Record<string, string>;
  referenceByOffer: Record<string, string>;
  nextControlByReference: Record<string, ProviderFixtureControl>;
};

export type ProviderBookingStorage = {
  read(providerServiceCode: string): ProviderBookingState;
  write(providerServiceCode: string, state: ProviderBookingState): void;
};

export type ProviderFixtureController = {
  setNextResponse(
    providerReference: string,
    control: ProviderFixtureControl,
  ): void;
};

function emptyState(): ProviderBookingState {
  return {
    bookingsByReference: {},
    referenceByIdempotencyKey: {},
    referenceByOffer: {},
    nextControlByReference: {},
  };
}

function cloneState(state: ProviderBookingState): ProviderBookingState {
  return JSON.parse(JSON.stringify(state)) as ProviderBookingState;
}

function storageKey(providerServiceCode: string): string {
  return `cargomesh:provider-booking:v1:${encodeURIComponent(providerServiceCode)}`;
}

export function createSessionProviderBookingStorage(): ProviderBookingStorage {
  function sessionStorageOrThrow(): Storage {
    if (typeof window === "undefined" || !window.sessionStorage) {
      throw new Error(
        "PROVIDER_BOOKING_STORAGE_UNAVAILABLE: sessionStorage is required in provider runtime.",
      );
    }
    return window.sessionStorage;
  }

  return {
    read(providerServiceCode) {
      const serialized = sessionStorageOrThrow().getItem(storageKey(providerServiceCode));
      if (!serialized) return emptyState();

      try {
        return JSON.parse(serialized) as ProviderBookingState;
      } catch {
        throw new Error(
          "PROVIDER_BOOKING_STORAGE_CORRUPTED: provider session state is not valid JSON.",
        );
      }
    },
    write(providerServiceCode, state) {
      sessionStorageOrThrow().setItem(
        storageKey(providerServiceCode),
        JSON.stringify(state),
      );
    },
  };
}

export function createInMemoryProviderBookingStorage(): ProviderBookingStorage {
  const states = new Map<string, ProviderBookingState>();

  return {
    read(providerServiceCode) {
      return cloneState(states.get(providerServiceCode) ?? emptyState());
    },
    write(providerServiceCode, state) {
      states.set(providerServiceCode, cloneState(state));
    },
  };
}

export function createProviderFixtureController(
  providerServiceCode: string,
  storage: ProviderBookingStorage,
): ProviderFixtureController {
  return {
    setNextResponse(providerReference, control) {
      const state = storage.read(providerServiceCode);
      const booking = state.bookingsByReference[providerReference];
      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND: provider reference is unknown.");
      }
      if (
        booking.providerBookingStatus === "CONFIRMED" ||
        booking.providerBookingStatus === "REJECTED" ||
        booking.providerBookingStatus === "EXPIRED" ||
        booking.providerBookingStatus === "DELIVERED" ||
        booking.providerBookingStatus === "CANCELLED"
      ) {
        throw new Error(
          "BOOKING_TERMINAL: fixture controls cannot alter a terminal provider booking.",
        );
      }

      state.nextControlByReference[providerReference] = control;
      storage.write(providerServiceCode, state);
    },
  };
}

export function normalizeBookFreightInput(input: BookFreightInput): BookFreightInput {
  return {
    freight_request_id: input.freight_request_id.trim(),
    provider_offer_reference: input.provider_offer_reference.trim(),
    idempotency_key: input.idempotency_key.trim(),
    authorization_context: {
      authorization_reference:
        input.authorization_context.authorization_reference.trim(),
      authorized_by: input.authorization_context.authorized_by,
    },
    selection_mode: input.selection_mode,
  };
}

export function fingerprintBookFreightInput(input: BookFreightInput): string {
  return JSON.stringify(normalizeBookFreightInput(input));
}

export function stableProviderHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createProviderReference(
  providerServiceCode: string,
  input: BookFreightInput,
): string {
  const prefix =
    providerServiceCode.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 3) ||
    "PRV";
  const suffix = (
    stableProviderHash(
      `${providerServiceCode}:${input.provider_offer_reference}:${input.idempotency_key}`,
    ) % 100_000_000
  )
    .toString()
    .padStart(8, "0");
  return `${prefix}-BOOK-${suffix}`;
}

export function createProviderEventId(
  providerReference: string,
  eventType: string,
): string {
  return `evt-${stableProviderHash(`${providerReference}:${eventType}`)
    .toString(16)
    .padStart(8, "0")}`;
}
