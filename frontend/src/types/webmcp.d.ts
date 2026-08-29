/// <reference types="webmcp-types" />

export {};

declare global {
  namespace WebMCP {
    interface ModelContextExecuteToolOptions {
      signal?: AbortSignal;
    }

    interface ModelContext {
      executeTool(
        tool: RegisteredTool,
        inputObject?: Record<string, unknown>,
        options?: ModelContextExecuteToolOptions,
      ): Promise<unknown>;
    }
  }
}
