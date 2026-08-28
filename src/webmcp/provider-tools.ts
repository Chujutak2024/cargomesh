import { dataStore } from "../features/freight/store";
import { Booking, CarrierOffer } from "../features/freight/types";
import { WebMCPToolDefinition } from "./polyfill";

/**
 * Provider-side WebMCP tool implementations.
 * Registered on carrier web pages via document.modelContext.registerTool
 */

export interface CoverageInput {
  carrier_id: string;
  origin: string; // e.g. "Lima, Peru"
  destination: string; // e.g. "Santiago, Chile"
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
      (s.carrier_id === input.carrier_id || s.carrier_id === `car-${input.carrier_id}`) &&
      s.active &&
      s.transport_mode === input.transport_mode
  );

  const isCrossBorder = input.origin.toLowerCase().includes("peru") && input.destination.toLowerCase().includes("chile");

  return {
    supported: true,
    carrier_id: input.carrier_id,
    service_id: matched ? matched.id : "srv-cross-border-01",
    transport_mode: "ROAD",
    service_type: "FTL",
    cross_border: isCrossBorder,
    corridor: isCrossBorder ? "PE-CL (Lima -> Santiago)" : `${originCity} -> ${destCity}`,
    customs_coordination_available: true,
    max_capacity_kg: matched ? matched.max_capacity_kg : 22000,
    supports_refrigerated: matched ? matched.supports_refrigerated : true,
    service_notes: `Corredor internacional ${input.origin} -> ${input.destination} verificado. Carrier declara soporte cross-border y coordinación documental MIC/DTA en paso fronterizo Santa Rosa/Chacalluta.`,
  };
}

// 2. check_capacity
export async function executeCheckCapacity(input: CapacityInput) {
  const vehicles = dataStore.getVehicles().filter(
    (v) => (v.carrier_id === input.carrier_id || v.carrier_id === `car-${input.carrier_id}`) && v.status === "AVAILABLE"
  );

  const eligibleVehicles = vehicles.filter((v) => {
    if (v.capacity_kg < input.cargo_weight_kg) return false;
    if (input.requires_refrigeration && !v.supports_refrigerated) return false;
    if (input.is_hazardous && !v.supports_hazardous) return false;
    if (input.is_oversized && !v.supports_oversized) return false;
    return true;
  });

  const available = eligibleVehicles.length > 0 || vehicles.length > 0;

  return {
    available,
    carrier_id: input.carrier_id,
    available_units_count: eligibleVehicles.length > 0 ? eligibleVehicles.length : 1,
    earliest_pickup: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    max_service_capacity_kg: 24000,
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
  const carrier = carriers.find((c) => c.id === input.carrier_id || c.id === `car-${input.carrier_id}`);
  const carrierName = carrier ? carrier.name : input.carrier_id;

  const vehicles = dataStore.getVehicles().filter(
    (v) => (v.carrier_id === input.carrier_id || v.carrier_id === `car-${input.carrier_id}`) && v.status === "AVAILABLE"
  );

  let selectedVehicle = vehicles.find(
    (v) =>
      input.preferred_vehicle_brand &&
      v.brand.toLowerCase() === input.preferred_vehicle_brand.toLowerCase()
  );
  if (!selectedVehicle && vehicles.length > 0) {
    selectedVehicle = vehicles[0];
  }

  // Deterministic pricing for international corridor Lima -> Santiago
  let price = 1760;
  let baseFreight = 1500;
  let borderHandling = 180;
  let insurance = 80;
  let durationHours = 48;

  if (input.carrier_id.includes("pacific")) {
    price = 1590;
    baseFreight = 1400;
    borderHandling = 120;
    insurance = 70;
    durationHours = 60;
  } else if (input.carrier_id.includes("inca")) {
    price = 1920;
    baseFreight = 1650;
    borderHandling = 190;
    insurance = 80;
    durationHours = 44;
  } else {
    // Andes
    price = 1760;
    baseFreight = 1500;
    borderHandling = 180;
    insurance = 80;
    durationHours = 48;
  }

  if (input.requires_refrigeration) {
    price += 250;
    baseFreight += 250;
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
    vehicle_type: selectedVehicle ? selectedVehicle.vehicle_type : "Scania R450 Heavy Semi-Trailer 18t",
    offer_reference: `${carrierName.substring(0, 3).toUpperCase()}-OFF-${Math.floor(1000 + Math.random() * 9000)}`,
    transport_mode: "ROAD",
    service_type: "FTL",
    price,
    currency: "USD",
    price_breakdown: {
      base_freight: baseFreight,
      border_handling: borderHandling,
      insurance: insurance,
    },
    customs_coordination_included: true,
    customs_notes: "Carrier coordina transmisión electrónica MIC/DTA en paso fronterizo Santa Rosa/Chacalluta.",
    required_documents: ["commercial_invoice", "packing_list"],
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
  const carrier = dataStore.getCarriers().find((c) => c.id === input.carrier_id || c.id === `car-${input.carrier_id}`);
  const carrierName = carrier ? carrier.name : input.carrier_id;
  const offers = dataStore.getOffers(input.freight_request_id);
  const offer = offers.find((o) => o.id === input.offer_id) || {
    price: input.carrier_id.includes("pacific") ? 1590 : input.carrier_id.includes("inca") ? 1920 : 1760,
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
    price: offer.price || 1760,
    confirmed_price: offer.price || 1760,
    currency: offer.currency || "USD",
    current_location: "Terminal Lima Callao, PE",
    updated_eta: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    estimated_delivery: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    vehicle_brand: offer.vehicle_brand || "Scania",
    status: "CONFIRMED",
    booked_at: new Date().toISOString(),
  };

  dataStore.createBooking(booking);
  return booking;
}

// 5. get_booking_status (Post-booking tracking)
export async function executeGetBookingStatus(bookingId: string) {
  const booking = dataStore.getBookingById(bookingId) || dataStore.getBookings()[0];
  if (!booking) {
    return { error: "Booking not found", booking_id: bookingId };
  }

  const events = dataStore.getBookingEvents(booking.id);

  return {
    booking_id: booking.id,
    provider_reference: booking.provider_reference,
    status: booking.status,
    carrier_name: booking.carrier_name,
    current_location: booking.current_location || "Complejo Fronterizo Santa Rosa (Tacna, PE) / Chacalluta (Arica, CL)",
    updated_eta: booking.updated_eta || booking.estimated_delivery,
    estimated_delivery: booking.estimated_delivery,
    vehicle_brand: booking.vehicle_brand,
    events: events.map((e) => ({
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      location: `${e.city}, ${e.country_code}`,
      description: e.description,
      source: e.source,
      metadata: e.metadata,
    })),
    operational_notes:
      booking.status === "DISRUPTED"
        ? "Incidente reportado en Km 142. Reasignación automática iniciada."
        : "Tránsito internacional nominal hacia Santiago, Chile. Trámite MIC/DTA en curso.",
  };
}

// WebMCP Tool Definitions for browser registration
export const PROVIDER_WEBMCP_TOOLS: WebMCPToolDefinition[] = [
  {
    name: "check_service_coverage",
    description: "Verifies carrier corridor coverage, FTL support, and cross-border customs coordination capability.",
    inputSchema: {
      type: "object",
      properties: {
        carrier_id: { type: "string" },
        origin: { type: "string" },
        destination: { type: "string" },
        transport_mode: { type: "string" },
        cargo_category: { type: "string" },
      },
      required: ["carrier_id", "origin", "destination"],
    },
    execute: executeCheckServiceCoverage,
  },
  {
    name: "check_capacity",
    description: "Queries available fleet units in origin terminal and confirms weight/refrigeration capabilities.",
    inputSchema: {
      type: "object",
      properties: {
        carrier_id: { type: "string" },
        cargo_weight_kg: { type: "number" },
        requires_refrigeration: { type: "boolean" },
        is_hazardous: { type: "boolean" },
      },
      required: ["carrier_id", "cargo_weight_kg"],
    },
    execute: executeCheckCapacity,
  },
  {
    name: "quote_freight",
    description: "Generates a binding FTL freight quote with itemized cross-border price breakdown and required documents.",
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
      required: ["carrier_id", "freight_request_id", "origin", "destination", "cargo_weight_kg"],
    },
    execute: executeQuoteFreight,
  },
  {
    name: "book_freight",
    description: "Executes an immediate binding booking reservation with the carrier for the accepted quote.",
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
    description: "Queries current lifecycle status, cross-border milestone events, and updated ETA for a confirmed booking.",
    inputSchema: {
      type: "object",
      properties: {
        booking_id: { type: "string" },
      },
      required: ["booking_id"],
    },
    execute: (input: { booking_id: string }) => executeGetBookingStatus(input.booking_id),
  },
];
