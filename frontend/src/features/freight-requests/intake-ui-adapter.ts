import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import type { FreightRequestExecutionIntent } from "./execution-intent-contracts";
import {
  fetchFreightRequestIntake,
} from "./intake-client";
import type { FreightRequestIntakeViewModel } from "./intake-contracts";

export const DEFAULT_INTAKE_REQUEST_CODE = "FR-1042";
export const INTAKE_VISUAL_SCENARIO = "fixture";

function joinPresent(parts: Array<string | null>) {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export function resolveIntakeRequestCode(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_INTAKE_REQUEST_CODE;
}

export function isIntakeVisualScenario(value: string | string[] | undefined) {
  return value === INTAKE_VISUAL_SCENARIO;
}

export function mapFreightRequestIntakeToForm(
  intake: FreightRequestIntakeViewModel,
): FreightIntakeModel {
  return {
    source: "persisted",
    freightRequestId: intake.freightRequestId,
    requestId: intake.requestCode,
    organizationId: intake.organization.id,
    organization: intake.organization.name,
    operatorMemberId: intake.currentOperator.memberId,
    requester: intake.currentOperator.displayName,
    status: intake.status,
    updatedAt: intake.updatedAt,
    currency: intake.organization.defaultCurrency,
    cargoProfile: intake.cargo.profileName ?? "",
    originCountry: "",
    originCity: "",
    originAddress: "",
    origin: intake.route.origin,
    destinationCountry: "",
    destinationCity: "",
    destinationAddress: "",
    destination: intake.route.destination,
    pickupContactName: intake.route.pickupContact.name ?? "",
    pickupContactPhone: intake.route.pickupContact.phone ?? "",
    pickupContact: joinPresent([
      intake.route.pickupContact.name,
      intake.route.pickupContact.phone,
    ]),
    receiverName: intake.route.deliveryContact.name ?? "",
    receiverCompany: intake.route.deliveryContact.company ?? "",
    receiverPhone: intake.route.deliveryContact.phone ?? "",
    deliveryContact: joinPresent([
      intake.route.deliveryContact.name,
      intake.route.deliveryContact.company,
      intake.route.deliveryContact.phone,
    ]),
    borderCrossing: "",
    operationalNotes: intake.route.operationalNotes ?? "",
    cargoCategory: intake.cargo.categoryName,
    cargoCategoryId: "",
    cargoCategoryCode: intake.cargo.categoryCode,
    cargoDescription: intake.cargo.categoryName,
    transportMode: intake.execution.transportMode,
    serviceType: intake.execution.serviceType,
    entryMethod: intake.cargo.entryMethod,
    quantity: intake.cargo.quantity,
    unitsPerEntry: intake.cargo.unitsPerEntry,
    unitWeightKg: intake.cargo.unitWeightKg,
    lengthCm: intake.cargo.lengthCm,
    widthCm: intake.cargo.widthCm,
    heightCm: intake.cargo.heightCm,
    totalWeightKg: intake.cargo.totalWeightKg,
    totalVolumeM3: intake.cargo.totalVolumeM3,
    cargoWeightKg: intake.cargo.totalWeightKg,
    cargoVolumeM3: intake.cargo.totalVolumeM3,
    pickupMode: intake.execution.pickupMode,
    requiredPickup: intake.execution.requiredPickup,
    pickupWindowStart: intake.execution.pickupWindowStart ?? "",
    pickupWindowEnd: intake.execution.pickupWindowEnd ?? "",
    deliveryDeadline: intake.execution.deliveryDeadline ?? "",
    budgetMaxUsd: intake.execution.budgetMax,
    strategy: intake.execution.strategy,
    documents: [...intake.execution.availableDocuments],
    draftVersion: 0,
    recommendationValues: {},
  };
}

export async function loadPersistedFreightIntake(
  requestCode: string,
  fetcher: typeof fetch = fetch,
) {
  return mapFreightRequestIntakeToForm(
    await fetchFreightRequestIntake(requestCode, fetcher),
  );
}

export function getFreightIntakeDispatchBlockReason(model: FreightIntakeModel) {
  if (model.source !== "persisted") {
    return "El escenario fixture es exclusivamente visual y no puede iniciar un dispatch real.";
  }
  if (model.status !== "PENDING") {
    return `La solicitud está en estado ${model.status} y no puede iniciar una nueva evaluación.`;
  }
  if (model.totalVolumeM3 === null || model.totalVolumeM3 <= 0) {
    return "La solicitud no tiene un volumen canónico compatible con el runner actual.";
  }
  return null;
}

export function assertFreshIntakeCorrelation(
  initial: FreightIntakeModel,
  fresh: FreightIntakeModel,
) {
  if (
    initial.source !== "persisted" ||
    fresh.source !== "persisted" ||
    initial.requestId !== fresh.requestId ||
    initial.freightRequestId !== fresh.freightRequestId ||
    initial.organizationId !== fresh.organizationId ||
    initial.operatorMemberId !== fresh.operatorMemberId
  ) {
    throw new Error(
      "INTAKE_CONTEXT_CHANGED: La solicitud o el contexto autenticado cambió; recarga antes de continuar.",
    );
  }
}

export function assertExecutionIntentCorrelation(
  intake: FreightIntakeModel,
  executionIntent: FreightRequestExecutionIntent,
) {
  if (
    executionIntent.freightRequestId !== intake.freightRequestId ||
    executionIntent.requestCode !== intake.requestId ||
    executionIntent.status !== "PENDING"
  ) {
    throw new Error(
      "INVALID_EXECUTION_INTENT: La intención no corresponde a la solicitud cargada.",
    );
  }
}
