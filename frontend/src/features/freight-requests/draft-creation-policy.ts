import {
  RecommendationDraftError,
  invalidInput,
  isRecord,
} from "@/features/recommendations/recommendation-draft-contracts";
import {
  parseManualFreightRequestIntakeFields,
  type ManualFreightRequestIntakeFields,
  type OfficialCargoCategoryCode,
} from "./manual-intake-contracts";
import {
  normalizeManualFreightRequestIntake,
  type ManualFreightRequestDraftRow,
} from "./manual-intake-normalizer";
import type { FreightRequestIntakeViewModel } from "./intake-contracts";
import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";

export type DraftCreationDependencies = {
  resolveMember: (options?: {
    organizationId?: string;
    requiredRole?: "OWNER" | "SUPERVISOR" | "REQUESTER";
  }) => Promise<AuthenticatedMemberContext>;
  resolveCargoCategoryId: (code: OfficialCargoCategoryCode) => Promise<string>;
  generateRequestCode: (organizationId: string) => Promise<string>;
  insertFreightRequest: (row: Record<string, unknown>) => Promise<{ id: string; code: string }>;
  loadIntake: (requestCode: string) => Promise<FreightRequestIntakeViewModel>;
};

const PROHIBITED_CLIENT_KEYS = [
  "organizationId",
  "organization_id",
  "memberId",
  "member_id",
  "operatorMemberId",
  "operator",
  "requesterMemberId",
  "requested_by_member_id",
  "requestCode",
  "code",
  "requestId",
  "draftVersion",
  "draft_version",
  "freightRequestId",
  "id",
  "status",
] as const;

export function parseCreateFreightRequestDraftInput(raw: unknown): { fields: ManualFreightRequestIntakeFields } {
  if (!isRecord(raw) || Object.keys(raw).length !== 1 || !("fields" in raw)) {
    throw invalidInput("El payload admite únicamente la clave 'fields'.");
  }
  if (!isRecord(raw.fields)) {
    throw invalidInput("fields debe ser un objeto.");
  }

  // Security guard: never accept server-assigned identity or metadata from client
  for (const key of PROHIBITED_CLIENT_KEYS) {
    if (Object.hasOwn(raw, key) || Object.hasOwn(raw.fields, key)) {
      throw invalidInput(`No se permite especificar '${key}' desde el cliente; es asignado por el servidor.`);
    }
  }

  // Reject active special requirements
  const clientFields = raw.fields as Record<string, unknown>;
  const hasActiveSpecial =
    clientFields.requiresRefrigeration === true ||
    (clientFields.temperatureMinC !== null && clientFields.temperatureMinC !== undefined) ||
    (clientFields.temperatureMaxC !== null && clientFields.temperatureMaxC !== undefined) ||
    clientFields.isHazardous === true ||
    clientFields.isOversized === true ||
    clientFields.isFragile === true;

  if (hasActiveSpecial) {
    throw new RecommendationDraftError(
      "UNSUPPORTED_SPECIAL_REQUIREMENTS",
      "Los controles especiales (frío, temperatura, hazmat, sobredimensionado, frágil) aún no cuentan con contrato de persistencia en el servidor.",
      422,
    );
  }

  // Strip inactive special flags before validation against whitelist
  const cleanedFields = { ...clientFields };
  delete cleanedFields.requiresRefrigeration;
  delete cleanedFields.temperatureMinC;
  delete cleanedFields.temperatureMaxC;
  delete cleanedFields.isHazardous;
  delete cleanedFields.isOversized;
  delete cleanedFields.isFragile;

  if (Object.keys(cleanedFields).length === 0) {
    return { fields: {} };
  }

  return { fields: parseManualFreightRequestIntakeFields(cleanedFields) };
}

export function createInitialDraftTemplateRow(
  organizationId: string,
  categoryId: string,
  now: Date = new Date(),
): ManualFreightRequestDraftRow {
  const pickupStart = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const pickupEnd = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  const deadline = new Date(now.getTime() + 96 * 3600 * 1000).toISOString();

  return {
    id: "00000000-0000-0000-0000-000000000000",
    code: "",
    organization_id: organizationId,
    draft_version: 1,
    cargo_category_id: categoryId,
    origin_country: "PE",
    origin_region: "Callao",
    origin_city: "Callao",
    origin_address: null,
    pickup_contact_name: null,
    pickup_contact_phone: null,
    destination_country: "CL",
    destination_region: "Región Metropolitana",
    destination_city: "Santiago",
    destination_address: null,
    receiver_name: null,
    receiver_company: null,
    receiver_phone: null,
    cargo_description: null,
    cargo_entry_method: "PALLETS",
    entry_quantity: 10,
    entry_unit_weight_kg: 800,
    units_per_entry: 1,
    entry_length_cm: 120,
    entry_width_cm: 100,
    entry_height_cm: 150,
    package_count: 10,
    cargo_specifications: {},
    requires_refrigeration: false,
    temperature_min_c: null,
    temperature_max_c: null,
    is_hazardous: false,
    is_fragile: false,
    is_oversized: false,
    is_high_value: false,
    is_stackable: true,
    special_instructions: null,
    pickup_mode: "SCHEDULED",
    pickup_window_start: pickupStart,
    pickup_window_end: pickupEnd,
    required_pickup: pickupStart,
    delivery_deadline: deadline,
    budget_max: 2000,
    optimization_strategy: "BALANCED",
    available_documents: [],
    cross_border: true,
    cargo_weight_kg: 8000,
    cargo_volume_m3: 18,
    service_type: "FTL",
    transport_mode: "ROAD",
    status: "DRAFT",
  };
}

export const MAX_REQUEST_CODE_INSERT_ATTEMPTS = 3;

export function isUniqueCodeViolation(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (err.code === "23505" || err.pgCode === "23505") return true;
    if (typeof err.message === "string") {
      const msg = err.message.toLowerCase();
      if (
        msg.includes("23505") ||
        msg.includes("freight_requests_code_key") ||
        (msg.includes("unique") && msg.includes("code")) ||
        (msg.includes("duplicate key") && msg.includes("code"))
      ) {
        return true;
      }
    }
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("23505") ||
      msg.includes("freight_requests_code_key") ||
      (msg.includes("unique") && msg.includes("code")) ||
      (msg.includes("duplicate key") && msg.includes("code"))
    ) {
      return true;
    }
  }
  return false;
}

export async function createFreightRequestDraftWithDependencies(
  rawInput: unknown,
  dependencies: DraftCreationDependencies,
  now: Date = new Date(),
): Promise<FreightRequestIntakeViewModel> {
  const parsedInput = parseCreateFreightRequestDraftInput(rawInput);

  // Authenticate and enforce active organization membership and SUPERVISOR role
  const member = await dependencies.resolveMember({ requiredRole: "SUPERVISOR" });
  if (member.status !== "ACTIVE") {
    throw new RecommendationDraftError("FORBIDDEN", "Se requiere una membresía activa.", 403);
  }

  // Resolve official cargo category code
  const categoryCode: OfficialCargoCategoryCode = parsedInput.fields.cargoCategoryCode || "MACHINERY";
  const categoryId = await dependencies.resolveCargoCategoryId(categoryCode);

  // Normalize canonical values against template
  const templateRow = createInitialDraftTemplateRow(member.organizationId, categoryId, now);
  const normalized = normalizeManualFreightRequestIntake(templateRow, parsedInput.fields, categoryId, now);

  let finalRequestCode = "";

  for (let attempt = 1; attempt <= MAX_REQUEST_CODE_INSERT_ATTEMPTS; attempt++) {
    const freightRequestId = crypto.randomUUID();
    const requestCode = await dependencies.generateRequestCode(member.organizationId);

    const insertRow = {
      id: freightRequestId,
      organization_id: member.organizationId,
      requested_by_member_id: member.memberId,
      code: requestCode,
      draft_version: 1,
      status: "DRAFT",
      cargo_category_id: categoryId,
      origin_country: normalized.normalized.fields.origin_country,
      origin_region: normalized.originRegion,
      origin_city: normalized.normalized.fields.origin_city,
      origin_address: normalized.normalized.fields.origin_address ?? null,
      destination_country: normalized.normalized.fields.destination_country,
      destination_region: normalized.destinationRegion,
      destination_city: normalized.normalized.fields.destination_city,
      destination_address: normalized.normalized.fields.destination_address ?? null,
      pickup_contact_name: normalized.normalized.fields.pickup_contact_name ?? null,
      pickup_contact_phone: normalized.normalized.fields.pickup_contact_phone ?? null,
      receiver_name: normalized.normalized.fields.receiver_name ?? null,
      receiver_company: normalized.normalized.fields.receiver_company ?? null,
      receiver_phone: normalized.normalized.fields.receiver_phone ?? null,
      cargo_description: normalized.normalized.fields.cargo_description ?? null,
      cargo_entry_method: normalized.normalized.fields.cargo_entry_method,
      entry_quantity: normalized.normalized.fields.entry_quantity ?? null,
      entry_unit_weight_kg: normalized.normalized.fields.entry_unit_weight_kg ?? null,
      units_per_entry: normalized.normalized.fields.units_per_entry ?? null,
      entry_length_cm: normalized.normalized.fields.entry_length_cm ?? null,
      entry_width_cm: normalized.normalized.fields.entry_width_cm ?? null,
      entry_height_cm: normalized.normalized.fields.entry_height_cm ?? null,
      cargo_weight_kg: normalized.normalized.cargoWeightKg,
      cargo_volume_m3: normalized.normalized.cargoVolumeM3,
      service_type: "FTL",
      transport_mode: "ROAD",
      requires_refrigeration: false,
      temperature_min_c: null,
      temperature_max_c: null,
      is_hazardous: false,
      is_fragile: false,
      is_oversized: false,
      is_high_value: false,
      is_stackable: true,
      special_instructions: normalized.normalized.fields.special_instructions ?? null,
      pickup_mode: normalized.normalized.fields.pickup_mode,
      required_pickup: normalized.requiredPickup,
      pickup_window_start: normalized.normalized.fields.pickup_window_start ?? null,
      pickup_window_end: normalized.normalized.fields.pickup_window_end ?? null,
      delivery_deadline: normalized.normalized.fields.delivery_deadline ?? null,
      budget_max: normalized.normalized.fields.budget_max ?? null,
      optimization_strategy: "BALANCED",
      available_documents: normalized.normalized.fields.available_documents,
      cross_border: normalized.normalized.fields.cross_border,
      cargo_specifications: {},
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    try {
      await dependencies.insertFreightRequest(insertRow);
      finalRequestCode = requestCode;
      break;
    } catch (error) {
      if (isUniqueCodeViolation(error)) {
        if (attempt < MAX_REQUEST_CODE_INSERT_ATTEMPTS) {
          continue;
        }
        throw new RecommendationDraftError(
          "REQUEST_CODE_COLLISION",
          "Conflicto de concurrencia al asignar el código de solicitud. Por favor, reintenta.",
          409,
        );
      }
      throw error;
    }
  }

  return dependencies.loadIntake(finalRequestCode);
}

export { RecommendationDraftError };
