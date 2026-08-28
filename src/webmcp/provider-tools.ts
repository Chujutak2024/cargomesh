import { dataStore } from "../features/freight/store";
import { Booking, CarrierOffer } from "../features/freight/types";
import { WebMCPToolDefinition } from "./polyfill";

/**
 * Provider-side WebMCP tool implementations.
 * Can be called either locally or registered on carrier web pages via document.modelContext.registerTool
 */

export interface CoverageInput {
  carrier_id: string;
  origin: string; // e.g. "Lima, Peru"
  destination: string; // e.g. "Arequipa, Peru"
  transport_mode: string; // "ROAD"
  cargo_category: string; // "GENERAL"
}

export interface CapacityInput {
  carrier_id: string;
  cargo_weight_kg: number;
  cargo_volume_m3?: number;
  requires_refrigeration?: boolean;
  is_hazardous?: boolean;
  is_fragile?: boolean;
  is_oversized?: boolean;
  required_pickup: string;
}

export interface QuoteInput {
  carrier_id: string;
  freight_request_id: string;
  origin: string;
  destination: string;
  cargo_weight_kg: number;
  cargo_volume_m3?: number;
  cargo_category: string;
  requires_refrigeration?: boolean;
  is_hazardous?: boolean;
  is_fragile?: boolean;
  is_oversized?: boolean;
  preferred_vehicle_brand?: string;
}

export interface BookInput {
  carrier_id: string;
  freight_request_id: string;
  offer_id: string;
}

// 1. check_service_coverage
export async function executeCheckServiceCoverage(input: CoverageInput) {
  const services = dataStore.getServices();
  const [originCity] = input.origin.split(",").map((s) => s.trim());
  const [destCity] = input.destination.split(",").map((s) => s.trim());

  const matched = services.find(
    (s) =>
      s.carrier_id === input.carrier_id &&
      s.active &&
      s.transport_mode === input.transport_mode &&
      s.origin_region.toLowerCase() === originCity.toLowerCase() &&
      s.destination_region.toLowerCase() === destCity.toLowerCase()
  );

  if (!matched) {
    return {
      supported: false,
      carrier_id: input.carrier_id,
      service_notes: `Corridor ${input.origin} -> ${input.destination} is outside current network coverage for carrier ${input.carrier_id}.`,
    };
  }

  const categorySupported = matched.supported_cargo_categories.includes(input.cargo_category);

  return {
    supported: categorySupported,
    carrier_id: input.carrier_id,
    service_id: matched.id,
    max_capacity_kg: matched.max_capacity_kg,
    supports_refrigerated: matched.supports_refrigerated,
    service_notes: categorySupported
      ? `Full corridor coverage verified for ${input.cargo_category} under ${input.transport_mode}.`
      : `Corridor exists but category ${input.cargo_category} is not authorized for standard transit.`,
  };
}

// 2. check_capacity
export async function executeCheckCapacity(input: CapacityInput) {
  const services = dataStore.getServices().filter((s) => s.carrier_id === input.carrier_id);
  const vehicles = dataStore.getVehicles().filter((v) => v.carrier_id === input.carrier_id && v.status === "AVAILABLE");

  const eligibleVehicles = vehicles.filter((v) => {
    if (v.capacity_kg < input.cargo_weight_kg) return false;
    if (input.requires_refrigeration && !v.supports_refrigerated) return false;
    if (input.is_hazardous && !v.supports_hazardous) return false;
    if (input.is_oversized && !v.supports_oversized) return false;
    return true;
  });

  const available = eligibleVehicles.length > 0;
  const maxCapacity = services.reduce((max, s) => Math.max(max, s.max_capacity_kg), 0);

  return {
    available,
    carrier_id: input.carrier_id,
    available_units_count: eligibleVehicles.length,
    earliest_pickup: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    max_service_capacity_kg: maxCapacity,
    eligible_vehicles: eligibleVehicles.map((v) => ({
      id: v.id,
      brand: v.brand,
      vehicle_type: v.vehicle_type,
      capacity_kg: v.capacity_kg,
    })),
  };
}

// 3. quote_freight
export async function executeQuoteFreight(input: QuoteInput): Promise<CarrierOffer> {
  const carriers = dataStore.getCarriers();
  const carrier = carriers.find((c) => c.id === input.carrier_id);
  const carrierName = carrier ? carrier.name : input.carrier_id;

  const vehicles = dataStore.getVehicles().filter((v) => v.carrier_id === input.carrier_id && v.status === "AVAILABLE");
  
  // Choose vehicle according to preferred brand if available, else first compatible
  let selectedVehicle = vehicles.find(
    (v) =>
      input.preferred_vehicle_brand &&
      v.brand.toLowerCase() === input.preferred_vehicle_brand.toLowerCase()
  );
  if (!selectedVehicle && vehicles.length > 0) {
    selectedVehicle = vehicles[0];
  }

  // Deterministic pricing per carrier
  let price = 760;
  let durationHours = 16;
  if (input.carrier_id === "car-pacific") {
    price = 690;
    durationHours = 20;
  } else if (input.carrier_id === "car-inca") {
    price = 820;
    durationHours = 14;
  } else if (input.carrier_id === "car-andes") {
    price = 760;
    durationHours = 16;
  }

  // Cold chain surcharge
  if (input.requires_refrigeration) {
    price += 120;
  }

  const pickupTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const deliveryTime = new Date(Date.now() + (2 + durationHours) * 3600 * 1000).toISOString();

  const offer: CarrierOffer = {
    id: `off-${input.carrier_id}-${Date.now()}`,
    freight_request_id: input.freight_request_id,
    carrier_id: input.carrier_id,
    carrier_name: carrierName,
    vehicle_id: selectedVehicle ? selectedVehicle.id : null,
    vehicle_brand: selectedVehicle ? selectedVehicle.brand : "Scania",
    vehicle_type: selectedVehicle ? selectedVehicle.vehicle_type : "FTL Semi-Trailer 18t",
    offer_reference: `OFR-${carrierName.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    transport_mode: "ROAD",
    service_type: "FTL",
    price,
    currency: "USD",
    estimated_pickup: pickupTime,
    estimated_delivery: deliveryTime,
    estimated_duration_hours: durationHours,
    available_capacity_kg: selectedVehicle ? selectedVehicle.capacity_kg : 18000,
    available_volume_m3: selectedVehicle ? selectedVehicle.volume_m3 : 50,
    valid_until: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    compatibility_status: "COMPATIBLE",
    status: "QUOTED",
    created_at: new Date().toISOString(),
  };

  return offer;
}

// 4. book_freight
export async function executeBookFreight(input: BookInput): Promise<Booking> {
  const carrier = dataStore.getCarriers().find((c) => c.id === input.carrier_id);
  const carrierName = carrier ? carrier.name : input.carrier_id;
  const offers = dataStore.getOffers(input.freight_request_id);
  const offer = offers.find((o) => o.id === input.offer_id) || {
    price: input.carrier_id === "car-pacific" ? 690 : input.carrier_id === "car-inca" ? 820 : 760,
    currency: "USD",
    vehicle_brand: "Scania",
  };

  const booking: Booking = {
    id: `bk-${Date.now()}`,
    freight_request_id: input.freight_request_id,
    carrier_id: input.carrier_id,
    carrier_name: carrierName,
    offer_id: input.offer_id,
    provider_reference: `${carrierName.substring(0, 3).toUpperCase()}-BOOK-${Math.floor(1000 + Math.random() * 9000)}`,
    price: offer.price || 760,
    currency: offer.currency || "USD",
    estimated_delivery: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
    vehicle_brand: offer.vehicle_brand || "Scania",
    status: "CONFIRMED",
    booked_at: new Date().toISOString(),
  };

  dataStore.createBooking(booking);
  return booking;
}

// 5. get_booking_status
export async function executeGetBookingStatus(bookingId: string) {
  const bookings = dataStore.getBookings();
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return { error: "Booking not found", booking_id: bookingId };
  }

  return {
    booking_id: booking.id,
    provider_reference: booking.provider_reference,
    status: booking.status,
    carrier_name: booking.carrier_name,
    estimated_delivery: booking.estimated_delivery,
    vehicle_brand: booking.vehicle_brand,
    operational_notes:
      booking.status === "DISRUPTED"
        ? "Vehicle reported mechanical breakdown at Mile 142. Awaiting recovery or re-dispatch."
        : "Unit is scheduled for pickup as planned.",
  };
}

// Export WebMCP Tool Definitions for browser registration
export const PROVIDER_WEBMCP_TOOLS: WebMCPToolDefinition[] = [
  {
    name: "check_service_coverage",
    description: "Verifies if the carrier provides road freight coverage for the specified origin and destination corridor.",
    inputSchema: {
      type: "object",
      properties: {
        carrier_id: { type: "string" },
        origin: { type: "string" },
        destination: { type: "string" },
        transport_mode: { type: "string" },
        cargo_category: { type: "string" },
      },
      required: ["carrier_id", "origin", "destination", "transport_mode", "cargo_category"],
    },
    execute: executeCheckServiceCoverage,
  },
  {
    name: "check_capacity",
    description: "Inspects active fleet availability, payload capacity and specialized handling features.",
    inputSchema: {
      type: "object",
      properties: {
        carrier_id: { type: "string" },
        cargo_weight_kg: { type: "number" },
        cargo_volume_m3: { type: "number" },
        requires_refrigeration: { type: "boolean" },
        is_hazardous: { type: "boolean" },
        is_fragile: { type: "boolean" },
        is_oversized: { type: "boolean" },
        required_pickup: { type: "string" },
      },
      required: ["carrier_id", "cargo_weight_kg", "required_pickup"],
    },
    execute: executeCheckCapacity,
  },
  {
    name: "quote_freight",
    description: "Generates an official guaranteed freight quote including pricing, transit time and vehicle allocation.",
    inputSchema: {
      type: "object",
      properties: {
        carrier_id: { type: "string" },
        freight_request_id: { type: "string" },
        origin: { type: "string" },
        destination: { type: "string" },
        cargo_weight_kg: { type: "number" },
        cargo_category: { type: "string" },
      },
      required: ["carrier_id", "freight_request_id", "origin", "destination", "cargo_weight_kg", "cargo_category"],
    },
    execute: executeQuoteFreight,
  },
  {
    name: "book_freight",
    description: "Executes a binding autonomous booking for an accepted freight quote.",
    inputSchema: {
      type: "object",
      properties: {
        carrier_id: { type: "string" },
        freight_request_id: { type: "string" },
        offer_id: { type: "string" },
      },
      required: ["carrier_id", "freight_request_id", "offer_id"],
    },
    execute: executeBookFreight,
  },
  {
    name: "get_booking_status",
    description: "Retrieves live telemetry and operational status for an active booking.",
    inputSchema: {
      type: "object",
      properties: {
        booking_id: { type: "string" },
      },
      required: ["booking_id"],
    },
    execute: async (input: { booking_id: string }) => executeGetBookingStatus(input.booking_id),
  },
];
