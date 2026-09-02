import type {
  DashboardSummary,
  FreightRequestListItem,
  FreightRequestStatus,
} from "@/features/freight-ui/view-models";

export type PersistedDashboardRequest = {
  id: string;
  code: string;
  organization_id: string;
  status: string;
  origin_address: string | null;
  origin_city: string;
  origin_country: string;
  destination_address: string | null;
  destination_city: string;
  destination_country: string;
  cross_border: boolean;
  cargo_description: string | null;
  cargo_entry_method: string;
  cargo_weight_kg: number;
  cargo_volume_m3: number | null;
  transport_mode: string;
  service_type: string;
  required_pickup: string;
  updated_at: string;
};

export type PersistedDashboardBooking = {
  freight_request_id: string;
  status: string;
  provider_booking_status: string;
  updated_at: string;
};

export type DashboardViewModel = {
  summary: DashboardSummary;
  requests: FreightRequestListItem[];
};

const REQUEST_STATUSES = new Set<FreightRequestStatus>([
  "DRAFT", "PENDING", "ORCHESTRATING", "AWAITING_SELECTION", "BOOKING",
  "BOOKED", "FAILED", "CANCELLED",
]);

function formatPlace(address: string | null, city: string, country: string) {
  return address ? `${address}, ${city}, ${country}` : `${city}, ${country}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("INVALID_DASHBOARD_DATA: persisted date is invalid.");
  }
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function latestBookings(bookings: PersistedDashboardBooking[]) {
  const latest = new Map<string, PersistedDashboardBooking>();
  for (const booking of bookings) {
    const current = latest.get(booking.freight_request_id);
    if (!current || Date.parse(booking.updated_at) > Date.parse(current.updated_at)) {
      latest.set(booking.freight_request_id, booking);
    }
  }
  return latest;
}

function resolveStatus(
  requestStatus: string,
  booking: PersistedDashboardBooking | undefined,
): FreightRequestStatus {
  if (booking?.status === "COMPLETED" || booking?.provider_booking_status === "DELIVERED") {
    return "COMPLETED";
  }
  if (booking?.status === "IN_TRANSIT" || booking?.provider_booking_status === "IN_TRANSIT") {
    return "IN_TRANSIT";
  }
  if (booking?.status === "CONFIRMED" || booking?.provider_booking_status === "CONFIRMED") {
    return "BOOKED";
  }
  if (booking?.status === "PENDING_PROVIDER_CONFIRMATION") return "BOOKING";
  if (!REQUEST_STATUSES.has(requestStatus as FreightRequestStatus)) {
    throw new Error(`INVALID_DASHBOARD_DATA: unsupported request status ${requestStatus}.`);
  }
  return requestStatus as FreightRequestStatus;
}

export function buildFreightRequestIntakeHref(requestCode: string) {
  return `/freight-request/new?requestCode=${encodeURIComponent(requestCode)}`;
}

export function buildDashboardViewModel(
  organizationId: string,
  persistedRequests: PersistedDashboardRequest[],
  persistedBookings: PersistedDashboardBooking[],
): DashboardViewModel {
  if (persistedRequests.some((request) => request.organization_id !== organizationId)) {
    throw new Error("DASHBOARD_CONTEXT_MISMATCH: request belongs to another organization.");
  }

  const bookings = latestBookings(persistedBookings);
  const requests = persistedRequests.map<FreightRequestListItem>((request) => {
    const volume = request.cargo_volume_m3 === null
      ? "volumen no registrado"
      : `${request.cargo_volume_m3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`;
    return {
      id: request.id,
      requestCode: request.code,
      origin: formatPlace(request.origin_address, request.origin_city, request.origin_country),
      destination: formatPlace(request.destination_address, request.destination_city, request.destination_country),
      corridorNote: request.cross_border ? "Corredor internacional" : "Ruta nacional",
      cargoSummary: `${request.cargo_weight_kg.toLocaleString("es-PE")} kg · ${volume}`,
      cargoDetail: request.cargo_description
        ?? `${request.cargo_entry_method} · ${request.transport_mode}/${request.service_type}`,
      pickupDate: formatDate(request.required_pickup),
      updatedAt: formatDate(request.updated_at),
      status: resolveStatus(request.status, bookings.get(request.id)),
    };
  });

  return {
    requests,
    summary: {
      activeRequests: requests.filter((request) => !["COMPLETED", "FAILED", "CANCELLED"].includes(request.status)).length,
      awaitingSelection: requests.filter((request) => request.status === "AWAITING_SELECTION").length,
      inTransit: requests.filter((request) => request.status === "IN_TRANSIT").length,
      completed: requests.filter((request) => request.status === "COMPLETED").length,
    },
  };
}
