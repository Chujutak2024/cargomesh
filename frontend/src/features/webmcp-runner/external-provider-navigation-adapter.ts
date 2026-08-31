import { buildProviderNavigationUrl } from "@/features/discovery/provider-navigation";
import type { CandidateProvider } from "@/features/providers/contracts";

import type {
  Int02aProviderToolName,
  ProviderNavigationAdapter,
  WebMcpRuntimeAdapter,
} from "./contracts";

const DEFAULT_NAVIGATION_TIMEOUT_MS = 15_000;
const DEFAULT_WEBMCP_READY_TIMEOUT_MS = 8_000;

type CrossOriginGetToolsOptions = {
  fromOrigins?: string[];
};

type CrossOriginModelContext = WebMCP.ModelContext & {
  getTools(options?: CrossOriginGetToolsOptions): Promise<WebMCP.RegisteredTool[]>;
};

type ModelContextDocument = Pick<Document, "modelContext">;

export type ExternalProviderNavigationAdapterOptions = {
  frame: HTMLIFrameElement;
  baseUrl: string;
  documentHost?: ModelContextDocument;
  navigationTimeoutMs?: number;
  webMcpReadyTimeoutMs?: number;
};

type RegisteredDestination = {
  candidate: Readonly<CandidateProvider>;
  navigationUrl: string;
  origin: string;
};

function normalizedHttpUrl(value: string, baseUrl?: string): string {
  let url: URL;
  try {
    url = baseUrl ? new URL(value, baseUrl) : new URL(value);
  } catch {
    throw new Error("INVALID_NAVIGATION_URL: destination must be a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("INVALID_NAVIGATION_URL: destination must use HTTP(S).");
  }

  return url.toString();
}

function destinationIdentity(candidate: CandidateProvider): string {
  return JSON.stringify([
    candidate.carrierId,
    candidate.providerUrl,
    candidate.matchingServiceId,
  ]);
}

function requiredModelContext(
  documentHost: ModelContextDocument,
): CrossOriginModelContext {
  if (!documentHost.modelContext) {
    throw new Error(
      "WEBMCP_UNAVAILABLE: document.modelContext is not available in CargoMesh.",
    );
  }
  return documentHost.modelContext as CrossOriginModelContext;
}

function exactRegisteredDestination(
  destinations: ReadonlyMap<string, RegisteredDestination>,
  candidate: CandidateProvider,
  navigationUrl: string,
): RegisteredDestination {
  const registered = destinations.get(destinationIdentity(candidate));
  if (!registered) {
    throw new Error(
      "UNREGISTERED_PROVIDER_DESTINATION: candidate was not present in the discovery snapshot.",
    );
  }

  const normalizedNavigationUrl = normalizedHttpUrl(navigationUrl);
  if (normalizedNavigationUrl !== registered.navigationUrl) {
    throw new Error(
      "PROVIDER_DESTINATION_MISMATCH: navigation URL does not match the registered provider service.",
    );
  }

  const serviceIds = new URL(normalizedNavigationUrl).searchParams.getAll("serviceId");
  if (
    serviceIds.length !== 1 ||
    serviceIds[0] !== registered.candidate.matchingServiceId
  ) {
    throw new Error(
      "MATCHING_SERVICE_MISMATCH: navigation must contain exactly the discovered matchingServiceId.",
    );
  }

  return registered;
}

function allowCrossOriginTools(frame: HTMLIFrameElement): void {
  const current = frame.getAttribute("allow") ?? "";
  const policies = current
    .split(";")
    .map((policy) => policy.trim())
    .filter(Boolean);
  if (!policies.some((policy) => policy.split(/\s+/)[0] === "tools")) {
    policies.push("tools");
    frame.setAttribute("allow", policies.join("; "));
  }
}

function navigateFrame(
  frame: HTMLIFrameElement,
  target: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      finish(() => reject(
        new Error("PROVIDER_NAVIGATION_TIMEOUT: provider page did not load."),
      ));
    }, timeoutMs);
    const onLoad = () => finish(resolve);
    const onError = () => finish(() => reject(
      new Error("PROVIDER_NAVIGATION_FAILED: provider page could not be loaded."),
    ));
    const finish = (result: () => void) => {
      clearTimeout(timeoutId);
      frame.removeEventListener("load", onLoad);
      frame.removeEventListener("error", onError);
      result();
    };

    frame.addEventListener("load", onLoad, { once: true });
    frame.addEventListener("error", onError, { once: true });
    frame.src = target;
  });
}

function getToolsOptions(providerOrigin: string, cargoMeshOrigin: string) {
  return providerOrigin === cargoMeshOrigin
    ? undefined
    : { fromOrigins: [providerOrigin] };
}

async function toolsForActiveFrame(
  modelContext: CrossOriginModelContext,
  frame: HTMLIFrameElement,
  providerOrigin: string,
  cargoMeshOrigin: string,
): Promise<WebMCP.RegisteredTool[]> {
  const frameWindow = frame.contentWindow;
  if (!frameWindow) {
    throw new Error(
      "PROVIDER_DOCUMENT_UNAVAILABLE: provider frame has no active window.",
    );
  }

  const tools = await modelContext.getTools(
    getToolsOptions(providerOrigin, cargoMeshOrigin),
  );
  return tools.filter(
    (tool) => tool.origin === providerOrigin && tool.window === frameWindow,
  );
}

async function waitForProviderTools(
  modelContext: CrossOriginModelContext,
  frame: HTMLIFrameElement,
  providerOrigin: string,
  cargoMeshOrigin: string,
  timeoutMs: number,
): Promise<WebMCP.RegisteredTool[]> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const tools = await toolsForActiveFrame(
        modelContext,
        frame,
        providerOrigin,
        cargoMeshOrigin,
      );
      if (tools.length > 0) return tools;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const detail = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(
    `WEBMCP_UNAVAILABLE: registered provider did not expose tools to CargoMesh.${detail}`,
  );
}

/**
 * Navigates both same-origin fixtures and registered external providers in an
 * iframe. Cross-origin access uses WebMCP's permission policy and origin gate;
 * it never reads frame.contentDocument or calls provider handlers directly.
 */
export function createExternalProviderNavigationAdapter(
  options: ExternalProviderNavigationAdapterOptions,
): ProviderNavigationAdapter {
  const baseUrl = normalizedHttpUrl(options.baseUrl);
  const cargoMeshOrigin = new URL(baseUrl).origin;
  const cleanupUrl = new URL("/", baseUrl).toString();
  const documentHost = options.documentHost ?? document;
  const modelContext = requiredModelContext(documentHost);
  const navigationTimeoutMs =
    options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
  const webMcpReadyTimeoutMs =
    options.webMcpReadyTimeoutMs ?? DEFAULT_WEBMCP_READY_TIMEOUT_MS;
  let destinations: ReadonlyMap<string, RegisteredDestination> = new Map();

  allowCrossOriginTools(options.frame);

  return {
    bindRegisteredCandidates(candidates) {
      destinations = new Map(
        candidates.map((candidate) => {
          const snapshot = Object.freeze({ ...candidate });
          const navigationUrl = buildProviderNavigationUrl(snapshot, baseUrl);
          return [
            destinationIdentity(snapshot),
            {
              candidate: snapshot,
              navigationUrl,
              origin: new URL(navigationUrl).origin,
            },
          ];
        }),
      );
    },

    async open(navigationUrl, candidate) {
      const registered = exactRegisteredDestination(
        destinations,
        candidate,
        navigationUrl,
      );

      await navigateFrame(
        options.frame,
        registered.navigationUrl,
        navigationTimeoutMs,
      );
      await waitForProviderTools(
        modelContext,
        options.frame,
        registered.origin,
        cargoMeshOrigin,
        webMcpReadyTimeoutMs,
      );

      const runtime: WebMcpRuntimeAdapter = {
        async getToolNames() {
          const tools = await toolsForActiveFrame(
            modelContext,
            options.frame,
            registered.origin,
            cargoMeshOrigin,
          );
          return tools.map((tool) => tool.name);
        },

        async executeTool(toolName, input, signal) {
          const tools = await toolsForActiveFrame(
            modelContext,
            options.frame,
            registered.origin,
            cargoMeshOrigin,
          );
          const tool = tools.find((item) => item.name === toolName);
          if (!tool) {
            throw new Error(
              `WEBMCP_TOOL_MISSING: ${toolName} is not exposed by the active registered provider.`,
            );
          }

          const outputJson = await modelContext.executeTool(
            tool,
            JSON.stringify(input),
            { signal },
          );
          return outputJson === null ? null : JSON.parse(outputJson);
        },
      };

      return {
        runtime,
        async leaveAndGetActiveToolNames(requestedCleanupUrl) {
          if (normalizedHttpUrl(requestedCleanupUrl, baseUrl) !== cleanupUrl) {
            throw new Error(
              "INVALID_CLEANUP_DESTINATION: cleanup must return to the CargoMesh root.",
            );
          }

          await navigateFrame(options.frame, cleanupUrl, navigationTimeoutMs);
          const tools = await toolsForActiveFrame(
            modelContext,
            options.frame,
            cargoMeshOrigin,
            cargoMeshOrigin,
          );
          return tools.map((tool) => tool.name);
        },
      };
    },
  };
}
