import type {
  Int02aProviderToolName,
  WebMcpRuntimeAdapter,
} from "./contracts";

type ModelContextDocument = Pick<Document, "modelContext">;

function getRequiredModelContext(
  documentHost: ModelContextDocument,
): WebMCP.ModelContext {
  const modelContext = documentHost.modelContext;

  if (!modelContext) {
    throw new Error(
      "WEBMCP_UNAVAILABLE: document.modelContext is not available in this document.",
    );
  }

  return modelContext;
}

/**
 * Production adapter for the provider document. Tool discovery and execution
 * always cross the browser-native document.modelContext boundary.
 */
export function createDocumentModelContextAdapter(
  documentHost: ModelContextDocument = document,
): WebMcpRuntimeAdapter {
  return {
    async getToolNames() {
      const tools = await getRequiredModelContext(documentHost).getTools();
      return tools.map((tool) => tool.name);
    },

    async executeTool(
      toolName: Int02aProviderToolName,
      input: Record<string, unknown>,
      signal: AbortSignal,
    ) {
      const modelContext = getRequiredModelContext(documentHost);
      const tools = await modelContext.getTools();
      const tool = tools.find((registeredTool) => registeredTool.name === toolName);

      if (!tool) {
        throw new Error(
          `WEBMCP_TOOL_MISSING: ${toolName} is not registered in the active document.`,
        );
      }

      return modelContext.executeTool(tool, input, { signal });
    },
  };
}
