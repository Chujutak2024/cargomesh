import {
  Booking,
  BookingEvent,
  CarrierMetrics,
  CarrierOffer,
  DisruptionEvent,
  FreightDecision,
  FreightRequest,
} from "./types";
import {
  INITIAL_FREIGHT_REQUESTS,
  MOCK_CARRIERS,
  MOCK_CATEGORIES,
  MOCK_METRICS,
  MOCK_ORGANIZATION,
  MOCK_PREFERENCES,
  MOCK_SERVICES,
  MOCK_USER,
  MOCK_VEHICLES,
} from "../providers/mock-data";

class CargoDataStore {
  private requests: Map<string, FreightRequest> = new Map();
  private offers: Map<string, CarrierOffer[]> = new Map();
  private decisions: Map<string, FreightDecision> = new Map();
  private bookings: Map<string, Booking> = new Map();
  private bookingEvents: Map<string, BookingEvent[]> = new Map();
  private disruptions: Map<string, DisruptionEvent> = new Map();

  constructor() {
    this.reset();
  }

  public reset() {
    this.requests.clear();
    this.offers.clear();
    this.decisions.clear();
    this.bookings.clear();
    this.bookingEvents.clear();
    this.disruptions.clear();

    INITIAL_FREIGHT_REQUESTS.forEach((req) => {
      this.requests.set(req.id, { ...req });
    });

    // Seed initial booking for Golden Flow 1: FR-1042 Lima -> Santiago
    const fr1042Booking: Booking = {
      id: "80000000-0000-0000-0000-000000000001",
      freight_request_id: "10000000-0000-0000-0000-000000001042",
      carrier_id: "d0000000-0000-0000-0000-000000000001",
      carrier_name: "Andes Freight S.A.",
      offer_id: "70000000-0000-0000-0000-000000000001",
      provider_reference: "AND-BOOK-8821",
      price: 1760,
      confirmed_price: 1760,
      currency: "USD",
      estimated_delivery: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      current_location: "Complejo Fronterizo Santa Rosa (Tacna, PE) / Chacalluta (Arica, CL)",
      updated_eta: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      vehicle_brand: "Scania",
      status: "BORDER_PROCESSING",
      booked_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    };
    this.bookings.set(fr1042Booking.id, fr1042Booking);

    // Seed initial milestones for AND-BOOK-8821
    const initialEvents: BookingEvent[] = [
      {
        id: "e1000000-0000-0000-0000-000000000001",
        booking_id: fr1042Booking.id,
        event_type: "CONFIRMED",
        occurred_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        country_code: "PE",
        city: "Lima",
        description: "Reserva vinculante confirmada mediante WebMCP con Andes Freight (AND-BOOK-8821).",
        source: "CARGOMESH_AGENT",
        metadata: { rate_usd: 1760, unit: "Scania R450 Heavy Semi-Trailer 18t" },
      },
      {
        id: "e1000000-0000-0000-0000-000000000002",
        booking_id: fr1042Booking.id,
        event_type: "PICKUP_SCHEDULED",
        occurred_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        country_code: "PE",
        city: "Lima",
        description: "Ventana de recojo programada en Almacén Central Callao (Puerta 4).",
        source: "CARRIER_WEBMCP",
        metadata: { dock: "Puerta 4", driver_ready: true },
      },
      {
        id: "e1000000-0000-0000-0000-000000000003",
        booking_id: fr1042Booking.id,
        event_type: "PICKED_UP",
        occurred_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        country_code: "PE",
        city: "Lima (Callao)",
        description: "Carga estibada exitosamente (8,000 kg en 12 bultos). Manifiesto de carga emitido.",
        source: "CARRIER_WEBMCP",
        metadata: { weight_verified_kg: 8000, seal_number: "AND-SL-9081" },
      },
      {
        id: "e1000000-0000-0000-0000-000000000004",
        booking_id: fr1042Booking.id,
        event_type: "IN_TRANSIT",
        occurred_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        country_code: "PE",
        city: "Panamericana Sur (Ica)",
        description: "Unidad en tránsito hacia frontera sur. Condiciones mecánicas nominales.",
        source: "CARRIER_WEBMCP",
        metadata: { corridor: "Panamericana Sur PE", km: 300 },
      },
      {
        id: "e1000000-0000-0000-0000-000000000005",
        booking_id: fr1042Booking.id,
        event_type: "BORDER_PROCESSING",
        occurred_at: new Date().toISOString(),
        country_code: "PE / CL",
        city: "Tacna / Arica",
        description: "Ingreso al Complejo Fronterizo Santa Rosa - Chacalluta. Trámite documental MIC/DTA en proceso.",
        source: "CARRIER_WEBMCP",
        metadata: { customs_status: "PROCESSING", docs_verified: ["commercial_invoice", "packing_list"] },
      },
    ];
    this.bookingEvents.set(fr1042Booking.id, initialEvents);
  }

  public getOrganization() {
    return MOCK_ORGANIZATION;
  }

  public getUser() {
    return MOCK_USER;
  }

  public getPreferences() {
    return MOCK_PREFERENCES;
  }

  public getCategories() {
    return MOCK_CATEGORIES;
  }

  public getCarriers() {
    return MOCK_CARRIERS;
  }

  public getServices() {
    return MOCK_SERVICES;
  }

  public getMetrics() {
    return MOCK_METRICS;
  }

  public getAllMetrics() {
    return MOCK_METRICS;
  }

  public getMetricsForCarrier(carrierId: string): CarrierMetrics | null {
    return (
      MOCK_METRICS[carrierId] ||
      MOCK_METRICS[`car-${carrierId}`] ||
      Object.values(MOCK_METRICS).find((m) => carrierId.includes(m.carrier_id.replace("car-", ""))) ||
      null
    );
  }

  public getVehicles() {
    return MOCK_VEHICLES;
  }

  public getFreightRequests(): FreightRequest[] {
    return Array.from(this.requests.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public getFreightRequestById(id: string): FreightRequest | null {
    return this.requests.get(id) || null;
  }

  public createFreightRequest(request: FreightRequest): FreightRequest {
    this.requests.set(request.id, request);
    return request;
  }

  public updateFreightRequest(id: string, patch: Partial<FreightRequest>): FreightRequest | null {
    const existing = this.requests.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.requests.set(id, updated);
    return updated;
  }

  public saveOffers(freightRequestId: string, offersList: CarrierOffer[]) {
    this.offers.set(freightRequestId, offersList);
  }

  public getOffers(freightRequestId: string): CarrierOffer[] {
    return this.offers.get(freightRequestId) || [];
  }

  public saveDecision(decision: FreightDecision): FreightDecision {
    this.decisions.set(decision.freight_request_id, decision);
    return decision;
  }

  public getDecision(freightRequestId: string): FreightDecision | null {
    return this.decisions.get(freightRequestId) || null;
  }

  public createBooking(booking: Booking): Booking {
    this.bookings.set(booking.id, booking);
    // Update freight request status to ASSIGNED
    const req = this.requests.get(booking.freight_request_id);
    if (req) {
      this.requests.set(req.id, { ...req, status: "ASSIGNED" });
    }

    // Initialize tracking event
    const initialEvent: BookingEvent = {
      id: `ev-${Date.now()}`,
      booking_id: booking.id,
      event_type: "CONFIRMED",
      occurred_at: new Date().toISOString(),
      country_code: "PE",
      city: "Lima",
      description: `Reserva vinculante confirmada mediante WebMCP con referencia ${booking.provider_reference}.`,
      source: "CARGOMESH_AGENT",
      metadata: { rate_usd: booking.price || booking.confirmed_price, status: "CONFIRMED" },
    };
    this.bookingEvents.set(booking.id, [initialEvent]);

    return booking;
  }

  public getBookings(): Booking[] {
    return Array.from(this.bookings.values()).sort(
      (a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()
    );
  }

  public getBookingById(id: string): Booking | null {
    return this.bookings.get(id) || null;
  }

  public getBookingByRequestId(freightRequestId: string): Booking | null {
    for (const b of this.bookings.values()) {
      if (b.freight_request_id === freightRequestId) return b;
    }
    return null;
  }

  public updateBooking(id: string, patch: Partial<Booking>): Booking | null {
    const existing = this.bookings.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.bookings.set(id, updated);
    return updated;
  }

  public addBookingEvent(bookingId: string, event: BookingEvent): BookingEvent {
    const events = this.bookingEvents.get(bookingId) || [];
    events.push(event);
    this.bookingEvents.set(bookingId, events);
    return event;
  }

  public getBookingEvents(bookingId: string): BookingEvent[] {
    return (this.bookingEvents.get(bookingId) || []).sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    );
  }

  public createDisruption(event: DisruptionEvent): DisruptionEvent {
    this.disruptions.set(event.id, event);
    return event;
  }

  public getDisruptions(): DisruptionEvent[] {
    return Array.from(this.disruptions.values()).sort(
      (a, b) =>
        new Date(b.detected_at || b.created_at).getTime() -
        new Date(a.detected_at || a.created_at).getTime()
    );
  }
}

// Global Singleton for runtime consistency
const globalForStore = globalThis as unknown as { cargoDataStore?: CargoDataStore };
export const dataStore = globalForStore.cargoDataStore ?? new CargoDataStore();
if (process.env.NODE_ENV !== "production") globalForStore.cargoDataStore = dataStore;
