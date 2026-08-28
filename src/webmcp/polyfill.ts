/**
 * WebMCP Polyfill / Client Registry
 * Implements the standard WebMCP specification: `document.modelContext.registerTool(...)`
 */

export interface WebMCPToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: WebMCPToolSchema;
  execute: (input: any) => Promise<any>;
}

export interface ModelContext {
  registerTool: (tool: WebMCPToolDefinition) => void;
  getTools: () => WebMCPToolDefinition[];
  getToolByName: (name: string) => WebMCPToolDefinition | undefined;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

class WebMCPRegistry implements ModelContext {
  private tools: Map<string, WebMCPToolDefinition> = new Map();
  private listeners: Array<() => void> = [];

  public registerTool(tool: WebMCPToolDefinition) {
    this.tools.set(tool.name, tool);
    this.notifyListeners();
  }

  public getTools(): WebMCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolByName(name: string): WebMCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("WebMCP listener error:", err);
      }
    });
  }
}

export function initWebMCPPolyfill(): WebMCPRegistry {
  if (typeof window !== "undefined") {
    if (!window.document.modelContext) {
      const registry = new WebMCPRegistry();
      window.document.modelContext = registry;
      return registry;
    }
    return window.document.modelContext as WebMCPRegistry;
  }
  return new WebMCPRegistry();
}
