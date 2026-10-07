import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import type { RecommendationProposedFields } from "./contracts";
import type { FreightRequestDraft } from "./recommendation-draft-contracts";
import {
  applyRecommendationFieldsToIntake,
  canonicalValuesFromIntake,
} from "./recommendation-ui-policy";

export type PersistRecommendationAcceptanceInput = {
  freightRequestId: string;
  draftVersion: number;
  acceptedFields: RecommendationProposedFields;
};

export type PersistRecommendationAcceptance = (
  input: PersistRecommendationAcceptanceInput,
  signal: AbortSignal,
) => Promise<FreightRequestDraft>;

export class RecommendationAcceptanceError extends Error {
  constructor(
    readonly code: "STALE_DRAFT" | "INVALID_CANONICAL_DRAFT" | "D1_01_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "RecommendationAcceptanceError";
  }
}

export async function persistAndRevalidateRecommendation(
  current: FreightIntakeModel,
  acceptedFields: RecommendationProposedFields,
  persist: PersistRecommendationAcceptance,
  signal: AbortSignal,
): Promise<FreightIntakeModel> {
  const draft = await persist({
    freightRequestId: current.freightRequestId,
    draftVersion: current.draftVersion,
    acceptedFields,
  }, signal);

  if (
    draft.freightRequestId !== current.freightRequestId ||
    !Number.isInteger(draft.draftVersion) ||
    draft.draftVersion <= current.draftVersion
  ) {
    throw new RecommendationAcceptanceError(
      "INVALID_CANONICAL_DRAFT",
      "D1-01 devolvió un borrador no correlacionado o sin una versión nueva.",
    );
  }

  if (
    !Number.isFinite(draft.normalized.cargoWeightKg) ||
    draft.normalized.cargoWeightKg <= 0 ||
    !Number.isFinite(draft.normalized.cargoVolumeM3) ||
    (draft.normalized.cargoVolumeM3 ?? 0) <= 0
  ) {
    throw new RecommendationAcceptanceError(
      "INVALID_CANONICAL_DRAFT",
      "D1-01 no devolvió peso y volumen canónicos válidos.",
    );
  }

  const persisted = applyFreightRequestDraftToIntake(current, draft);
  const canonical = canonicalValuesFromIntake(persisted);
  for (const [field, expected] of Object.entries(acceptedFields)) {
    if (JSON.stringify(canonical[field as keyof RecommendationProposedFields]) !== JSON.stringify(expected)) {
      throw new RecommendationAcceptanceError(
        "INVALID_CANONICAL_DRAFT",
        `D1-01 no confirmó el campo canónico ${field}.`,
      );
    }
  }
  return persisted;
}

export function applyFreightRequestDraftToIntake(
  current: FreightIntakeModel,
  draft: FreightRequestDraft,
): FreightIntakeModel {
  const cargoVolumeM3 = draft.normalized.cargoVolumeM3;
  if (!Number.isFinite(cargoVolumeM3) || (cargoVolumeM3 ?? 0) <= 0) {
    throw new RecommendationAcceptanceError(
      "INVALID_CANONICAL_DRAFT",
      "D1-01 no devolvió un volumen canónico válido.",
    );
  }

  const preservesCategoryPresentation =
    draft.fields.cargo_category_id === current.cargoCategoryId;
  const canonicalBase: FreightIntakeModel = {
    ...current,
    freightRequestId: draft.freightRequestId,
    requestId: draft.requestCode,
    draftVersion: draft.draftVersion,
    originCountry: "",
    originCity: "",
    originAddress: "",
    origin: "",
    destinationCountry: "",
    destinationCity: "",
    destinationAddress: "",
    destination: "",
    pickupContactName: "",
    pickupContactPhone: "",
    pickupContact: "",
    receiverName: "",
    receiverCompany: "",
    receiverPhone: "",
    deliveryContact: "",
    borderCrossing: "",
    cargoCategory: preservesCategoryPresentation ? current.cargoCategory : "",
    cargoCategoryId: "",
    cargoCategoryCode: preservesCategoryPresentation ? current.cargoCategoryCode : "",
    cargoDescription: "",
    entryMethod: "",
    quantity: 0,
    unitWeightKg: 0,
    unitsPerEntry: 0,
    totalWeightKg: draft.normalized.cargoWeightKg,
    totalVolumeM3: cargoVolumeM3 as number,
    cargoWeightKg: draft.normalized.cargoWeightKg,
    cargoVolumeM3: cargoVolumeM3 as number,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    pickupMode: "ASAP",
    requiredPickup: "",
    pickupWindowStart: "",
    pickupWindowEnd: "",
    deliveryDeadline: "",
    budgetMaxUsd: 0,
    strategy: "BALANCED",
    documents: [],
    recommendationValues: {},
  };
  const adopted = applyRecommendationFieldsToIntake(canonicalBase, draft.fields);
  return {
    ...adopted,
    requiredPickup:
      adopted.pickupMode === "SCHEDULED" ? adopted.pickupWindowStart : "",
  };
}
