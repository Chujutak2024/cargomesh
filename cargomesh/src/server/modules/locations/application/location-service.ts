import { z } from "zod";
import { LocationCandidateV2Schema, LocationResolutionInputV2Schema, LocationConfirmationInputV2Schema,
  LocationResolutionV2Schema, type LocationQueryV2Schema } from "@/shared/schemas/v2/location-resolution";
import { V2DraftError, type V2Actor } from "../../freight-requests/application/draft-service";
export interface LocationRepositoryV2 {
  candidates(actor: V2Actor, query: z.infer<typeof LocationQueryV2Schema>): Promise<unknown[]>;
}
export class LocationServiceV2 {
  constructor(private readonly repository: LocationRepositoryV2) {}
  async resolve(actor: V2Actor, raw: unknown) {
    const { query } = LocationResolutionInputV2Schema.parse(raw);
    const rows = await this.repository.candidates(actor, query);
    const candidates = rows.slice(0, 50).map(row => LocationCandidateV2Schema.parse(row));
    return { schemaVersion: "2.0" as const, data: LocationResolutionV2Schema.parse({
      status: rows.length === 0 ? "NO_MATCH" : rows.length === 1 ? "CONFIRMATION_REQUIRED" : "AMBIGUOUS",
      candidates, truncated: rows.length > 50, confirmationRequired: true,
      source: "PERSISTED_CARGOMESH_LOCATIONS", externalGeocoderUsed: false,
    }) };
  }
  async confirm(actor: V2Actor, raw: unknown) {
    const input = LocationConfirmationInputV2Schema.parse(raw);
    const rows = await this.repository.candidates(actor, input.query);
    const candidate = rows.map(row => LocationCandidateV2Schema.parse(row))
      .find(row => row.id === input.candidateId && row.kind === input.candidateKind);
    if (!candidate) throw new V2DraftError("LOCATION_NOT_FOUND", "Select an authorized location from the current results.", 404);
    if (candidate.version !== input.expectedVersion) throw new V2DraftError("STALE_DRAFT", "The saved location changed. Resolve it again.", 409);
    return { schemaVersion: "2.0" as const, data: { ...candidate, confirmed: true as const,
      confirmedByMemberId: actor.memberId, organizationId: actor.organizationId } };
  }
}
