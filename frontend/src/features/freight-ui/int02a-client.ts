import type { FreightIntakeModel } from "./view-models";
import { createDocumentModelContextAdapter } from "@/features/webmcp-runner/document-model-context-adapter";
import { INT02A_PROVIDER_TOOL_NAMES } from "@/features/webmcp-runner/contracts";
import type {
  ProviderNavigationAdapter,
  ProviderRunnerInputs,
  WebMcpRuntimeAdapter,
} from "@/features/webmcp-runner/contracts";

const NAVIGATION_TIMEOUT_MS = 15_000;
const WEBMCP_READY_TIMEOUT_MS = 8_000;

export function createInt02aIdempotencyKey(freightRequestId: string) {
  return `cm:int02b:${freightRequestId}:${crypto.randomUUID()}`;
}

export function buildRealDispatchPath(runId: string) {
  return `/dispatch/${encodeURIComponent(runId)}`;
}

export function cacheInt02aViewModel(runId: string, viewModel: unknown) {
  try {
    sessionStorage.setItem(`cargomesh:int02a:view-model:${runId}`, JSON.stringify(viewModel));
  } catch {
    // The persisted GET endpoint remains the source of truth when storage is unavailable.
  }
}

export function takeCachedInt02aViewModel(runId: string): unknown {
  try {
    const key = `cargomesh:int02a:view-model:${runId}`;
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function buildProviderRunnerInputs(model: FreightIntakeModel): ProviderRunnerInputs {
  const cargoWeightKg = model.quantity * model.unitWeightKg;
  const cargoVolumeM3 = model.quantity * model.lengthCm * model.widthCm * model.heightCm / 1_000_000;
  const pickupWindowStart = new Date(model.pickupDate).toISOString();

  return {
    check_service_coverage: {
      origin: model.origin,
      destination: model.destination,
      transport_mode: model.transportMode,
      service_type: model.serviceType,
      cargo_category: model.cargoCategoryCode,
    },
    check_capacity: {
      origin: model.origin,
      destination: model.destination,
      cargo_weight_kg: cargoWeightKg,
      cargo_volume_m3: cargoVolumeM3,
      cargo_category: model.cargoCategoryCode,
      pickup_mode: "SCHEDULED",
      pickup_window_start: pickupWindowStart,
    },
    quote_freight: {
      freight_request_id: model.freightRequestId,
      origin: model.origin,
      destination: model.destination,
      cargo_weight_kg: cargoWeightKg,
      cargo_volume_m3: cargoVolumeM3,
      cargo_category: model.cargoCategoryCode,
      pickup_mode: "SCHEDULED",
      pickup_window_start: pickupWindowStart,
      available_documents: [...model.documents],
    },
  };
}

export function createIframeNavigationAdapter(
  frame: HTMLIFrameElement,
  baseUrl: string,
): ProviderNavigationAdapter {
  const allowedOrigin = new URL(baseUrl).origin;

  return {
    async open(navigationUrl) {
      const providerUrl = sameOriginUrl(navigationUrl, baseUrl, allowedOrigin);
      await navigateFrame(frame, providerUrl);
      const runtime = await waitForProviderRuntime(frame);

      return {
        runtime,
        async leaveAndGetActiveToolNames(cleanupUrl) {
          const target = sameOriginUrl(cleanupUrl, baseUrl, allowedOrigin);
          await navigateFrame(frame, target);
          return getFrameRuntime(frame).getToolNames();
        },
      };
    },
  };
}

function sameOriginUrl(value: string, baseUrl: string, allowedOrigin: string) {
  const target = new URL(value, baseUrl);
  if (target.origin !== allowedOrigin) {
    throw new Error("PROVIDER_NAVIGATION_BLOCKED: provider navigation must remain same-origin.");
  }
  return target.toString();
}

function navigateFrame(frame: HTMLIFrameElement, target: string) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(() => reject(new Error("PROVIDER_NAVIGATION_TIMEOUT: provider page did not load."))), NAVIGATION_TIMEOUT_MS);
    const onLoad = () => finish(resolve);
    const onError = () => finish(() => reject(new Error("PROVIDER_NAVIGATION_FAILED: provider page could not be loaded.")));
    const finish = (result: () => void) => {
      window.clearTimeout(timeout);
      frame.removeEventListener("load", onLoad);
      frame.removeEventListener("error", onError);
      result();
    };

    frame.addEventListener("load", onLoad, { once: true });
    frame.addEventListener("error", onError, { once: true });
    frame.src = target;
  });
}

async function waitForProviderRuntime(frame: HTMLIFrameElement): Promise<WebMcpRuntimeAdapter> {
  const deadline = Date.now() + WEBMCP_READY_TIMEOUT_MS;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const runtime = getFrameRuntime(frame);
      const names = await runtime.getToolNames();
      if (INT02A_PROVIDER_TOOL_NAMES.every((name) => names.includes(name))) return runtime;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  const detail = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(`WEBMCP_UNAVAILABLE: provider tools were not registered.${detail}`);
}

function getFrameRuntime(frame: HTMLIFrameElement) {
  const documentHost = frame.contentDocument;
  if (!documentHost) {
    throw new Error("PROVIDER_DOCUMENT_UNAVAILABLE: provider document is not accessible.");
  }
  return createDocumentModelContextAdapter(documentHost);
}
