import {
  CHECK_CAPACITY_TOOL_NAME,
  createCheckCapacityTool,
} from "./check-capacity-tool";
import {
  CHECK_SERVICE_COVERAGE_TOOL_NAME,
  createCheckServiceCoverageTool,
} from "./check-service-coverage-tool";
import {
  BOOK_FREIGHT_TOOL_NAME,
  createBookFreightTool,
} from "./book-freight-tool";
import type { ProviderPageConfig } from "./contracts";
import {
  createGetProviderBookingStatusTool,
  GET_PROVIDER_BOOKING_STATUS_TOOL_NAME,
} from "./get-provider-booking-status-tool";
import {
  createProviderFixtureController,
  createSessionProviderBookingStorage,
  type ProviderBookingStorage,
  type ProviderFixtureController,
} from "./provider-booking-runtime";
import {
  createQuoteFreightTool,
  QUOTE_FREIGHT_TOOL_NAME,
} from "./quote-freight-tool";

export const REQUIRED_PROVIDER_TOOL_NAMES = [
  CHECK_SERVICE_COVERAGE_TOOL_NAME,
  CHECK_CAPACITY_TOOL_NAME,
  QUOTE_FREIGHT_TOOL_NAME,
  BOOK_FREIGHT_TOOL_NAME,
  GET_PROVIDER_BOOKING_STATUS_TOOL_NAME,
] as const;

const DEFAULT_CARGOMESH_TOOL_CALLER_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
] as const;

function parseCargoMeshToolCallerOrigins(value?: string): string[] {
  const candidates = value
    ? value.split(",").map((origin) => origin.trim())
    : [...DEFAULT_CARGOMESH_TOOL_CALLER_ORIGINS];

  if (candidates.length === 0 || candidates.some((origin) => origin.length === 0)) {
    throw new Error("CargoMesh tool caller origins must not be empty.");
  }

  return [...new Set(candidates.map((candidate) => {
    if (candidate.includes("*")) {
      throw new Error("CargoMesh tool caller origins must not contain wildcards.");
    }

    const parsed = new URL(candidate);
    const isLoopback =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]";

    if (
      (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) ||
      parsed.username ||
      parsed.password ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        "CargoMesh tool caller entries must be secure HTTP(S) origins without credentials, paths, queries, or fragments.",
      );
    }

    return parsed.origin;
  }))];
}

export const CARGOMESH_TOOL_CALLER_ORIGINS = Object.freeze(
  parseCargoMeshToolCallerOrigins(
    process.env.NEXT_PUBLIC_CARGOMESH_TOOL_CALLER_ORIGINS,
  ),
);

export type ProviderToolRegistrationOptions = {
  bookingStorage?: ProviderBookingStorage;
  exposedTo?: readonly string[];
  now?: () => Date;
};

export type ProviderToolBundle = {
  tools: WebMCP.ModelContextTool[];
  fixtureController: ProviderFixtureController;
};

export function createProviderToolBundle(
  provider: ProviderPageConfig,
  options: ProviderToolRegistrationOptions = {},
): ProviderToolBundle {
  const bookingStorage =
    options.bookingStorage ?? createSessionProviderBookingStorage();

  return {
    tools: [
      createCheckServiceCoverageTool(provider),
      createCheckCapacityTool(provider),
      createQuoteFreightTool(provider, { now: options.now }),
      createBookFreightTool(provider, {
        storage: bookingStorage,
        now: options.now,
      }),
      createGetProviderBookingStatusTool(provider, {
        storage: bookingStorage,
        now: options.now,
      }),
    ],
    fixtureController: createProviderFixtureController(
      provider.service.providerServiceCode,
      bookingStorage,
    ),
  };
}

export function createProviderTools(
  provider: ProviderPageConfig,
  options: ProviderToolRegistrationOptions = {},
): WebMCP.ModelContextTool[] {
  return createProviderToolBundle(provider, options).tools;
}

export async function registerProviderTools(
  modelContext: WebMCP.ModelContext,
  provider: ProviderPageConfig,
  signal: AbortSignal,
  options: ProviderToolRegistrationOptions = {},
): Promise<boolean> {
  const exposedTo = parseCargoMeshToolCallerOrigins(
    (options.exposedTo ?? CARGOMESH_TOOL_CALLER_ORIGINS).join(","),
  );

  await Promise.all(
    createProviderTools(provider, options).map((tool) =>
      modelContext.registerTool(tool, { exposedTo: [...exposedTo], signal }),
    ),
  );

  const registeredTools = await modelContext.getTools();
  const registeredToolNames = new Set(registeredTools.map((tool) => tool.name));

  return REQUIRED_PROVIDER_TOOL_NAMES.every((toolName) =>
    registeredToolNames.has(toolName),
  );
}
