export type SubmissionRow = {
  id: string; organization_id: string; code: string; status: string; draft_version: number;
  cargo_category_id: string | null; origin_country: string; origin_city: string;
  destination_country: string; destination_city: string;
  cargo_weight_kg: number; cargo_volume_m3: number | null;
  cargo_entry_method: string; entry_quantity: number | null;
  entry_unit_weight_kg: number | null; units_per_entry: number | null;
  transport_mode: string; service_type: string; optimization_strategy: string;
  pickup_mode: string; pickup_window_start: string | null; pickup_window_end: string | null;
  required_pickup: string | null; delivery_deadline: string | null;
};

export class FreightSubmissionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "FreightSubmissionError";
  }
}

/** Validate the persisted snapshot, never an MCP-supplied copy of freight details. */
export function assertSubmittableFreightRequest(row: SubmissionRow, now = new Date()): void {
  if (!row.cargo_category_id || !row.origin_country || !row.origin_city ||
      !row.destination_country || !row.destination_city ||
      row.transport_mode !== "ROAD" || row.service_type !== "FTL" ||
      row.optimization_strategy !== "BALANCED" || row.cargo_entry_method !== "PALLETS" ||
      !(Number(row.cargo_weight_kg) > 0) || !(Number(row.cargo_volume_m3) > 0) ||
      !(Number(row.entry_quantity) > 0) || !(Number(row.entry_unit_weight_kg) > 0) ||
      row.units_per_entry !== 1 || row.pickup_mode !== "SCHEDULED") {
    throw new FreightSubmissionError("INVALID_DRAFT", "The persisted request is incomplete or unsupported for freight search.");
  }
  const start = Date.parse(row.pickup_window_start ?? "");
  const end = Date.parse(row.pickup_window_end ?? "");
  const pickup = Date.parse(row.required_pickup ?? "");
  const deadline = row.delivery_deadline === null ? null : Date.parse(row.delivery_deadline);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(pickup) ||
      start <= now.getTime() || end <= start || pickup !== start ||
      (deadline !== null && (!Number.isFinite(deadline) || deadline <= start))) {
    throw new FreightSubmissionError("INVALID_DRAFT", "The persisted pickup or delivery schedule is invalid or expired.");
  }
}
