import assert from "node:assert/strict";
import test from "node:test";
import { assertSubmittableFreightRequest, FreightSubmissionError, type SubmissionRow } from "./submission-policy";

const now = new Date("2026-09-20T00:00:00.000Z");
const valid: SubmissionRow = {
  id: "f2000000-0000-0000-0000-000000000001", organization_id: "a0000000-0000-0000-0000-000000000001",
  code: "FR-2001", status: "DRAFT", draft_version: 1,
  cargo_category_id: "c0000000-0000-0000-0000-000000000001",
  origin_country: "PE", origin_city: "Callao", destination_country: "CL", destination_city: "Santiago",
  cargo_weight_kg: 1600, cargo_volume_m3: 3.6, cargo_entry_method: "PALLETS",
  entry_quantity: 2, entry_unit_weight_kg: 800, units_per_entry: 1,
  transport_mode: "ROAD", service_type: "FTL", optimization_strategy: "BALANCED",
  pickup_mode: "SCHEDULED", pickup_window_start: "2026-09-21T00:00:00.000Z",
  pickup_window_end: "2026-09-22T00:00:00.000Z", required_pickup: "2026-09-21T00:00:00.000Z",
  delivery_deadline: "2026-09-24T00:00:00.000Z",
};

test("only a complete persisted ROAD/FTL/BALANCED scheduled pallet request is submittable", () => {
  assert.doesNotThrow(() => assertSubmittableFreightRequest(valid, now));
  assert.doesNotThrow(() => assertSubmittableFreightRequest({ ...valid, destination_country: "PE" }, now));
  for (const patch of [
    { cargo_volume_m3: null }, { cargo_weight_kg: 0 }, { origin_city: "" },
    { transport_mode: "SEA" }, { cargo_entry_method: "TOTAL_WEIGHT" },
    { pickup_mode: "ASAP" }, { units_per_entry: 2 },
    { pickup_window_start: "2026-09-19T00:00:00.000Z" },
    { pickup_window_end: "2026-09-21T00:00:00.000Z" },
  ]) {
    assert.throws(() => assertSubmittableFreightRequest({ ...valid, ...patch }, now),
      (error) => error instanceof FreightSubmissionError && error.code === "INVALID_DRAFT");
  }
});
