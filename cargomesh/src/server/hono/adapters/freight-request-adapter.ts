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
 *   - Unitized methods derive weight from entryQuantity × unitsPerEntry × entryUnitWeightKg
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

  fields.cargoCategoryCode = input.cargoCategoryCode ?? "MACHINERY";

  // ── Origin ──────────────────────────────────────────────────────────────
  fields.originCountry = input.originCountry.toUpperCase() as SupportedCountryCode;
  fields.originCity = input.originCity;
  fields.originRegion = input.originRegion ?? null;
  fields.originAddress = input.originAddress ?? null;
  fields.pickupContactName = input.pickupContactName ?? null;
  fields.pickupContactPhone = input.pickupContactPhone ?? null;

  // ── Destination ──────────────────────────────────────────────────────────
  fields.destinationCountry = input.destinationCountry.toUpperCase() as SupportedCountryCode;
  fields.destinationCity = input.destinationCity;
  fields.destinationRegion = input.destinationRegion ?? null;
  fields.destinationAddress = input.destinationAddress ?? null;
  fields.receiverName = input.receiverName ?? null;
  fields.receiverCompany = input.receiverCompany ?? null;
  fields.receiverPhone = input.receiverPhone ?? null;

  // ── Cargo ───────────────────────────────────────────────────────────────
  const cargoEntryMethod = input.cargoEntryMethod ?? "PALLETS";
  fields.cargoEntryMethod = cargoEntryMethod;
  if (cargoEntryMethod === "TOTAL_WEIGHT") {
    fields.totalWeightKg = input.cargoWeightKg;
  } else {
    fields.entryQuantity = input.packageCount;
    fields.unitsPerEntry = input.unitsPerEntry ?? 1;
    fields.entryUnitWeightKg = input.entryUnitWeightKg
      ?? Math.round((input.cargoWeightKg / input.packageCount / fields.unitsPerEntry) * 100) / 100;
    if (input.entryLengthCm !== undefined && input.entryLengthCm !== null) {
      fields.entryLengthCm = input.entryLengthCm;
    }
    if (input.entryWidthCm !== undefined && input.entryWidthCm !== null) {
      fields.entryWidthCm = input.entryWidthCm;
    }
    if (input.entryHeightCm !== undefined && input.entryHeightCm !== null) {
      fields.entryHeightCm = input.entryHeightCm;
    }
  }

  // ── Budget ────────────────────────────────────────────────────────────────
  if (input.budgetUsd !== undefined && input.budgetUsd !== null) {
    fields.budgetMax = input.budgetUsd;
  }

  // ── Cargo description ─────────────────────────────────────────────────────
  if (input.cargoDescription !== undefined && input.cargoDescription !== null) {
    fields.cargoDescription = input.cargoDescription;
  }
  fields.specialInstructions = input.specialInstructions ?? null;
  fields.availableDocuments = input.availableDocuments ?? [];

  // ── Schedule ────────────────────────────────────────────────────────────
  fields.pickupMode = input.pickupMode ?? "ASAP";
  fields.pickupWindowStart = input.pickupWindowStart ?? null;
  fields.pickupWindowEnd = input.pickupWindowEnd ?? null;
  fields.deliveryDeadline = input.deliveryDeadline ?? null;

  // ── Special handling flags ────────────────────────────────────────────────
  // Only set when true — false flags remain unset and the service uses the template default
  if (input.requiresRefrigeration === true) {
    fields.requiresRefrigeration = true;
    fields.temperatureMinC = input.temperatureMinC ?? null;
    fields.temperatureMaxC = input.temperatureMaxC ?? null;
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
  // cargoVolumeM3  — no direct field; derived from entry dimensions

  return { fields };
}
