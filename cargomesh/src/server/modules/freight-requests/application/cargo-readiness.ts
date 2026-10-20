import { CargoReadinessV2ResponseSchema } from "@/shared/schemas/v2/cargo-readiness";
import { cargoUnitTotalsV2 } from "@/shared/schemas/v2/freight-request";
import { ResourceEvidenceRequirementCodesV2 } from "@/shared/schemas/v2/intake-options";
import { getV2Draft, V2DraftError, type V2Actor, type V2DraftRepository } from "./draft-service";

/** Read only: capture completeness never implies carrier eligibility or a quote. */
export async function getCargoReadinessV2(id: string, expectedDraftVersion: number | undefined,
  actor: V2Actor, repository: V2DraftRepository) {
  if (expectedDraftVersion !== undefined && (!Number.isInteger(expectedDraftVersion) || expectedDraftVersion < 1)) {
    throw new V2DraftError("VALIDATION_ERROR", "expectedDraftVersion must be a positive integer.", 400);
  }
  const request = (await getV2Draft(id, actor, repository)).data;
  if (expectedDraftVersion !== undefined && expectedDraftVersion !== request.draftVersion) {
    throw new V2DraftError("STALE_DRAFT", "Draft version does not match.", 409);
  }
  const cargo = request.cargoSpecification;
  const missingFields = cargo.requirements.includes("TEMP_CONTROLLED") && !cargo.temperatureRange
    ? ["cargoSpecification.temperatureRange"] : [];
  const resourceEvidence = new Set<string>(ResourceEvidenceRequirementCodesV2);
  return CargoReadinessV2ResponseSchema.parse({
    schemaVersion: "2.0",
    data: {
      freightRequestId: request.id, evaluatedDraftVersion: request.draftVersion,
      captureStatus: missingFields.length ? "INCOMPLETE" : "COMPLETE", missingFields,
      requirements: [...new Set(cargo.requirements)].map((code) => ({ code,
        verification: resourceEvidence.has(code) ? "RESOURCE_EVIDENCE" : "REQUIRES_REVIEW" })),
      totals: cargoUnitTotalsV2(cargo.units), operationalStatus: "NOT_EVALUATED",
    },
  });
}
