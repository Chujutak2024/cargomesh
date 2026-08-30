import type {
  AvailabilityClass,
  ProviderPageConfig,
  ProviderToolEnvelope,
} from "./contracts";
import {
  getProviderCapabilityFixture,
  matchesCapabilityAlias,
  normalizeCapabilityValue,
} from "./provider-capability-fixtures";
import {
  createProviderToolError,
  isNonEmptyProviderString,
  isPositiveProviderNumber,
  isProviderDateTime,
  isProviderInputRecord,
  type ParsedProviderInput,
  waitForProviderTool,
} from "./provider-tool-runtime";

export const CHECK_CAPACITY_TOOL_NAME = "check_capacity";

type CheckCapacityInput = {
  origin: string;
  destination: string;
  cargo_weight_kg: number;
  cargo_volume_m3?: number;
  cargo_category: string;
  pickup_mode: "ASAP" | "SCHEDULED";
  pickup_window_start?: string;
  pickup_window_end?: string;
  delivery_deadline?: string;
  special_requirements?: string[];
};

export type CapacityResult = {
  schemaVersion: "1.0";
  providerServiceCode: string;
  available: boolean;
  availabilityClass: AvailabilityClass;
  availableCapacityKg: number;
  availableVolumeM3: number | null;
  earliestPickup: string | null;
  requestedWindowAvailable: boolean;
  reportedVehicleType: string | null;
  estimatedDelivery: string | null;
  capabilityNotes: string[];
};

export const checkCapacityInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
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
      description: "Total requested cargo weight in kilograms.",
    },
    cargo_volume_m3: {
      type: "number",
      exclusiveMinimum: 0,
      description: "Optional total requested cargo volume in cubic metres.",
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
    special_requirements: {
      type: "array",
      items: { type: "string", minLength: 1 },
      uniqueItems: true,
    },
  },
  required: ["origin", "destination", "cargo_weight_kg", "cargo_category", "pickup_mode"],
} as const;

const allowedCapacityInputKeys = new Set([
  "origin",
  "destination",
  "cargo_weight_kg",
  "cargo_volume_m3",
  "cargo_category",
  "pickup_mode",
  "pickup_window_start",
  "pickup_window_end",
  "delivery_deadline",
  "special_requirements",
]);

function parseCapacityInput(rawInput: unknown): ParsedProviderInput<CheckCapacityInput> {
  if (!isProviderInputRecord(rawInput)) {
    return { ok: false, message: "El payload debe ser un objeto JSON." };
  }

  const unknownKey = Object.keys(rawInput).find(
    (key) => !allowedCapacityInputKeys.has(key),
  );
  if (unknownKey) {
    return { ok: false, message: `El campo '${unknownKey}' no pertenece al contrato.` };
  }

  for (const field of ["origin", "destination", "cargo_category"] as const) {
    if (!isNonEmptyProviderString(rawInput[field])) {
      return { ok: false, message: `${field} es obligatorio.` };
    }
  }

  if (!isPositiveProviderNumber(rawInput.cargo_weight_kg)) {
    return { ok: false, message: "cargo_weight_kg debe ser mayor que cero." };
  }
  if (
    rawInput.cargo_volume_m3 !== undefined &&
    !isPositiveProviderNumber(rawInput.cargo_volume_m3)
  ) {
    return { ok: false, message: "cargo_volume_m3 debe ser mayor que cero." };
  }
  if (rawInput.pickup_mode !== "ASAP" && rawInput.pickup_mode !== "SCHEDULED") {
    return { ok: false, message: "pickup_mode debe ser ASAP o SCHEDULED." };
  }

  for (const field of [
    "pickup_window_start",
    "pickup_window_end",
    "delivery_deadline",
  ] as const) {
    if (rawInput[field] !== undefined && !isProviderDateTime(rawInput[field])) {
      return { ok: false, message: `${field} debe ser una fecha ISO 8601 válida.` };
    }
  }

  if (rawInput.pickup_mode === "SCHEDULED") {
    if (
      !isProviderDateTime(rawInput.pickup_window_start) ||
      !isProviderDateTime(rawInput.pickup_window_end)
    ) {
      return {
        ok: false,
        message: "SCHEDULED requiere pickup_window_start y pickup_window_end.",
      };
    }
  }

  if (
    isProviderDateTime(rawInput.pickup_window_start) &&
    isProviderDateTime(rawInput.pickup_window_end) &&
    Date.parse(rawInput.pickup_window_end) <= Date.parse(rawInput.pickup_window_start)
  ) {
    return { ok: false, message: "pickup_window_end debe ser posterior al inicio." };
  }

  if (
    isProviderDateTime(rawInput.pickup_window_start) &&
    isProviderDateTime(rawInput.delivery_deadline) &&
    Date.parse(rawInput.delivery_deadline) <= Date.parse(rawInput.pickup_window_start)
  ) {
    return { ok: false, message: "delivery_deadline debe ser posterior al pickup." };
  }

  if (rawInput.special_requirements !== undefined) {
    if (
      !Array.isArray(rawInput.special_requirements) ||
      !rawInput.special_requirements.every(isNonEmptyProviderString)
    ) {
      return {
        ok: false,
        message: "special_requirements debe ser una lista de strings no vacíos.",
      };
    }

    const normalizedRequirements = rawInput.special_requirements.map(normalizeCapabilityValue);
    if (new Set(normalizedRequirements).size !== normalizedRequirements.length) {
      return { ok: false, message: "special_requirements no admite valores duplicados." };
    }
  }

  return { ok: true, value: rawInput as CheckCapacityInput };
}

function buildCapacityResult(
  provider: ProviderPageConfig,
  input: CheckCapacityInput,
): ProviderToolEnvelope<CapacityResult> {
  const fixture = getProviderCapabilityFixture(provider.service.providerServiceCode);
  const originMatches = fixture
    ? matchesCapabilityAlias(input.origin, fixture.originAliases)
    : false;
  const destinationMatches = fixture
    ? matchesCapabilityAlias(input.destination, fixture.destinationAliases)
    : false;
  const cargoCategoryMatches = fixture
    ? matchesCapabilityAlias(input.cargo_category, fixture.cargoCategories)
    : false;
  const weightAvailable = input.cargo_weight_kg <= provider.service.maxCapacityKg;
  const volumeAvailable =
    input.cargo_volume_m3 === undefined ||
    provider.service.maxVolumeM3 === null ||
    input.cargo_volume_m3 <= provider.service.maxVolumeM3;
  const specialRequirementsAvailable = fixture
    ? (input.special_requirements ?? []).every((requirement) =>
        matchesCapabilityAlias(requirement, fixture.supportedRequirements),
      )
    : (input.special_requirements ?? []).length === 0;

  let earliestPickup: Date | null = null;
  let plannedPickup: Date | null = null;
  let estimatedDelivery: Date | null = null;
  let requestedWindowAvailable = false;

  if (fixture) {
    earliestPickup = new Date(fixture.earliestPickup);
    plannedPickup = earliestPickup;
    requestedWindowAvailable = true;

    if (input.pickup_mode === "SCHEDULED") {
      const requestedStart = new Date(input.pickup_window_start as string);
      const requestedEnd = new Date(input.pickup_window_end as string);
      plannedPickup = new Date(Math.max(earliestPickup.getTime(), requestedStart.getTime()));
      requestedWindowAvailable = plannedPickup.getTime() <= requestedEnd.getTime();
    }

    estimatedDelivery = new Date(
      plannedPickup.getTime() + fixture.transitHours * 60 * 60 * 1000,
    );
  }

  const deliveryDeadlineAvailable =
    !input.delivery_deadline ||
    (estimatedDelivery !== null &&
      estimatedDelivery.getTime() <= Date.parse(input.delivery_deadline));
  const baseCapabilityAvailable = Boolean(
    fixture &&
      originMatches &&
      destinationMatches &&
      cargoCategoryMatches &&
      provider.service.supportsCrossBorder &&
      weightAvailable &&
      volumeAvailable &&
      specialRequirementsAvailable,
  );
  const available =
    baseCapabilityAvailable && requestedWindowAvailable && deliveryDeadlineAvailable;
  const capabilityNotes: string[] = [];

  if (!fixture) {
    capabilityNotes.push(
      "El servicio registrado no declara un fixture operativo de flota y agenda.",
    );
  }
  if (fixture && (!originMatches || !destinationMatches)) {
    capabilityNotes.push("El corredor solicitado no está disponible para esta capacidad provider.");
  }
  if (fixture && !cargoCategoryMatches) {
    capabilityNotes.push("La categoría solicitada no está habilitada en el fixture provider.");
  }
  if (!provider.service.supportsCrossBorder) {
    capabilityNotes.push("El servicio no declara capacidad transfronteriza.");
  }
  if (!weightAvailable) {
    capabilityNotes.push(
      `El peso solicitado excede la capacidad de ${provider.service.maxCapacityKg} kg.`,
    );
  }
  if (!volumeAvailable) {
    capabilityNotes.push(
      `El volumen solicitado excede la capacidad de ${provider.service.maxVolumeM3} m3.`,
    );
  }
  if (!specialRequirementsAvailable) {
    capabilityNotes.push("Uno o más requisitos especiales no están declarados por el provider.");
  }
  if (fixture && !requestedWindowAvailable) {
    capabilityNotes.push("La ventana solicitada no contiene el primer pickup disponible.");
  }
  if (fixture && !deliveryDeadlineAvailable) {
    capabilityNotes.push("La entrega estimada excede el deadline solicitado.");
  }
  if (available) {
    capabilityNotes.push("Capacidad, corredor y ventana disponibles para la solicitud.");
  }

  return {
    ok: true,
    data: {
      schemaVersion: "1.0",
      providerServiceCode: provider.service.providerServiceCode,
      available,
      availabilityClass: available
        ? fixture!.availabilityClass
        : baseCapabilityAvailable
          ? "WAITLIST"
          : "UNAVAILABLE",
      availableCapacityKg: provider.service.maxCapacityKg,
      availableVolumeM3: provider.service.maxVolumeM3,
      earliestPickup: earliestPickup?.toISOString() ?? null,
      requestedWindowAvailable,
      reportedVehicleType: fixture?.reportedVehicleType ?? null,
      estimatedDelivery: estimatedDelivery?.toISOString() ?? null,
      capabilityNotes,
    },
  };
}

export function createCheckCapacityTool(
  provider: ProviderPageConfig,
): WebMCP.ModelContextTool {
  return {
    name: CHECK_CAPACITY_TOOL_NAME,
    title: "Check capacity",
    description: `Comprueba capacidad y agenda con el servicio ${provider.service.providerServiceCode}.`,
    inputSchema: checkCapacityInputSchema,
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false,
    },
    execute: async (rawInput, options) => {
      const signal = options?.signal ?? new AbortController().signal;
      const parsedInput = parseCapacityInput(rawInput);

      if (!parsedInput.ok) {
        return createProviderToolError<CapacityResult>("INVALID_INPUT", parsedInput.message);
      }

      await waitForProviderTool(signal);
      signal.throwIfAborted();

      return buildCapacityResult(provider, parsedInput.value);
    },
  };
}
