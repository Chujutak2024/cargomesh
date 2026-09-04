import { createWebMcpExecuteInput } from "@/features/webmcp-runner/execute-tool-input";

import {
  GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
  type FreightRecommendationInput,
  type FreightRecommendationToolEnvelope,
} from "./contracts";
import {
  createGetFreightRequestRecommendationsTool,
  type FreightRecommendationToolOptions,
} from "./get-freight-request-recommendations-tool";
import {
  parseFreightRecommendationInput,
  validateFreightRecommendationToolEnvelope,
} from "./validation";

type ModelContextDocument = Pick<Document, "modelContext">;

function requiredModelContext(documentHost: ModelContextDocument): WebMCP.ModelContext {
  if (!documentHost.modelContext) {
    throw new Error(
      "WEBMCP_UNAVAILABLE: document.modelContext is not available in CargoMesh.",
    );
  }
  return documentHost.modelContext;
}

export async function registerFreightRecommendationTool(
  documentHost: ModelContextDocument,
  signal: AbortSignal,
  options: FreightRecommendationToolOptions = {},
): Promise<boolean> {
  const modelContext = requiredModelContext(documentHost);
  await modelContext.registerTool(
    createGetFreightRequestRecommendationsTool(options),
    { signal },
  );

  const tools = await modelContext.getTools();
  return tools.some(
    (tool) => tool.name === GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
  );
}

export async function executeFreightRecommendationToolViaWebMcp(
  documentHost: ModelContextDocument,
  input: FreightRecommendationInput,
  signal: AbortSignal,
): Promise<FreightRecommendationToolEnvelope> {
  const parsedInput = parseFreightRecommendationInput(input);
  if (!parsedInput.ok) {
    throw new Error(`INVALID_INPUT: ${parsedInput.message}`);
  }

  const modelContext = requiredModelContext(documentHost);
  const tools = await modelContext.getTools();
  const registeredTool = tools.find(
    (tool) => tool.name === GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
  );
  if (!registeredTool) {
    throw new Error(
      `WEBMCP_TOOL_MISSING: ${GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME} is not registered.`,
    );
  }

  const outputJson = await modelContext.executeTool(
    registeredTool,
    createWebMcpExecuteInput(parsedInput.value),
    { signal },
  );
  if (outputJson === null) {
    throw new Error("WEBMCP_EMPTY_RESPONSE: recommendation tool returned null.");
  }

  let output: unknown;
  try {
    output = JSON.parse(outputJson);
  } catch {
    throw new Error("WEBMCP_INVALID_RESPONSE: recommendation tool returned invalid JSON.");
  }

  const validated = validateFreightRecommendationToolEnvelope(
    output,
    parsedInput.value,
  );
  if (!validated.ok) {
    throw new Error(`WEBMCP_INVALID_RESPONSE: ${validated.message}`);
  }

  return validated.value;
}
