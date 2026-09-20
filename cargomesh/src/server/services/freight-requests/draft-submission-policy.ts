import { RecommendationDraftError } from "@/features/recommendations/recommendation-draft-contracts";
import type { FreightRequestDraftRow } from "@/features/recommendations/recommendation-draft-contracts";
import type { FreightRequestIntakeViewModel } from "@/features/freight-requests/intake-contracts";
import type { AuthenticatedMemberContext } from "@/server/auth/member";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SubmitFreightRequestDraftInput = {
  draftVersion: number;
};

export type DraftSubmissionDependencies = {
  resolveMember: (options?: {
    organizationId?: string;
    requiredRole?: "SUPERVISOR" | "OWNER";
  }) => Promise<AuthenticatedMemberContext>;
  findDraft: (id: string) => Promise<FreightRequestDraftRow | null>;
  validateCargoCategory: (categoryId: string) => Promise<boolean>;
  updateStatusToPending: (
    current: FreightRequestDraftRow,
    newVersion: number,
  ) => Promise<FreightRequestDraftRow | null>;
  loadIntake: (requestCode: string) => Promise<FreightRequestIntakeViewModel>;
};

/**
 * Pure domain use case: Validates minimum required fields (origin, destination, cargo type,
 * weight, and pickup) and atomically transitions a FreightRequest from DRAFT to PENDING,
 * incrementing draft_version by +1 and preserving the immutable creation receipt.
 */
export async function submitFreightRequestDraftWithDependencies(
  freightRequestId: string,
  rawInput: unknown,
  deps: DraftSubmissionDependencies,
): Promise<FreightRequestIntakeViewModel> {
  // 1. Validate ID format
  if (!UUID_REGEX.test(freightRequestId)) {
    throw new RecommendationDraftError(
      "INVALID_ARGUMENT",
      "freightRequestId debe ser un UUID válido.",
      400,
    );
  }

  // 2. Validate input schema
  let draftVersion: number;
  if (
    typeof rawInput === "object" &&
    rawInput !== null &&
    "draftVersion" in rawInput &&
    typeof (rawInput as { draftVersion: unknown }).draftVersion === "number" &&
    Number.isInteger((rawInput as { draftVersion: number }).draftVersion) &&
    (rawInput as { draftVersion: number }).draftVersion >= 1
  ) {
    draftVersion = (rawInput as { draftVersion: number }).draftVersion;
  } else {
    throw new RecommendationDraftError(
      "INVALID_ARGUMENT",
      "draftVersion debe ser un entero positivo.",
      400,
    );
  }

  // 3. Authenticate and authorize member (must be ACTIVE SUPERVISOR or OWNER)
  const member = await deps.resolveMember({ requiredRole: "SUPERVISOR" });
  if (
    member.status !== "ACTIVE" ||
    !["OWNER", "SUPERVISOR"].includes(member.role)
  ) {
    throw new RecommendationDraftError(
      "FORBIDDEN",
      "Se requiere un rol de gestión activo (SUPERVISOR u OWNER).",
      403,
    );
  }

  // 4. Retrieve current draft row
  const current = await deps.findDraft(freightRequestId);
  if (!current) {
    throw new RecommendationDraftError(
      "NOT_FOUND",
      "La solicitud de flete no existe.",
      404,
    );
  }

  // 5. Tenant isolation check
  if (current.organization_id !== member.organizationId) {
    throw new RecommendationDraftError(
      "FORBIDDEN",
      "La sesión no puede acceder a esta solicitud de flete.",
      403,
    );
  }

  // 6. Optimistic concurrency check
  if (current.draft_version !== draftVersion) {
    throw new RecommendationDraftError(
      "STALE_DRAFT",
      "El borrador cambió; recárgalo antes de enviar.",
      409,
    );
  }

  // 7. Idempotent replay: if already in PENDING state, return existing intake snapshot
  if (current.status === "PENDING") {
    return deps.loadIntake(current.code);
  }

  // 8. Workflow status guard: can only transition from DRAFT to PENDING
  if (current.status !== "DRAFT") {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      `La solicitud ya no acepta envíos (estado actual: ${current.status}).`,
      422,
    );
  }

  // 9. Semantic validation of required fields for PENDING transition (DoD)
  // Origin check
  if (
    !current.origin_city ||
    !current.origin_city.trim() ||
    !current.origin_country ||
    !current.origin_country.trim()
  ) {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      "El borrador requiere ciudad y país de origen válidos para ser enviado.",
      422,
    );
  }

  // Destination check
  if (
    !current.destination_city ||
    !current.destination_city.trim() ||
    !current.destination_country ||
    !current.destination_country.trim()
  ) {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      "El borrador requiere ciudad y país de destino válidos para ser enviado.",
      422,
    );
  }

  // Cargo category check
  if (!current.cargo_category_id || !current.cargo_category_id.trim()) {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      "El borrador requiere una categoría de carga para ser enviado.",
      422,
    );
  }

  const categoryExists = await deps.validateCargoCategory(
    current.cargo_category_id,
  );
  if (!categoryExists) {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      "La categoría de carga especificada no existe o no está disponible.",
      422,
    );
  }

  // Cargo weight check
  if (
    typeof current.cargo_weight_kg !== "number" ||
    current.cargo_weight_kg <= 0
  ) {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      "El borrador requiere un peso de carga mayor a 0 kg.",
      422,
    );
  }

  // Required pickup check
  if (!current.required_pickup) {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      "El borrador requiere una fecha o ventana de recojo válida.",
      422,
    );
  }

  // 10. Atomic transition: status -> PENDING, draft_version + 1, updated_at -> now
  // Immutable creation receipt (creation_idempotency_key, creation_payload_hash) is untouched.
  const newVersion = current.draft_version + 1;
  const updated = await deps.updateStatusToPending(current, newVersion);
  if (!updated) {
    throw new RecommendationDraftError(
      "STALE_DRAFT",
      "El borrador cambió concurrentemente; no se completó la transición.",
      409,
    );
  }

  // 11. Return freshly loaded intake projection
  return deps.loadIntake(updated.code);
}
