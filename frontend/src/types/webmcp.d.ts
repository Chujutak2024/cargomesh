/// <reference types="webmcp-types" />

export {};

declare global {
  namespace WebMCP {
    interface ToolAnnotations {
      /** Signals that invoking the tool can create or change commercial state. */
      destructiveHint?: boolean;
    }

    interface ModelContextExecuteToolOptions {
      signal?: AbortSignal;
    }

    interface ModelContext {
      executeTool(
        tool: RegisteredTool,
        inputJson?: string,
        options?: ModelContextExecuteToolOptions,
      ): Promise<string | null>;
    }
  }
}
