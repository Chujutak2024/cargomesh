import type {
  AvailabilityClass,
  ProviderPageConfig,
  ProviderQuote,
  ProviderToolEnvelope,
  QuoteFreightInput,
} from "./contracts";

export const QUOTE_FREIGHT_TOOL_NAME = "quote_freight";

export const quoteFreightInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    freight_request_id: {
      type: "string",
      minLength: 1,
      description: "CargoMesh freight request identifier.",
    },
    origin: {
      type: "string",
      minLength: 2,
      description: "Origin city, region, and country.",
    },
    destination: {
      type: "string",
      minLength: 2,
      description: "Destination city, region, and country.",
    },
    cargo_weight_kg: {
      type: "number",
      exclusiveMinimum: 0,
      description: "Total cargo weight in kilograms.",
    },
    cargo_volume_m3: {
      type: "number",
      exclusiveMinimum: 0,
      description: "Optional total cargo volume in cubic metres.",
    },
    cargo_category: {
      type: "string",
      minLength: 1,
    },
    pickup_mode: {
      type: "string",
      enum: ["ASAP", "SCHEDULED"],
    },
    pickup_window_start: {
      type: "string",
      format: "date-time",
    },
    pickup_window_end: {
      type: "string",
      format: "date-time",
    },
    delivery_deadline: {
      type: "string",
      format: "date-time",
    },
    available_documents: {
      type: "array",
      items: { type: "string", minLength: 1 },
      uniqueItems: true,
    },
  },
  required: ["freight_request_id", "origin", "destination", "cargo_weight_kg"],
} as const;

type QuoteFixtureOverride = {
  providerOfferReference?: string;
  providerOfferReferencePrefix?: string;
  priceBreakdown: Record<string, number>;
  transitHours: number;
  availabilityClass: AvailabilityClass;
  requiredDocuments?: string[];
  enforceRequiredDocuments?: boolean;
};

// Golden Flow seed data only. Discovery and business logic never depend on these keys;
// an unlisted providerServiceCode receives the deterministic generic fixture below.
const quoteFixtureOverrides: Record<string, QuoteFixtureOverride> = {
  "ANDES-PECL-FTL": {
    providerOfferReference: "AND-OFF-8821",
    priceBreakdown: { lineHaul: 1500, handling: 115, customsCoordination: 145 },
    transitHours: 31,
    availabilityClass: "AVAILABLE_IN_WINDOW",
  },
  "INCA-PECL-FTL": {
    providerOfferReference: "INC-OFF-9042",
    priceBreakdown: { lineHaul: 1650, handling: 125, customsCoordination: 145 },
    transitHours: 29,
    availabilityClass: "AVAILABLE_IN_WINDOW",
  },
  "PACIFIC-PECL-FTL": {
    providerOfferReference: "PAC-OFF-3319",
    priceBreakdown: { lineHaul: 1320, handling: 125, customsCoordination: 145 },
    transitHours: 60,
    availabilityClass: "LIMITED_WINDOW",
  },
  "NEXO-DEMO-PE-DOM-FTL": {
    providerOfferReferencePrefix: "NEX-DOM",
    priceBreakdown: { lineHaul: 900, handling: 80, customsCoordination: 0 },
    transitHours: 24,
    availabilityClass: "EXACT_CONFIRMED_SLOT",
    requiredDocuments: [],
  },
  "NEXO-DEMO-PECL-AGR-FTL": {
    providerOfferReferencePrefix: "NEX-PECL",
    priceBreakdown: { lineHaul: 1180, handling: 95, customsCoordination: 145 },
    transitHours: 48,
    availabilityClass: "AVAILABLE_IN_WINDOW",
    requiredDocuments: ["commercial_invoice", "packing_list", "certificate_of_origin"],
    enforceRequiredDocuments: true,
  },
};

type ParsedInput =
  | { ok: true; value: QuoteFreightInput }
  | { ok: false; message: string };

export type QuoteFreightToolOptions = {
  now?: () => Date;
};

const allowedInputKeys = new Set([
  "freight_request_id",
  "origin",
  "destination",
  "cargo_weight_kg",
  "cargo_volume_m3",
  "cargo_category",
  "pickup_mode",
  "pickup_window_start",
  "pickup_window_end",
  "delivery_deadline",
  "available_documents",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidDateTime(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function parseQuoteFreightInput(rawInput: unknown): ParsedInput {
  if (!isRecord(rawInput)) {
    return { ok: false, message: "El payload debe ser un objeto JSON." };
  }

  const unknownKey = Object.keys(rawInput).find((key) => !allowedInputKeys.has(key));
  if (unknownKey) {
    return { ok: false, message: `El campo '${unknownKey}' no pertenece al contrato.` };
  }

  if (!isNonEmptyString(rawInput.freight_request_id)) {
    return { ok: false, message: "freight_request_id es obligatorio." };
  }
  if (!isNonEmptyString(rawInput.origin) || !isNonEmptyString(rawInput.destination)) {
    return { ok: false, message: "origin y destination son obligatorios." };
  }
  if (!isPositiveNumber(rawInput.cargo_weight_kg)) {
    return { ok: false, message: "cargo_weight_kg debe ser mayor que cero." };
  }
  if (rawInput.cargo_volume_m3 !== undefined && !isPositiveNumber(rawInput.cargo_volume_m3)) {
    return { ok: false, message: "cargo_volume_m3 debe ser mayor que cero." };
  }
  if (rawInput.cargo_category !== undefined && !isNonEmptyString(rawInput.cargo_category)) {
    return { ok: false, message: "cargo_category no puede estar vacío." };
  }
  if (
    rawInput.pickup_mode !== undefined &&
    rawInput.pickup_mode !== "ASAP" &&
    rawInput.pickup_mode !== "SCHEDULED"
  ) {
    return { ok: false, message: "pickup_mode debe ser ASAP o SCHEDULED." };
  }

  for (const field of [
    "pickup_window_start",
    "pickup_window_end",
    "delivery_deadline",
  ] as const) {
    const value = rawInput[field];
    if (value !== undefined && !isValidDateTime(value)) {
      return { ok: false, message: `${field} debe ser una fecha ISO 8601 válida.` };
    }
  }

  if (rawInput.pickup_mode === "SCHEDULED") {
    if (!isValidDateTime(rawInput.pickup_window_start) || !isValidDateTime(rawInput.pickup_window_end)) {
      return {
        ok: false,
        message: "SCHEDULED requiere pickup_window_start y pickup_window_end.",
      };
    }
    if (Date.parse(rawInput.pickup_window_end) <= Date.parse(rawInput.pickup_window_start)) {
      return { ok: false, message: "pickup_window_end debe ser posterior al inicio." };
    }
  }

  if (
    rawInput.available_documents !== undefined &&
    (!Array.isArray(rawInput.available_documents) ||
      !rawInput.available_documents.every(isNonEmptyString))
  ) {
    return { ok: false, message: "available_documents debe ser una lista de strings." };
  }

  return { ok: true, value: rawInput as QuoteFreightInput };
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeDocumentCode(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function deterministicTimeline(
  input: QuoteFreightInput,
  transitHours: number,
  issuedAt: Date,
) {
  const requestedPickup = input.pickup_window_start
    ? new Date(input.pickup_window_start)
    : new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000);
  const estimatedDelivery = new Date(
    requestedPickup.getTime() + transitHours * 60 * 60 * 1000,
  );
  const validUntil = new Date(issuedAt.getTime() + 6 * 60 * 60 * 1000);

  return {
    estimatedPickup: requestedPickup.toISOString(),
    estimatedDelivery: estimatedDelivery.toISOString(),
    validUntil: validUntil.toISOString(),
  };
}

function availabilityFor(utilization: number): AvailabilityClass {
  if (utilization <= 0.55) return "EXACT_CONFIRMED_SLOT";
  if (utilization <= 0.75) return "AVAILABLE_IN_WINDOW";
  if (utilization <= 0.9) return "LIMITED_WINDOW";
  return "WAITLIST";
}

function createErrorEnvelope(
  code: string,
  message: string,
  retryable = false,
): ProviderToolEnvelope<ProviderQuote> {
  return { ok: false, error: { code, message, retryable } };
}

function buildProviderQuote(
  provider: ProviderPageConfig,
  input: QuoteFreightInput,
  issuedAt: Date,
): ProviderToolEnvelope<ProviderQuote> {
  if (input.cargo_weight_kg > provider.service.maxCapacityKg) {
    return createErrorEnvelope(
      "CAPACITY_EXCEEDED",
      `La carga excede la capacidad declarada de ${provider.service.maxCapacityKg} kg.`,
    );
  }

  if (
    input.cargo_volume_m3 !== undefined &&
    provider.service.maxVolumeM3 !== null &&
    input.cargo_volume_m3 > provider.service.maxVolumeM3
  ) {
    return createErrorEnvelope(
      "VOLUME_EXCEEDED",
      `El volumen excede la capacidad declarada de ${provider.service.maxVolumeM3} m3.`,
    );
  }

  const fixtureSeed = stableHash(provider.service.providerServiceCode);
  const fixtureOverride = quoteFixtureOverrides[provider.service.providerServiceCode];
  const requiredDocuments = fixtureOverride?.requiredDocuments ??
    (provider.service.supportsCrossBorder ? ["commercial_invoice", "packing_list"] : []);

  if (fixtureOverride?.enforceRequiredDocuments) {
    const availableDocuments = new Set(
      (input.available_documents ?? []).map(normalizeDocumentCode),
    );
    const missingDocuments = requiredDocuments.filter(
      (documentCode) => !availableDocuments.has(normalizeDocumentCode(documentCode)),
    );

    if (missingDocuments.length > 0) {
      return createErrorEnvelope(
        "REQUIRED_DOCUMENTS_MISSING",
        `Faltan documentos requeridos por el fixture: ${missingDocuments.join(", ")}.`,
      );
    }
  }

  const utilization = input.cargo_weight_kg / provider.service.maxCapacityKg;
  const lineHaul = roundCurrency(620 + input.cargo_weight_kg * 0.105 + (fixtureSeed % 260));
  const handling = roundCurrency(85 + (fixtureSeed % 45));
  const customsCoordination = provider.service.supportsCrossBorder ? 145 : 0;
  const priceBreakdown = fixtureOverride?.priceBreakdown ?? {
    lineHaul,
    handling,
    customsCoordination,
  };
  const price = roundCurrency(Object.values(priceBreakdown).reduce((total, item) => total + item, 0));
  const transitHours = fixtureOverride?.transitHours ?? 28 + (fixtureSeed % 25);
  const timeline = deterministicTimeline(input, transitHours, issuedAt);
  const referenceSuffix = stableHash(
    `${provider.service.providerServiceCode}:${input.freight_request_id}`,
  )
    .toString()
    .slice(-6)
    .padStart(6, "0");
  const referencePrefix = provider.carrierCode.replace(/[^A-Z0-9]/g, "").slice(0, 8) || "PROVIDER";
  const scenarioReference = fixtureOverride?.providerOfferReferencePrefix
    ? `${fixtureOverride.providerOfferReferencePrefix}-OFF-${referenceSuffix}`
    : `${referencePrefix}-OFF-${referenceSuffix}`;

  return {
    ok: true,
    data: {
      schemaVersion: "1.0",
      freightRequestId: input.freight_request_id,
      providerOfferReference:
        fixtureOverride?.providerOfferReference ?? scenarioReference,
      price,
      currency: "USD",
      priceBreakdown,
      estimatedPickup: timeline.estimatedPickup,
      estimatedDelivery: timeline.estimatedDelivery,
      transitHours,
      availableCapacityKg: roundCurrency(
        provider.service.maxCapacityKg - input.cargo_weight_kg,
      ),
      availabilityClass: fixtureOverride?.availabilityClass ?? availabilityFor(utilization),
      crossBorderSupported: provider.service.supportsCrossBorder,
      customsCoordinationIncluded: provider.service.supportsCrossBorder,
      requiredDocuments,
      borderHandlingNotes: provider.service.supportsCrossBorder
        ? "Coordinación documental fronteriza incluida en el fixture técnico del provider."
        : null,
      validUntil: timeline.validUntil,
    },
  };
}

function waitForQuote(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, 80);

    function handleAbort() {
      clearTimeout(timeoutId);
      reject(signal.reason ?? new DOMException("Tool execution cancelled", "AbortError"));
    }

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

export function createQuoteFreightTool(
  provider: ProviderPageConfig,
  options: QuoteFreightToolOptions = {},
): WebMCP.ModelContextTool {
  const now = options.now ?? (() => new Date());

  return {
    name: QUOTE_FREIGHT_TOOL_NAME,
    title: "Quote freight",
    description: `Cotiza una solicitud FTL con el servicio ${provider.service.providerServiceCode} del transportista actual.`,
    inputSchema: quoteFreightInputSchema,
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false,
    },
    execute: async (rawInput, options) => {
      const signal = options?.signal ?? new AbortController().signal;
      const parsedInput = parseQuoteFreightInput(rawInput);

      if (!parsedInput.ok) {
        return createErrorEnvelope("INVALID_INPUT", parsedInput.message);
      }

      await waitForQuote(signal);
      signal.throwIfAborted();

      // Snapshot the clock once so every timestamp in this execution derives
      // from the same immutable instant.
      const issuedAt = new Date(now().getTime());

      return buildProviderQuote(provider, parsedInput.value, issuedAt);
    },
  };
}
