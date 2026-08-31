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

export type ProviderToolRegistrationOptions = {
  bookingStorage?: ProviderBookingStorage;
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
  await Promise.all(
    createProviderTools(provider, options).map((tool) =>
      modelContext.registerTool(tool, { signal }),
    ),
  );

  const registeredTools = await modelContext.getTools();
  const registeredToolNames = new Set(registeredTools.map((tool) => tool.name));

  return REQUIRED_PROVIDER_TOOL_NAMES.every((toolName) =>
    registeredToolNames.has(toolName),
  );
}
