import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import type { RecommendationProposedFields } from "./contracts";
import { canonicalValuesFromIntake } from "./recommendation-ui-policy";

export type PersistRecommendationAcceptanceInput = {
  freightRequestId: string;
  draftVersion: number;
  acceptedFields: RecommendationProposedFields;
};

export type PersistRecommendationAcceptance = (
  input: PersistRecommendationAcceptanceInput,
  signal: AbortSignal,
) => Promise<FreightIntakeModel>;

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
  const persisted = await persist({
    freightRequestId: current.freightRequestId,
    draftVersion: current.draftVersion,
    acceptedFields,
  }, signal);

  if (
    persisted.freightRequestId !== current.freightRequestId ||
    !Number.isInteger(persisted.draftVersion) ||
    persisted.draftVersion <= current.draftVersion
  ) {
    throw new RecommendationAcceptanceError(
      "INVALID_CANONICAL_DRAFT",
      "D1-01 devolvió un borrador no correlacionado o sin una versión nueva.",
    );
  }

  if (
    !Number.isFinite(persisted.cargoWeightKg) ||
    persisted.cargoWeightKg <= 0 ||
    !Number.isFinite(persisted.cargoVolumeM3) ||
    persisted.cargoVolumeM3 <= 0
  ) {
    throw new RecommendationAcceptanceError(
      "INVALID_CANONICAL_DRAFT",
      "D1-01 no devolvió peso y volumen canónicos válidos.",
    );
  }

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
