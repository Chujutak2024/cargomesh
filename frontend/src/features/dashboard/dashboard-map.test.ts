import assert from "node:assert/strict";
import test from "node:test";

import { buildDashboardOperationsMap } from "./dashboard-map";
import {
  createOperationsMapRoute,
  operationsMapCoordinatesFor,
} from "./operations-map-geometry";
import type { PersistedDashboardBooking, PersistedDashboardRequest } from "./dashboard-view-model";
import { LATAM_LOGISTICS_DIRECTORY } from "../freight-requests/geography-data";

const callaoToSantiago: PersistedDashboardRequest = {
  id: "request-fr1042",
  code: "FR-1042",
  organization_id: "org-acme",
  status: "PENDING",
  origin_address: "Terminal portuario del Callao",
  origin_city: "Callao",
  origin_country: "PE",
  destination_address: "Centro de distribución San Bernardo",
  destination_city: "Santiago",
  destination_country: "CL",
  cross_border: true,
  cargo_description: "Repuestos mineros",
  cargo_entry_method: "PALLETS",
  cargo_weight_kg: 8000,
  cargo_volume_m3: 18,
  transport_mode: "ROAD",
  service_type: "FTL",
  required_pickup: "2026-09-03T13:00:00.000Z",
  updated_at: "2026-09-02T20:00:00.000Z",
};

test("FR-1042 remains visible as a planned corridor before a carrier booking exists", () => {
  const map = buildDashboardOperationsMap([callaoToSantiago], []);

  assert.deepEqual(map, {
    bookingId: null,
    mode: "planned",
    requestCode: "FR-1042",
    origin: { city: "Callao", countryCode: "PE" },
    destination: { city: "Santiago", countryCode: "CL" },
    checkpoints: [],
  });
});

test("an active booking upgrades the same corridor to live and exposes only persisted checkpoints", () => {
  const booking: PersistedDashboardBooking = {
    id: "booking-andes",
    freight_request_id: callaoToSantiago.id,
    status: "CONFIRMED",
    provider_booking_status: "CONFIRMED",
    updated_at: "2026-09-02T21:00:00.000Z",
  };
  const map = buildDashboardOperationsMap([callaoToSantiago], [booking], [
    {
      provider_event_id: "carrier-checkpoint-1",
      event_type: "IN_TRANSIT",
      occurred_at: "2026-09-02T21:30:00.000Z",
      payload: { location: { city: "Tacna", countryCode: "PE" } },
    },
    {
      provider_event_id: "carrier-event-without-location",
      event_type: "CONFIRMED",
      occurred_at: "2026-09-02T21:00:00.000Z",
      payload: { providerReference: "AND-BOOK-1" },
    },
  ]);

  assert.equal(map?.mode, "live");
  assert.equal(map?.bookingId, "booking-andes");
  assert.deepEqual(map?.checkpoints, [{
    id: "carrier-checkpoint-1",
    city: "Tacna",
    countryCode: "PE",
    label: "IN_TRANSIT",
    occurredAt: "2026-09-02T21:30:00.000Z",
  }]);
});

test("a newly persisted draft is available as an explicitly planned route", () => {
  const map = buildDashboardOperationsMap([{ ...callaoToSantiago, status: "DRAFT" }], []);
  assert.equal(map?.requestCode, "FR-1042");
  assert.equal(map?.mode, "planned");
  assert.equal(map?.bookingId, null);
});

test("an explicit requestCode selects its own persisted planned route over another active booking", () => {
  const limaToIca = {
    ...callaoToSantiago,
    id: "request-fr1028",
    code: "FR-1028",
    origin_city: "Lima",
    destination_city: "Ica",
    destination_country: "PE",
    cross_border: false,
  };
  const booking: PersistedDashboardBooking = {
    id: "booking-andes",
    freight_request_id: callaoToSantiago.id,
    status: "CONFIRMED",
    provider_booking_status: "CONFIRMED",
    updated_at: "2026-09-02T21:00:00.000Z",
  };

  const map = buildDashboardOperationsMap([callaoToSantiago, limaToIca], [booking], [], "FR-1028");

  assert.equal(map?.requestCode, "FR-1028");
  assert.equal(map?.mode, "planned");
  assert.equal(map?.bookingId, null);
});

test("an explicit unknown requestCode never falls back to another organization request", () => {
  const map = buildDashboardOperationsMap([callaoToSantiago], [], [], "FR-9999");
  assert.equal(map, null);
});

test("the canonical Callao-Santiago route uses a detailed road vector", () => {
  const model = buildDashboardOperationsMap([callaoToSantiago], []);
  assert.ok(model);
  const route = createOperationsMapRoute(model);

  assert.equal(route.followsRoadCorridor, true);
  assert.equal(route.isNominal, true);
  assert.ok(route.polylineCoordinates.length > 100);
  assert.deepEqual(route.polylineCoordinates[0], operationsMapCoordinatesFor(model.origin));
  assert.deepEqual(route.polylineCoordinates.at(-1), operationsMapCoordinatesFor(model.destination));
});

test("a partial Peru-Chile route slices the canonical corridor without Callao/Santiago backtracking", () => {
  const model = {
    bookingId: null,
    mode: "planned" as const,
    requestCode: "FR-PARTIAL",
    origin: { city: "Arequipa", countryCode: "PE" },
    destination: { city: "Antofagasta", countryCode: "CL" },
    checkpoints: [],
  };
  const route = createOperationsMapRoute(model);

  assert.equal(route.followsRoadCorridor, true);
  assert.deepEqual(route.polylineCoordinates[0], operationsMapCoordinatesFor(model.origin));
  assert.deepEqual(route.polylineCoordinates.at(-1), operationsMapCoordinatesFor(model.destination));
  assert.ok(route.polylineCoordinates.every(([latitude]) => latitude < -15 && latitude > -25));
});

test("every selectable logistics city has a map anchor", () => {
  const missing = LATAM_LOGISTICS_DIRECTORY.flatMap((country) =>
    country.regions.flatMap((region) =>
      region.hubs.flatMap((hub) =>
        operationsMapCoordinatesFor({ city: hub.city, countryCode: country.code })
          ? []
          : [`${country.code}:${region.name}:${hub.city}`],
      ),
    ),
  );

  assert.deepEqual(missing, []);
});

test("a validated route outside the detailed spine remains visible without claiming road geometry", () => {
  const route = createOperationsMapRoute({
    bookingId: null,
    mode: "planned",
    requestCode: "FR-NORTH",
    origin: { city: "Paita", countryCode: "PE" },
    destination: { city: "Trujillo", countryCode: "PE" },
    checkpoints: [],
  });

  assert.equal(route.followsRoadCorridor, false);
  assert.equal(route.polylineCoordinates.length, 2);
  assert.equal(route.points.length, 2);
});
