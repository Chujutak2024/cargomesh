import type { FreightIntakeModel } from "./view-models";
import type { FreightRequestExecutionIntent } from "@/features/freight-requests/execution-intent-contracts";
import type {
  ProviderRunnerInputs,
} from "@/features/webmcp-runner/contracts";

export function createInt02aIdempotencyKey(freightRequestId: string) {
  return `cm:int02b:${freightRequestId}:${crypto.randomUUID()}`;
}

export function buildRealDispatchPath(runId: string) {
  return `/dispatch/${encodeURIComponent(runId)}`;
}

export function applyExecutionIntentToIntake(
  model: FreightIntakeModel,
  executionIntent: FreightRequestExecutionIntent,
): FreightIntakeModel {
  return {
    ...model,
    pickupMode: executionIntent.pickupMode,
    requiredPickup: executionIntent.requiredPickup,
    pickupWindowStart: executionIntent.pickupWindowStart ?? "",
    pickupWindowEnd: executionIntent.pickupWindowEnd ?? "",
    deliveryDeadline: executionIntent.deliveryDeadline ?? "",
  };
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

export function buildProviderRunnerInputs(
  model: FreightIntakeModel,
  executionIntent: FreightRequestExecutionIntent,
): ProviderRunnerInputs {
  const cargoWeightKg = model.quantity * model.unitWeightKg;
  const cargoVolumeM3 = model.quantity * model.lengthCm * model.widthCm * model.heightCm / 1_000_000;
  const schedule = buildPersistedSchedule(executionIntent);

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
      ...schedule,
    },
    quote_freight: {
      freight_request_id: model.freightRequestId,
      origin: model.origin,
      destination: model.destination,
      cargo_weight_kg: cargoWeightKg,
      cargo_volume_m3: cargoVolumeM3,
      cargo_category: model.cargoCategoryCode,
      ...schedule,
      available_documents: [...model.documents],
    },
  };
}

function buildPersistedSchedule(executionIntent: FreightRequestExecutionIntent) {
  if (
    executionIntent.pickupMode === "SCHEDULED" &&
    (!executionIntent.pickupWindowStart || !executionIntent.pickupWindowEnd)
  ) {
    throw new Error("SCHEDULED requiere inicio y fin de la ventana de recojo.");
  }

  return {
    pickup_mode: executionIntent.pickupMode,
    pickup_window_start: executionIntent.pickupWindowStart ?? undefined,
    pickup_window_end: executionIntent.pickupWindowEnd ?? undefined,
    delivery_deadline: executionIntent.deliveryDeadline ?? undefined,
  };
}
