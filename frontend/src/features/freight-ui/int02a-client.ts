import type { FreightIntakeModel } from "./view-models";
import type {
  ProviderRunnerInputs,
} from "@/features/webmcp-runner/contracts";

export function createInt02aIdempotencyKey(freightRequestId: string) {
  return `cm:int02b:${freightRequestId}:${crypto.randomUUID()}`;
}

export function buildRealDispatchPath(runId: string) {
  return `/dispatch/${encodeURIComponent(runId)}`;
}

export function cacheInt02aViewModel(runId: string, viewModel: unknown) {
  try {
    sessionStorage.setItem(`cargomesh:int02a:view-model:${runId}`, JSON.stringify(viewModel));
  } catch {
    // The persisted GET endpoint remains the source of truth when storage is unavailable.
  }
}

export function takeCachedInt02aViewModel(runId: string): unknown {
  try {
    const key = `cargomesh:int02a:view-model:${runId}`;
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function buildProviderRunnerInputs(model: FreightIntakeModel): ProviderRunnerInputs {
  const cargoWeightKg = model.quantity * model.unitWeightKg;
  const cargoVolumeM3 = model.quantity * model.lengthCm * model.widthCm * model.heightCm / 1_000_000;
  const schedule = parseScheduledWindow(model);

  return {
    check_service_coverage: {
      origin: model.origin,
      destination: model.destination,
      transport_mode: model.transportMode,
      service_type: model.serviceType,
      cargo_category: model.cargoCategoryCode,
    },
    check_capacity: {
      origin: model.origin,
      destination: model.destination,
      cargo_weight_kg: cargoWeightKg,
      cargo_volume_m3: cargoVolumeM3,
      cargo_category: model.cargoCategoryCode,
      pickup_mode: "SCHEDULED",
      ...schedule,
    },
    quote_freight: {
      freight_request_id: model.freightRequestId,
      origin: model.origin,
      destination: model.destination,
      cargo_weight_kg: cargoWeightKg,
      cargo_volume_m3: cargoVolumeM3,
      cargo_category: model.cargoCategoryCode,
      pickup_mode: "SCHEDULED",
      ...schedule,
      available_documents: [...model.documents],
    },
  };
}

function parseScheduledWindow(model: FreightIntakeModel) {
  const fields = [
    model.pickupWindowStart,
    model.pickupWindowEnd,
    model.deliveryDeadline,
  ];
  const [pickupWindowStart, pickupWindowEnd, deliveryDeadline] = fields.map((value) =>
    value.trim() && Number.isFinite(Date.parse(value)) ? new Date(value) : null,
  );

  if (!pickupWindowStart || !pickupWindowEnd) {
    throw new Error("SCHEDULED requiere inicio y fin de la ventana de recojo.");
  }
  if (pickupWindowEnd.getTime() <= pickupWindowStart.getTime()) {
    throw new Error("El fin de la ventana de recojo debe ser posterior al inicio.");
  }
  if (!deliveryDeadline || deliveryDeadline.getTime() <= pickupWindowStart.getTime()) {
    throw new Error("El deadline de entrega debe ser posterior al inicio del recojo.");
  }

  return {
    pickup_window_start: pickupWindowStart.toISOString(),
    pickup_window_end: pickupWindowEnd.toISOString(),
    delivery_deadline: deliveryDeadline.toISOString(),
  };
}
