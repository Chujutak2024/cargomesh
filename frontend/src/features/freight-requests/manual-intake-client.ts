import {
  parseFreightRequestIntakeViewModel,
  type FreightRequestIntakeViewModel,
} from "./intake-contracts";
import {
  OFFICIAL_CARGO_CATEGORY_CODES,
  SUPPORTED_COUNTRY_CODES,
  type ManualFreightRequestIntakeFields,
  type ManualFreightRequestIntakeInput,
  type OfficialCargoCategoryCode,
  type SupportedCountryCode,
} from "./manual-intake-contracts";
import type { FreightIntakeModel } from "@/features/freight-ui/view-models";

export class ManualFreightRequestIntakeClientError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ManualFreightRequestIntakeClientError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new ManualFreightRequestIntakeClientError(
      "MANUAL_INTAKE_UNAVAILABLE",
      "El guardado manual devolvió una respuesta no válida.",
    );
  }
}

export const DOCUMENT_LABEL_TO_CANONICAL_CODE: Record<string, string> = {
  "factura comercial": "commercial_invoice",
  "commercial_invoice": "commercial_invoice",
  "packing list": "packing_list",
  "lista de empaque": "packing_list",
  "lista de empaque (packing list)": "packing_list",
  "packing_list": "packing_list",
  "certificado de origen": "certificate_of_origin",
  "certificate_of_origin": "certificate_of_origin",
  "ficha técnica": "technical_datasheet",
  "ficha tecnica": "technical_datasheet",
  "technical_datasheet": "technical_datasheet",
};

export function mapDocumentToCanonicalCode(doc: string): string {
  const normalized = doc.trim().toLowerCase();
  return DOCUMENT_LABEL_TO_CANONICAL_CODE[normalized] || normalized.replace(/[\s-]+/g, "_");
}

export function buildManualIntakeFieldsFromForm(
  form: FreightIntakeModel,
): ManualFreightRequestIntakeFields {
  const code: OfficialCargoCategoryCode = OFFICIAL_CARGO_CATEGORY_CODES.includes(
    form.cargoCategoryCode as OfficialCargoCategoryCode,
  )
    ? (form.cargoCategoryCode as OfficialCargoCategoryCode)
    : form.cargoCategory?.toUpperCase().includes("MAQ")
      ? "MACHINERY"
      : form.cargoCategory?.toUpperCase().includes("AGRI")
        ? "AGRICULTURAL"
        : form.cargoCategory?.toUpperCase().includes("CONST")
          ? "CONSTRUCTION"
          : "GENERAL";

  const originCountry: SupportedCountryCode = (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(
    form.originCountry,
  )
    ? (form.originCountry as SupportedCountryCode)
    : "PE";
  const destinationCountry: SupportedCountryCode = (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(
    form.destinationCountry,
  )
    ? (form.destinationCountry as SupportedCountryCode)
    : "CL";

  const isTotalWeight = form.entryMethod === "TOTAL_WEIGHT";
  const cargoEntryMethod = isTotalWeight ? "TOTAL_WEIGHT" : (form.entryMethod || "PALLETS");

  const fields: ManualFreightRequestIntakeFields = {
    cargoCategoryCode: code,
    originCountry,
    originRegion: form.originRegion || null,
    originCity: form.originCity?.trim() || form.origin?.split(",")[0]?.trim() || "",
    originAddress: form.originAddress || null,
    destinationCountry,
    destinationRegion: form.destinationRegion || null,
    destinationCity: form.destinationCity?.trim() || form.destination?.split(",")[0]?.trim() || "",
    destinationAddress: form.destinationAddress || null,
    pickupContactName:
      form.pickupContactName || form.pickupContact?.split("(")[0]?.trim() || null,
    pickupContactPhone:
      form.pickupContactPhone ||
      form.pickupContact?.match(/\((.*?)\)/)?.[1]?.trim() ||
      null,
    receiverName:
      form.receiverName || form.deliveryContact?.split("·")[0]?.trim() || null,
    receiverCompany:
      form.receiverCompany ||
      form.deliveryContact?.split("·")[1]?.trim() ||
      null,
    receiverPhone:
      form.receiverPhone || form.deliveryContact?.split("·")[2]?.trim() || null,
    cargoDescription: form.cargoDescription || null,
    cargoEntryMethod,
    entryQuantity: isTotalWeight ? null : (form.quantity ?? null),
    entryUnitWeightKg: isTotalWeight ? null : (form.unitWeightKg ?? null),
    unitsPerEntry: isTotalWeight ? null : (form.unitsPerEntry ?? null),
    entryLengthCm: isTotalWeight ? null : (form.lengthCm ?? null),
    entryWidthCm: isTotalWeight ? null : (form.widthCm ?? null),
    entryHeightCm: isTotalWeight ? null : (form.heightCm ?? null),
    requiresRefrigeration: form.requiresRefrigeration === true,
    temperatureMinC: form.requiresRefrigeration ? (form.temperatureMinC ?? null) : null,
    temperatureMaxC: form.requiresRefrigeration ? (form.temperatureMaxC ?? null) : null,
    isHazardous: form.isHazardous === true,
    isOversized: form.isOversized === true,
    isFragile: form.isFragile === true,
    pickupMode: form.pickupMode === "ASAP" ? "ASAP" : "SCHEDULED",
    pickupWindowStart:
      form.pickupMode === "SCHEDULED" && form.pickupWindowStart
        ? form.pickupWindowStart
        : null,
    pickupWindowEnd:
      form.pickupMode === "SCHEDULED" && form.pickupWindowEnd
        ? form.pickupWindowEnd
        : null,
    deliveryDeadline: form.deliveryDeadline || null,
    budgetMax: form.budgetMaxUsd ?? null,
    specialInstructions: form.operationalNotes || null,
    availableDocuments: (form.documents || []).map(mapDocumentToCanonicalCode),
  };

  if (isTotalWeight && form.totalWeightKg !== null && form.totalWeightKg !== undefined) {
    fields.totalWeightKg = form.totalWeightKg;
  }

  return fields;
}

export async function persistManualFreightRequestIntake(
  freightRequestId: string,
  input: ManualFreightRequestIntakeInput,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<FreightRequestIntakeViewModel> {
  const response = await request(
    `/api/freight-requests/${encodeURIComponent(freightRequestId)}/manual-intake`,
    {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(input),
      signal,
    },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    const code = typeof error.code === "string"
      ? error.code
      : "MANUAL_INTAKE_UNAVAILABLE";
    const message = typeof error.message === "string"
      ? error.message
      : "No fue posible guardar el borrador manual.";
    throw new ManualFreightRequestIntakeClientError(code, message);
  }
  if (!isRecord(payload) || payload.ok !== true || !Object.hasOwn(payload, "data")) {
    throw new ManualFreightRequestIntakeClientError(
      "INVALID_CANONICAL_INTAKE",
      "El servidor no devolvió el intake canónico.",
    );
  }
  return parseFreightRequestIntakeViewModel(payload.data);
}
