import {
  Booking,
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
  private disruptions: Map<string, DisruptionEvent> = new Map();

  constructor() {
    this.reset();
  }

  public reset() {
    this.requests.clear();
    this.offers.clear();
    this.decisions.clear();
    this.bookings.clear();
    this.disruptions.clear();

    INITIAL_FREIGHT_REQUESTS.forEach((req) => {
      this.requests.set(req.id, { ...req });
    });

    // Seed an initial booking for FR-1044 (to test Disruption Recovery)
    const fr1044Booking: Booking = {
      id: "bk-1044",
      freight_request_id: "fr-1044",
      carrier_id: "car-andes",
      carrier_name: "Andes Freight",
      offer_id: "off-and-1044",
      provider_reference: "AND-BOOK-9941",
      price: 760,
      currency: "USD",
      estimated_delivery: new Date(Date.now() + 16 * 3600 * 1000).toISOString(),
      vehicle_brand: "Scania",
      status: "IN_TRANSIT",
      booked_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    };
    this.bookings.set(fr1044Booking.id, fr1044Booking);
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

  public getVehicles() {
    return MOCK_VEHICLES;
  }

  public getMetrics(carrierId: string) {
    return MOCK_METRICS[carrierId] || null;
  }

  public getAllMetrics() {
    return MOCK_METRICS;
  }

  public getFreightRequests(): FreightRequest[] {
    return Array.from(this.requests.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public getFreightRequestById(id: string): FreightRequest | null {
    return this.requests.get(id) || null;
  }

  public createFreightRequest(req: FreightRequest): FreightRequest {
    this.requests.set(req.id, req);
    return req;
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
    return booking;
  }

  public getBookings(): Booking[] {
    return Array.from(this.bookings.values()).sort(
      (a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()
    );
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
