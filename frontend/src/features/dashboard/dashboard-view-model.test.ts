import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardViewModel,
  buildFreightRequestIntakeHref,
  type PersistedDashboardBooking,
  type PersistedDashboardRequest,
} from "./dashboard-view-model";

const organizationId = "a0000000-0000-0000-0000-000000000001";

function request(id: string, code: string, status: string): PersistedDashboardRequest {
  return {
    id,
    code,
    organization_id: organizationId,
    status,
    origin_address: null,
    origin_city: "Lima",
    origin_country: "PE",
    destination_address: null,
    destination_city: "Arequipa",
    destination_country: "PE",
    cross_border: false,
    cargo_description: null,
    cargo_entry_method: "TOTAL_WEIGHT",
    cargo_weight_kg: 7_000,
    cargo_volume_m3: null,
    transport_mode: "ROAD",
    service_type: "FTL",
    required_pickup: "2026-09-10T13:00:00.000Z",
    updated_at: "2026-09-02T12:00:00.000Z",
  };
}

function booking(
  freightRequestId: string,
  status: string,
  updatedAt: string,
): PersistedDashboardBooking {
  return {
    freight_request_id: freightRequestId,
    status,
    provider_booking_status: status === "COMPLETED" ? "DELIVERED" : status,
    updated_at: updatedAt,
  };
}

test("derives dashboard metrics only from real requests and booking lifecycle", () => {
  const rows = [
    request("10000000-0000-0000-0000-000000000001", "FR-1", "PENDING"),
    request("10000000-0000-0000-0000-000000000002", "FR-2", "AWAITING_SELECTION"),
    request("10000000-0000-0000-0000-000000000003", "FR-3", "BOOKED"),
    request("10000000-0000-0000-0000-000000000004", "FR-4", "BOOKED"),
  ];
  const model = buildDashboardViewModel(organizationId, rows, [
    booking(rows[2].id, "IN_TRANSIT", "2026-09-02T13:00:00.000Z"),
    booking(rows[3].id, "COMPLETED", "2026-09-02T14:00:00.000Z"),
  ]);

  assert.deepEqual(model.summary, {
    activeRequests: 3,
    awaitingSelection: 1,
    inTransit: 1,
    completed: 1,
  });
  assert.deepEqual(model.requests.map((item) => item.status), [
    "PENDING", "AWAITING_SELECTION", "IN_TRANSIT", "COMPLETED",
  ]);
  assert.match(model.requests[0].cargoSummary, /volumen no registrado/);
});

test("uses the latest booking state for a recovered request", () => {
  const row = request("10000000-0000-0000-0000-000000000005", "FR-5", "BOOKED");
  const model = buildDashboardViewModel(organizationId, [row], [
    booking(row.id, "COMPLETED", "2026-09-02T15:00:00.000Z"),
    booking(row.id, "IN_TRANSIT", "2026-09-02T14:00:00.000Z"),
  ]);
  assert.equal(model.requests[0].status, "COMPLETED");
});

test("returns a legitimate empty dashboard", () => {
  assert.deepEqual(buildDashboardViewModel(organizationId, [], []), {
    summary: { activeRequests: 0, awaitingSelection: 0, inTransit: 0, completed: 0 },
    requests: [],
  });
});

test("rejects rows outside the authenticated organization", () => {
  assert.throws(
    () => buildDashboardViewModel(organizationId, [{
      ...request("10000000-0000-0000-0000-000000000006", "FR-6", "PENDING"),
      organization_id: "a0000000-0000-0000-0000-000000000099",
    }], []),
    /DASHBOARD_CONTEXT_MISMATCH/,
  );
});

test("builds an intake link from the persisted requestCode", () => {
  assert.equal(
    buildFreightRequestIntakeHref("FR 1042/real"),
    "/freight-request/new?requestCode=FR%201042%2Freal",
  );
});
