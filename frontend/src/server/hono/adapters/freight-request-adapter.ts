/**
 * Adapter: CargoMesh V2 flat input → legacy service contract.
 *
 * The Hono V2 API accepts a flat, user-friendly payload.
 * The underlying service (createFreightRequestDraftWithDependencies) expects
 * exactly { fields: ManualFreightRequestIntakeFields } via
 * parseCreateFreightRequestDraftInput().
 *
 * This adapter performs the structural transformation without touching either
 * the public contract or the legacy service. It must stay in sync with
 * ManualFreightRequestIntakeFields in manual-intake-contracts.ts.
 *
 * IMPORTANT: Only map fields that ManualFreightRequestIntakeFields actually
 * supports. Do NOT pass transportMode / serviceType / strategy here — the
 * service hardcodes those to ROAD / FTL / BALANCED and they are not accepted
 * in the fields object (they are prohibited keys or ignored silently).
 *
 * Auth note: organizationId and memberId are assigned server-side by the
 * service. They must NEVER appear in the fields object (PROHIBITED_CLIENT_KEYS).
 */

import type {
  ManualFreightRequestIntakeFields,
  OfficialCargoCategoryCode,
  SupportedCountryCode,
} from "@/features/freight-requests/manual-intake-contracts";
import type { CreateFreightRequestInput } from "@/shared/schemas/freight-request";

/**
 * The exact shape the legacy service parser expects.
 * parseCreateFreightRequestDraftInput enforces: exactly one key "fields".
 */
export type LegacyCreateFreightRequestInput = {
  fields: ManualFreightRequestIntakeFields;
};

/**
 * Converts the V2 flat public input to the legacy { fields: ... } contract.
 *
 * Rules:
 * - Only fields in ManualFreightRequestIntakeFields are mapped.
 * - Optional fields are included only when explicitly provided.
 * - transportMode / serviceType / strategy are intentionally excluded
 *   (service controls these; they are not in ManualFreightRequestIntakeFields).
 * - Country codes are uppercased to match SupportedCountryCode.
 */
export function adaptV2ToLegacyService(
  input: CreateFreightRequestInput,
): LegacyCreateFreightRequestInput {
  const fields: ManualFreightRequestIntakeFields = {};

  // ── Origin ──────────────────────────────────────────────────────────────
  fields.originCountry = input.originCountry.toUpperCase() as SupportedCountryCode;
  fields.originCity = input.originCity;

  // ── Destination ──────────────────────────────────────────────────────────
  fields.destinationCountry = input.destinationCountry.toUpperCase() as SupportedCountryCode;
  fields.destinationCity = input.destinationCity;

  // ── Cross-border flag ─────────────────────────────────────────────────────
  // Note: ManualFreightRequestIntakeFields does not expose cross_border directly.
  // The normalizer derives it from origin/destination country pair. No mapping needed.

  // ── Cargo weight ──────────────────────────────────────────────────────────
  // totalWeightKg maps directly to the template override.
  fields.totalWeightKg = input.cargoWeightKg;

  // ── Package count expressed as entry quantity for PALLETS entry method ────
  // The service default entry method is PALLETS; entry_quantity ≈ package_count.
  fields.entryQuantity = input.packageCount;

  // ── Budget ────────────────────────────────────────────────────────────────
  if (input.budgetUsd !== undefined && input.budgetUsd !== null) {
    fields.budgetMax = input.budgetUsd;
  }

  // ── Cargo description ─────────────────────────────────────────────────────
  if (input.cargoDescription !== undefined && input.cargoDescription !== null) {
    fields.cargoDescription = input.cargoDescription;
  }

  // ── Special handling flags ────────────────────────────────────────────────
  if (input.requiresRefrigeration === true) {
    fields.requiresRefrigeration = true;
  }
  if (input.isHazardous === true) {
    fields.isHazardous = true;
  }
  if (input.isFragile === true) {
    fields.isFragile = true;
  }
  if (input.isOversized === true) {
    fields.isOversized = true;
  }

  // ── Volume ────────────────────────────────────────────────────────────────
  // cargoVolumeM3 has no direct field in ManualFreightRequestIntakeFields.
  // The normalizer derives volume from entry dimensions (entryLengthCm, etc.).
  // For the V2 bootstrap we do not map it here; it will use the template default.
  // TODO(v2): add volume mapping when the V2 schema supports dimensional input.

  return { fields };
}
