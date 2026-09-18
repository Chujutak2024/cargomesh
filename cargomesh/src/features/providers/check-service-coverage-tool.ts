import type { ProviderPageConfig, ProviderToolEnvelope } from "./contracts";
import {
  getProviderCapabilityFixture,
  matchesCapabilityAlias,
  matchesCapabilityLocation,
  normalizeCapabilityValue,
} from "./provider-capability-fixtures";
import {
  createProviderToolError,
  isNonEmptyProviderString,
  isProviderInputRecord,
  type ParsedProviderInput,
  waitForProviderTool,
} from "./provider-tool-runtime";

export const CHECK_SERVICE_COVERAGE_TOOL_NAME = "check_service_coverage";

type CheckServiceCoverageInput = {
  origin: string;
  destination: string;
  transport_mode: string;
  service_type: string;
  cargo_category: string;
};

export type ServiceCoverageResult = {
  schemaVersion: "1.0";
  providerServiceCode: string;
  supported: boolean;
  crossBorderSupported: boolean;
  corridor: {
    origin: string;
    destination: string;
  };
  customsCoordinationAvailable: boolean;
  serviceNotes: string[];
};

export const checkServiceCoverageInputSchema = {
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
    transport_mode: {
      type: "string",
      minLength: 1,
      description: "Requested transport mode, for example ROAD.",
    },
    service_type: {
      type: "string",
      minLength: 1,
      description: "Requested service type, for example FTL.",
    },
    cargo_category: {
      type: "string",
      minLength: 1,
      description: "Cargo category that the provider must support.",
    },
  },
  required: ["origin", "destination", "transport_mode", "service_type", "cargo_category"],
} as const;

const allowedCoverageInputKeys = new Set([
  "origin",
  "destination",
  "transport_mode",
  "service_type",
  "cargo_category",
]);

function parseServiceCoverageInput(
  rawInput: unknown,
): ParsedProviderInput<CheckServiceCoverageInput> {
  if (!isProviderInputRecord(rawInput)) {
    return { ok: false, message: "El payload debe ser un objeto JSON." };
  }

  const unknownKey = Object.keys(rawInput).find(
    (key) => !allowedCoverageInputKeys.has(key),
  );
  if (unknownKey) {
    return { ok: false, message: `El campo '${unknownKey}' no pertenece al contrato.` };
  }

  for (const field of [
    "origin",
    "destination",
    "transport_mode",
    "service_type",
    "cargo_category",
  ] as const) {
    if (!isNonEmptyProviderString(rawInput[field])) {
      return { ok: false, message: `${field} es obligatorio.` };
    }
  }

  return { ok: true, value: rawInput as CheckServiceCoverageInput };
}

function buildServiceCoverageResult(
  provider: ProviderPageConfig,
  input: CheckServiceCoverageInput,
): ProviderToolEnvelope<ServiceCoverageResult> {
  const fixture = getProviderCapabilityFixture(provider.service.providerServiceCode);
  const transportModeMatches =
    normalizeCapabilityValue(input.transport_mode) ===
    normalizeCapabilityValue(provider.service.transportMode);
  const serviceTypeMatches =
    normalizeCapabilityValue(input.service_type) ===
    normalizeCapabilityValue(provider.service.serviceType);
  const originMatches = fixture
    ? matchesCapabilityLocation(input.origin, fixture.origin)
    : false;
  const destinationMatches = fixture
    ? matchesCapabilityLocation(input.destination, fixture.destination)
    : false;
  const cargoCategoryMatches = fixture
    ? matchesCapabilityAlias(input.cargo_category, fixture.cargoCategories)
    : false;
  const crossBorderCapabilityMatches = Boolean(
    fixture && (!fixture.requiresCrossBorder || provider.service.supportsCrossBorder),
  );
  const supported = Boolean(
    fixture &&
      transportModeMatches &&
      serviceTypeMatches &&
      originMatches &&
      destinationMatches &&
      cargoCategoryMatches &&
      crossBorderCapabilityMatches,
  );
  const serviceNotes: string[] = [];

  if (!fixture) {
    serviceNotes.push(
      "El servicio registrado no declara un fixture operativo de corredor y categoría.",
    );
  }
  if (!transportModeMatches) {
    serviceNotes.push(`La modalidad disponible es ${provider.service.transportMode}.`);
  }
  if (!serviceTypeMatches) {
    serviceNotes.push(`El tipo de servicio disponible es ${provider.service.serviceType}.`);
  }
  if (fixture && (!originMatches || !destinationMatches)) {
    serviceNotes.push("El corredor solicitado no está cubierto por este servicio provider.");
  }
  if (fixture && !cargoCategoryMatches) {
    serviceNotes.push("La categoría de carga solicitada no está habilitada en el fixture provider.");
  }
  if (fixture?.requiresCrossBorder && !provider.service.supportsCrossBorder) {
    serviceNotes.push("El servicio no declara soporte para operaciones transfronterizas.");
  }
  if (supported) {
    serviceNotes.push("Corredor, modalidad, servicio y categoría compatibles.");
  }

  return {
    ok: true,
    data: {
      schemaVersion: "1.0",
      providerServiceCode: provider.service.providerServiceCode,
      supported,
      crossBorderSupported: provider.service.supportsCrossBorder,
      corridor: {
        origin: input.origin.trim(),
        destination: input.destination.trim(),
      },
      customsCoordinationAvailable: provider.service.supportsCrossBorder,
      serviceNotes,
    },
  };
}

export function createCheckServiceCoverageTool(
  provider: ProviderPageConfig,
): WebMCP.ModelContextTool {
  return {
    name: CHECK_SERVICE_COVERAGE_TOOL_NAME,
    title: "Check service coverage",
    description: `Comprueba corredor, modalidad y categoría con el servicio ${provider.service.providerServiceCode}.`,
    inputSchema: checkServiceCoverageInputSchema,
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false,
    },
    execute: async (rawInput, options) => {
      const signal = options?.signal ?? new AbortController().signal;
      const parsedInput = parseServiceCoverageInput(rawInput);

      if (!parsedInput.ok) {
        return createProviderToolError<ServiceCoverageResult>(
          "INVALID_INPUT",
          parsedInput.message,
        );
      }

      await waitForProviderTool(signal);
      signal.throwIfAborted();

      return buildServiceCoverageResult(provider, parsedInput.value);
    },
  };
}
