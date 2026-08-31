import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateProvider } from "@/features/providers/contracts";

import { createExternalProviderNavigationAdapter } from "./external-provider-navigation-adapter";

const BASE_URL = "https://cargomesh.example/";
const candidate: CandidateProvider = {
  carrierId: "carrier-external",
  carrierCode: "EXTERNAL",
  displayName: "External Registered Provider",
  providerUrl: "https://provider.example/webmcp/freight",
  matchingServiceId: "service-external",
};
const navigationUrl =
  "https://provider.example/webmcp/freight?serviceId=service-external";

type Listener = () => void;

function createFrame() {
  const frameWindow = {} as Window;
  const listeners = new Map<string, Set<Listener>>();
  const attributes = new Map<string, string>();
  let currentSrc = BASE_URL;

  const frame = {
    contentWindow: frameWindow,
    get src() {
      return currentSrc;
    },
    set src(value: string) {
      currentSrc = value;
      queueMicrotask(() => {
        for (const listener of listeners.get("load") ?? []) listener();
      });
    },
    addEventListener(type: string, listener: Listener) {
      const current = listeners.get(type) ?? new Set<Listener>();
      current.add(listener);
      listeners.set(type, current);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
  } as unknown as HTMLIFrameElement;

  return { frame, frameWindow, attributes, get src() { return currentSrc; } };
}

function createModelContext(frame: ReturnType<typeof createFrame>) {
  const getToolsOptions: Array<{ fromOrigins?: string[] } | undefined> = [];
  const executed: Array<{ toolName: string; inputJson: string }> = [];
  const providerOrigin = new URL(navigationUrl).origin;
  const tool = {
    name: "check_service_coverage",
    title: "Coverage",
    description: "Checks coverage",
    origin: providerOrigin,
    window: frame.frameWindow,
  } as WebMCP.RegisteredTool;

  const modelContext = {
    async getTools(options?: { fromOrigins?: string[] }) {
      getToolsOptions.push(options);
      if (frame.src === navigationUrl) return [tool];
      return [];
    },
    async executeTool(registeredTool: WebMCP.RegisteredTool, inputJson = "{}") {
      executed.push({ toolName: registeredTool.name, inputJson });
      return JSON.stringify({ ok: true, data: { supported: true } });
    },
  } as WebMCP.ModelContext;

  return { modelContext, getToolsOptions, executed };
}

test("uses the registered external origin for getTools/executeTool and preserves cleanup", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);
  const adapter = createExternalProviderNavigationAdapter({
    baseUrl: BASE_URL,
    frame: frame.frame,
    documentHost: { modelContext: context.modelContext },
    navigationTimeoutMs: 100,
    webMcpReadyTimeoutMs: 100,
  });
  await adapter.bindRegisteredCandidates?.([candidate]);

  const session = await adapter.open(navigationUrl, candidate);

  assert.equal(frame.attributes.get("allow"), "tools");
  assert.deepEqual(await session.runtime.getToolNames(), [
    "check_service_coverage",
  ]);
  assert.deepEqual(
    await session.runtime.executeTool(
      "check_service_coverage",
      { origin: "Callao", destination: "Santiago" },
      new AbortController().signal,
    ),
    { ok: true, data: { supported: true } },
  );
  assert.deepEqual(context.executed, [
    {
      toolName: "check_service_coverage",
      inputJson: JSON.stringify({ origin: "Callao", destination: "Santiago" }),
    },
  ]);
  assert.equal(
    context.getToolsOptions.some(
      (options) => options?.fromOrigins?.[0] === "https://provider.example",
    ),
    true,
  );

  assert.deepEqual(await session.leaveAndGetActiveToolNames(BASE_URL), []);
  assert.equal(frame.src, BASE_URL);
});

test("rejects an external destination that was not in the discovery snapshot", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);
  const adapter = createExternalProviderNavigationAdapter({
    baseUrl: BASE_URL,
    frame: frame.frame,
    documentHost: { modelContext: context.modelContext },
  });
  await adapter.bindRegisteredCandidates?.([candidate]);
  const unregistered: CandidateProvider = {
    ...candidate,
    carrierId: "carrier-unregistered",
    providerUrl: "https://unregistered.example/webmcp",
  };

  await assert.rejects(
    adapter.open(
      "https://unregistered.example/webmcp?serviceId=service-external",
      unregistered,
    ),
    /UNREGISTERED_PROVIDER_DESTINATION/,
  );
  assert.equal(frame.src, BASE_URL);
});

test("rejects a registered provider URL when matchingServiceId is changed", async () => {
  const frame = createFrame();
  const context = createModelContext(frame);
  const adapter = createExternalProviderNavigationAdapter({
    baseUrl: BASE_URL,
    frame: frame.frame,
    documentHost: { modelContext: context.modelContext },
  });
  await adapter.bindRegisteredCandidates?.([candidate]);

  await assert.rejects(
    adapter.open(
      "https://provider.example/webmcp/freight?serviceId=another-service",
      candidate,
    ),
    /PROVIDER_DESTINATION_MISMATCH/,
  );
  assert.equal(frame.src, BASE_URL);
});
