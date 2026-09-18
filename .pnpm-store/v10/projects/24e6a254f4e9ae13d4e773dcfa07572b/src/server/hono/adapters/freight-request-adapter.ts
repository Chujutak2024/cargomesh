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
 * ManualFreightRequestIntakeFields in manual-intake-contracts.ts and with
 * the normalizer's validation rules in manual-intake-normalizer.ts.
 *
 * KEY MAPPING RULE (from normalizer):
 *   - totalWeightKg is only valid when cargoEntryMethod === "TOTAL_WEIGHT"
 *   - The service template defaults to cargoEntryMethod = "PALLETS"
 *   - For PALLETS, weight is derived from entryQuantity × entryUnitWeightKg
 *   - So we NEVER set totalWeightKg; instead we set entryQuantity + entryUnitWeightKg
 *
 * Auth note: organizationId and memberId are assigned server-side. They must
 * NEVER appear in the fields object (PROHIBITED_CLIENT_KEYS guard in the policy).
 */

import type {
  ManualFreightRequestIntakeFields,
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
 * - totalWeightKg is intentionally excluded: the service template uses PALLETS
 *   entry method, and totalWeightKg is only valid with TOTAL_WEIGHT entry method.
 *   Weight is expressed as entryUnitWeightKg × entryQuantity instead.
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

  // ── Cargo weight — expressed as pallet units, NOT totalWeightKg ──────────
  // Reason: the service template defaults to PALLETS entry method.
  // The normalizer throws if totalWeightKg is set with a non-TOTAL_WEIGHT method.
  // We use entryQuantity (package count) + entryUnitWeightKg (weight per unit).
  // The service computes total weight as quantity × unitWeight.
  fields.entryQuantity = input.packageCount;
  if (input.packageCount > 0 && input.cargoWeightKg > 0) {
    // Round to 2 decimal places to avoid floating point noise
    fields.entryUnitWeightKg = Math.round((input.cargoWeightKg / input.packageCount) * 100) / 100;
  }

  // ── Budget ────────────────────────────────────────────────────────────────
  if (input.budgetUsd !== undefined && input.budgetUsd !== null) {
    fields.budgetMax = input.budgetUsd;
  }

  // ── Cargo description ─────────────────────────────────────────────────────
  if (input.cargoDescription !== undefined && input.cargoDescription !== null) {
    fields.cargoDescription = input.cargoDescription;
  }

  // ── Special handling flags ────────────────────────────────────────────────
  // Only set when true — false flags remain unset and the service uses the template default
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

  // ── Intentionally excluded ────────────────────────────────────────────────
  // transportMode  — service hardcodes ROAD, not in ManualFreightRequestIntakeFields
  // serviceType    — service hardcodes FTL, not in ManualFreightRequestIntakeFields
  // strategy       — service hardcodes BALANCED (optimization_strategy)
  // isCrossBorder  — service derives from origin/destination country pair
  // totalWeightKg  — only valid with TOTAL_WEIGHT entry method (see above)
  // cargoVolumeM3  — no direct field; derived from entry dimensions

  return { fields };
}
