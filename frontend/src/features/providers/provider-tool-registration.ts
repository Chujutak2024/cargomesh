import {
  CHECK_CAPACITY_TOOL_NAME,
  createCheckCapacityTool,
} from "./check-capacity-tool";
import {
  CHECK_SERVICE_COVERAGE_TOOL_NAME,
  createCheckServiceCoverageTool,
} from "./check-service-coverage-tool";
import type { ProviderPageConfig } from "./contracts";
import {
  createQuoteFreightTool,
  QUOTE_FREIGHT_TOOL_NAME,
} from "./quote-freight-tool";

export const REQUIRED_PROVIDER_TOOL_NAMES = [
  CHECK_SERVICE_COVERAGE_TOOL_NAME,
  CHECK_CAPACITY_TOOL_NAME,
  QUOTE_FREIGHT_TOOL_NAME,
] as const;

export function createProviderTools(
  provider: ProviderPageConfig,
): WebMCP.ModelContextTool[] {
  return [
    createCheckServiceCoverageTool(provider),
    createCheckCapacityTool(provider),
    createQuoteFreightTool(provider),
  ];
}

export async function registerProviderTools(
  modelContext: WebMCP.ModelContext,
  provider: ProviderPageConfig,
  signal: AbortSignal,
): Promise<boolean> {
  await Promise.all(
    createProviderTools(provider).map((tool) =>
      modelContext.registerTool(tool, { signal }),
    ),
  );

  const registeredTools = await modelContext.getTools();
  const registeredToolNames = new Set(registeredTools.map((tool) => tool.name));

  return REQUIRED_PROVIDER_TOOL_NAMES.every((toolName) =>
    registeredToolNames.has(toolName),
  );
}
