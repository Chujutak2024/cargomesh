import type { FreightRequestV2Data, IntakeOptionsData } from "./contracts";
import { mapDraftToCreateFreightRequestV2Input, mapDraftToRevisionInput, type V2IntakePrototypeDraft } from "./prototype-model";

/** The voice channel may prepare a payload, but only the validated intake mapper defines it. */
export function prepareSpokenRequestJson(draft: V2IntakePrototypeDraft, options: IntakeOptionsData, routeConflict: boolean, declaredTotalKg: number | null = null, request: FreightRequestV2Data | null = null) {
  if (routeConflict) return null;
  try {
    const payload = request ? mapDraftToRevisionInput(draft, options, request) : mapDraftToCreateFreightRequestV2Input(draft, options);
    if (declaredTotalKg !== null && Math.abs(payload.cargoSpecification.totalWeightKg - declaredTotalKg) > 0.001) return null;
    return payload;
  }
  catch { return null; }
}
